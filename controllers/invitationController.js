import { Op } from 'sequelize';
import { CourseInvitation, CourseAssignment, Teacher, Group, Subject, Department, SubjectRequest, Semester } from '../models/index.js';
import { getAuthoritativeDateStr } from '../utils/semesterHelper.js';

export const getTeacherInvitations = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Для роботи із запрошеннями необхідний обліковий запис викладача.'
      });
    }

    const [receivedInvitations, sentInvitations] = await Promise.all([
      CourseInvitation.findAll({
        where: { ReceiverTeacherID: teacherId },
        include: [
          { model: Teacher, as: 'senderTeacher' },
          {
            model: CourseAssignment,
            as: 'assignment',
            include: [
              { model: Subject, as: 'subject' },
              { model: Group, as: 'group' }
            ]
          }
        ],
        order: [['CreatedAt', 'DESC']]
      }),
      CourseInvitation.findAll({
        where: { SenderTeacherID: teacherId },
        include: [
          { model: Teacher, as: 'receiverTeacher' },
          {
            model: CourseAssignment,
            as: 'assignment',
            include: [
              { model: Subject, as: 'subject' },
              { model: Group, as: 'group' }
            ]
          }
        ],
        order: [['CreatedAt', 'DESC']]
      })
    ]);

    const pendingCount = receivedInvitations.filter(i => i.Status === 'pending').length;

    res.render('teacher/invitations.njk', {
      title: 'Запрошення до викладання курсів',
      receivedInvitations,
      sentInvitations,
      pendingCount,
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const getInviteCoTeacherForm = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const assignmentId = Number(req.params.assignmentId);

    const assignment = await CourseAssignment.findByPk(assignmentId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Group, as: 'group' }
      ]
    });

    if (!assignment) {
      return res.status(404).render('common/error.njk', { error: 'Курс не знайдено' });
    }

    if (req.user.role !== 'admin' && assignment.TeacherID !== teacherId) {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ заборонено',
        message: 'Запрошувати співвикладачів може лише викладач курсу або адміністратор.'
      });
    }

    // Запрошений співвикладач не має права запрошувати інших викладачів
    const coTeacherRecord = await CourseInvitation.findOne({
      where: {
        ReceiverTeacherID: teacherId,
        Status: 'accepted'
      },
      include: [{
        model: CourseAssignment,
        as: 'assignment',
        where: {
          GroupID: assignment.GroupID,
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester
        }
      }]
    });

    if (coTeacherRecord && req.user.role !== 'admin') {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Лише викладач, який створив курс, або адміністратор мають право запрошувати співвикладачів.'
      });
    }

    const sem = await Semester.findOne({
      where: {
        AcademicYear: assignment.AcademicYear,
        SemesterNumber: assignment.Semester
      }
    });
    if (sem && req.user.role !== 'admin') {
      const today = await getAuthoritativeDateStr();
      if (sem.Status === 'completed' || (sem.EndDate && today > sem.EndDate)) {
        return res.status(403).render('common/403.njk', {
          title: 'Семестр закрито',
          message: 'Цей навчальний семестр вже завершено або його термін вичерпано. Запрошення співвикладачів заблоковано.'
        });
      }
    }

    // Перевірка чи не обмежено доступ до цієї дисципліни
    const myRequest = await SubjectRequest.findOne({
      where: { TeacherID: teacherId, SubjectID: assignment.SubjectID }
    });
    if (myRequest && myRequest.Status === 'restricted' && req.user.role !== 'admin') {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Адміністрація обмежила доступ до цієї дисципліни: залучення нових співвикладачів заблоковано.'
      });
    }

    // Тільки викладачі, які мають схвалений доступ або вже викладають даний предмет
    const approvedRequests = await SubjectRequest.findAll({
      where: {
        SubjectID: assignment.SubjectID,
        Status: 'approved'
      },
      attributes: ['TeacherID']
    });
    const approvedTeacherIds = approvedRequests.map(r => r.TeacherID);

    const blockedRequests = await SubjectRequest.findAll({
      where: {
        SubjectID: assignment.SubjectID,
        Status: { [Op.in]: ['restricted', 'rejected'] }
      },
      attributes: ['TeacherID']
    });
    const blockedTeacherIds = blockedRequests.map(r => r.TeacherID);

    const existingSubjectAssignments = await CourseAssignment.findAll({
      where: {
        SubjectID: assignment.SubjectID
      },
      attributes: ['TeacherID']
    });
    const existingSubjectTeacherIds = existingSubjectAssignments.map(a => a.TeacherID);

    const qualifiedTeacherIds = [...new Set([...approvedTeacherIds, ...existingSubjectTeacherIds])]
      .filter(id => Number(id) !== Number(teacherId) && !blockedTeacherIds.includes(Number(id)));

    const teachers = await Teacher.findAll({
      where: {
        TeacherID: { [Op.in]: qualifiedTeacherIds }
      },
      include: [{ model: Department, as: 'department' }],
      order: [['FullName', 'ASC']]
    });

    // Наявні запрошення для цього курсу
    const existingInvitations = await CourseInvitation.findAll({
      where: { AssignmentID: assignmentId },
      include: [{ model: Teacher, as: 'receiverTeacher' }],
      order: [['CreatedAt', 'DESC']]
    });

    // Всі навантаження для цієї ж групи, дисципліни та семестру
    const relatedAssignments = await CourseAssignment.findAll({
      where: {
        GroupID: assignment.GroupID,
        SubjectID: assignment.SubjectID,
        AcademicYear: assignment.AcademicYear,
        Semester: assignment.Semester
      },
      include: [{ model: Teacher, as: 'teacher' }]
    });

    // Активні очікуючі запрошення
    const pendingInvitations = await CourseInvitation.findAll({
      where: {
        AssignmentID: assignmentId,
        Status: 'pending'
      },
      include: [{ model: Teacher, as: 'receiverTeacher' }]
    });

    const relatedAssignmentsData = relatedAssignments.map(a => ({
      teacherId: Number(a.TeacherID),
      teacherName: a.teacher?.FullName || '',
      roleType: String(a.RoleType).trim(),
      subgroup: String(a.Subgroup).trim()
    }));

    const pendingInvitationsData = pendingInvitations.map(p => ({
      receiverTeacherId: Number(p.ReceiverTeacherID),
      receiverTeacherName: p.receiverTeacher?.FullName || '',
      roleType: String(p.RoleType).trim(),
      subgroup: String(p.Subgroup).trim()
    }));

    res.render('teacher/invite-co-teacher.njk', {
      title: `Запрошення співвикладача: ${assignment.subject.SubjectName}`,
      assignment,
      teachers,
      existingInvitations,
      relatedAssignmentsJSON: JSON.stringify(relatedAssignmentsData),
      pendingInvitationsJSON: JSON.stringify(pendingInvitationsData),
      formData: {},
      errors: {}
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postInviteCoTeacher = async (req, res) => {
  const teacherId = req.user.teacherId;
  const assignmentId = Number(req.params.assignmentId);
  const { receiverTeacherId, roleType, subgroup, message } = req.body;
  const errors = {};

  const ALLOWED_ROLES = [
    'Лабораторні заняття',
    'Практичні заняття',
    'Лекційні заняття',
    'Лекції та семінари',
    'Лекції та практика',
    'Семінарські заняття'
  ];
  const ALLOWED_SUBGROUPS = ['Підгрупа 1', 'Підгрупа 2', 'Вся група'];

  const assignment = await CourseAssignment.findByPk(assignmentId, {
    include: [
      { model: Subject, as: 'subject' },
      { model: Group, as: 'group' }
    ]
  });

  if (!assignment) {
    return res.status(404).render('common/error.njk', { error: 'Курс не знайдено' });
  }

  if (req.user.role !== 'admin' && assignment.TeacherID !== teacherId) {
    return res.status(403).render('common/403.njk', {
      title: 'Доступ заборонено',
      message: 'Запрошувати співвикладачів може лише закріплений викладач курсу або адміністратор.'
    });
  }

  // Запрошений співвикладач не має права запрошувати інших викладачів
  const coTeacherRecord = await CourseInvitation.findOne({
    where: {
      ReceiverTeacherID: teacherId,
      Status: 'accepted'
    },
    include: [{
      model: CourseAssignment,
      as: 'assignment',
      where: {
        GroupID: assignment.GroupID,
        SubjectID: assignment.SubjectID,
        AcademicYear: assignment.AcademicYear,
        Semester: assignment.Semester
      }
    }]
  });

  if (coTeacherRecord && req.user.role !== 'admin') {
    return res.status(403).render('common/403.njk', {
      title: 'Доступ обмежено',
      message: 'Лише викладач, який створив курс, або адміністратор мають право запрошувати співвикладачів.'
    });
  }

  const sem = await Semester.findOne({
    where: {
      AcademicYear: assignment.AcademicYear,
      SemesterNumber: assignment.Semester
    }
  });
  if (sem && req.user.role !== 'admin') {
    const today = await getAuthoritativeDateStr();
    if (sem.Status === 'completed' || (sem.EndDate && today > sem.EndDate)) {
      return res.status(403).render('common/403.njk', {
        title: 'Семестр закрито',
        message: 'Цей навчальний семестр вже завершено або його термін вичерпано. Запрошення співвикладачів заблоковано.'
      });
    }
  }

  if (!receiverTeacherId || receiverTeacherId === '') {
    errors.receiverTeacherId = 'Оберіть викладача, якого бажаєте запросити';
  } else if (Number(receiverTeacherId) === teacherId) {
    errors.receiverTeacherId = 'Неможливо надіслати запрошення до курсу самому собі';
  }

  if (!roleType || !ALLOWED_ROLES.includes(roleType.trim())) {
    errors.roleType = 'Оберіть вид навчального навантаження зі списку';
  }

  if (!subgroup || !ALLOWED_SUBGROUPS.includes(subgroup.trim())) {
    errors.subgroup = 'Оберіть підгрупу для співвикладача зі списку';
  }

  const trimmedRole = roleType ? roleType.trim() : '';
  const trimmedSub = subgroup ? subgroup.trim() : '';

  // Глибока перевірка на конфлікти закріплень та наявних запрошень
  if (!errors.receiverTeacherId && !errors.roleType && !errors.subgroup) {
    const receiverId = Number(receiverTeacherId);

    // 0. Чи має запрошений викладач схвалений доступ до цієї дисципліни
    const hasApproved = await SubjectRequest.findOne({
      where: {
        TeacherID: receiverId,
        SubjectID: assignment.SubjectID,
        Status: 'approved'
      }
    });
    const hasExistingCourse = await CourseAssignment.findOne({
      where: {
        TeacherID: receiverId,
        SubjectID: assignment.SubjectID
      }
    });

    if (!hasApproved && !hasExistingCourse) {
      errors.receiverTeacherId = 'Обраний викладач не має схваленого доступу до цієї навчальної дисципліни!';
    }

    // 1. Чи запрошений викладач вже веде цей курс у цій групі
    const alreadyTeaches = await CourseAssignment.findOne({
      where: {
        GroupID: assignment.GroupID,
        SubjectID: assignment.SubjectID,
        AcademicYear: assignment.AcademicYear,
        Semester: assignment.Semester,
        TeacherID: receiverId
      }
    });
    if (alreadyTeaches) {
      errors.receiverTeacherId = `Цей викладач уже закріплений за цим курсом (${alreadyTeaches.RoleType}, ${alreadyTeaches.Subgroup})!`;
    }

    // 2. Чи вказане навантаження вже повністю закріплене в розкладі
    const exactTaken = await CourseAssignment.findOne({
      where: {
        GroupID: assignment.GroupID,
        SubjectID: assignment.SubjectID,
        AcademicYear: assignment.AcademicYear,
        Semester: assignment.Semester,
        RoleType: trimmedRole,
        Subgroup: trimmedSub
      },
      include: [{ model: Teacher, as: 'teacher' }]
    });
    if (exactTaken) {
      errors.subgroup = `Це навантаження (${trimmedRole}, ${trimmedSub}) вже веде викладач: ${exactTaken.teacher?.FullName || 'інший викладач'}!`;
    }

    // 3. Конфлікт підгруп: якщо запрошують на "Вся група", але навантаження вже поділене
    if (!errors.subgroup && trimmedSub === 'Вся група') {
      const splitConflict = await CourseAssignment.findOne({
        where: {
          GroupID: assignment.GroupID,
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester,
          RoleType: trimmedRole,
          Subgroup: { [Op.in]: ['Підгрупа 1', 'Підгрупа 2'] }
        },
        include: [{ model: Teacher, as: 'teacher' }]
      });
      if (splitConflict) {
        errors.subgroup = `Неможливо запросити на всю групу: навантаження "${trimmedRole}" уже розподілене за підгрупами (${splitConflict.Subgroup}, викладач ${splitConflict.teacher?.FullName || ''})!`;
      }
    }

    // 4. Конфлікт підгруп: якщо запрошують на окрему підгрупу, але навантаження закріплене на всю групу
    if (!errors.subgroup && ['Підгрупа 1', 'Підгрупа 2'].includes(trimmedSub)) {
      const wholeConflict = await CourseAssignment.findOne({
        where: {
          GroupID: assignment.GroupID,
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester,
          RoleType: trimmedRole,
          Subgroup: 'Вся група'
        },
        include: [{ model: Teacher, as: 'teacher' }]
      });
      if (wholeConflict) {
        errors.subgroup = `Неможливо запросити на окрему підгрупу: навантаження "${trimmedRole}" уже закріплене за всією групою (викладач ${wholeConflict.teacher?.FullName || ''})!`;
      }
    }

    // 5. Перевірка на дублікат активного запрошення для цього викладача або навантаження
    if (!errors.receiverTeacherId && !errors.subgroup) {
      const duplicateInvitation = await CourseInvitation.findOne({
        where: {
          AssignmentID: assignmentId,
          ReceiverTeacherID: receiverId,
          Status: 'pending'
        }
      });
      if (duplicateInvitation) {
        errors.receiverTeacherId = 'Цьому викладачу вже надіслано активне запрошення до цього курсу, воно очікує відповіді!';
      } else {
        const slotInvited = await CourseInvitation.findOne({
          where: {
            AssignmentID: assignmentId,
            RoleType: trimmedRole,
            Subgroup: trimmedSub,
            Status: 'pending'
          },
          include: [{ model: Teacher, as: 'receiverTeacher' }]
        });
        if (slotInvited) {
          errors.subgroup = `Активне запрошення на це навантаження (${trimmedRole}, ${trimmedSub}) вже надіслано іншому викладачу (${slotInvited.receiverTeacher?.FullName || 'колега'})!`;
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    const assignment = await CourseAssignment.findByPk(assignmentId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: Group, as: 'group' }
      ]
    });
    const approvedRequests = await SubjectRequest.findAll({
      where: {
        SubjectID: assignment.SubjectID,
        Status: 'approved'
      },
      attributes: ['TeacherID']
    });
    const approvedTeacherIds = approvedRequests.map(r => r.TeacherID);

    const existingSubjectAssignments = await CourseAssignment.findAll({
      where: {
        SubjectID: assignment.SubjectID
      },
      attributes: ['TeacherID']
    });
    const existingSubjectTeacherIds = existingSubjectAssignments.map(a => a.TeacherID);

    const qualifiedTeacherIds = [...new Set([...approvedTeacherIds, ...existingSubjectTeacherIds])]
      .filter(id => Number(id) !== Number(teacherId));

    const teachers = await Teacher.findAll({
      where: { TeacherID: { [Op.in]: qualifiedTeacherIds } },
      include: [{ model: Department, as: 'department' }],
      order: [['FullName', 'ASC']]
    });
    const existingInvitations = await CourseInvitation.findAll({
      where: { AssignmentID: assignmentId },
      include: [{ model: Teacher, as: 'receiverTeacher' }],
      order: [['CreatedAt', 'DESC']]
    });
    const relatedAssignments = await CourseAssignment.findAll({
      where: {
        GroupID: assignment.GroupID,
        SubjectID: assignment.SubjectID,
        AcademicYear: assignment.AcademicYear,
        Semester: assignment.Semester
      },
      include: [{ model: Teacher, as: 'teacher' }]
    });
    const pendingInvitations = await CourseInvitation.findAll({
      where: { AssignmentID: assignmentId, Status: 'pending' },
      include: [{ model: Teacher, as: 'receiverTeacher' }]
    });

    const relatedAssignmentsData = relatedAssignments.map(a => ({
      teacherId: Number(a.TeacherID),
      teacherName: a.teacher?.FullName || '',
      roleType: String(a.RoleType).trim(),
      subgroup: String(a.Subgroup).trim()
    }));

    const pendingInvitationsData = pendingInvitations.map(p => ({
      receiverTeacherId: Number(p.ReceiverTeacherID),
      receiverTeacherName: p.receiverTeacher?.FullName || '',
      roleType: String(p.RoleType).trim(),
      subgroup: String(p.Subgroup).trim()
    }));

    return res.status(400).render('teacher/invite-co-teacher.njk', {
      title: `Запрошення співвикладача: ${assignment?.subject?.SubjectName}`,
      assignment,
      teachers,
      existingInvitations,
      relatedAssignmentsJSON: JSON.stringify(relatedAssignmentsData),
      pendingInvitationsJSON: JSON.stringify(pendingInvitationsData),
      formData: req.body,
      errors
    });
  }

  try {
    const assignment = await CourseAssignment.findByPk(assignmentId);
    if (!assignment) {
      return res.status(404).render('common/error.njk', { error: 'Курс не знайдено' });
    }

    await CourseInvitation.create({
      AssignmentID: assignmentId,
      SenderTeacherID: teacherId,
      ReceiverTeacherID: Number(receiverTeacherId),
      RoleType: roleType.trim(),
      Subgroup: subgroup ? subgroup.trim() : 'Підгрупа 2',
      Status: 'pending',
      Message: message ? message.trim() : null
    });

    return res.redirect(`/teacher/courses/${assignmentId}/students?success=` + encodeURIComponent('Запрошення успішно надіслано колезі!'));
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postAcceptInvitation = async (req, res) => {
  const teacherId = req.user.teacherId;
  const { invitationId } = req.params;

  try {
    const invitation = await CourseInvitation.findByPk(invitationId, {
      include: [{ model: CourseAssignment, as: 'assignment' }]
    });

    if (!invitation) {
      return res.status(404).render('common/error.njk', { error: 'Запрошення не знайдено' });
    }

    if (invitation.ReceiverTeacherID !== teacherId && req.user.role !== 'admin') {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ заборонено',
        message: 'Ви можете приймати лише запрошення, адресовані безпосередньо вам.'
      });
    }

    if (invitation.Status !== 'pending') {
      return res.redirect('/teacher/invitations?error=' + encodeURIComponent('Це запрошення вже було оброблено раніше.'));
    }

    const original = invitation.assignment;

    const sem = await Semester.findOne({
      where: {
        AcademicYear: original.AcademicYear,
        SemesterNumber: original.Semester
      }
    });
    if (sem && req.user.role !== 'admin') {
      const today = await getAuthoritativeDateStr();
      if (sem.Status === 'completed' || (sem.EndDate && today > sem.EndDate)) {
        return res.redirect('/teacher/invitations?error=' + encodeURIComponent('Неможливо прийняти запрошення: навчальний семестр вже завершено або його термін вичерпано.'));
      }
    }

    // Перевіряємо чи навантаження випадково не було закріплено за кимось іншим за цей час
    const conflict = await CourseAssignment.findOne({
      where: {
        GroupID: original.GroupID,
        SubjectID: original.SubjectID,
        AcademicYear: original.AcademicYear,
        Semester: original.Semester,
        RoleType: invitation.RoleType,
        Subgroup: invitation.Subgroup
      }
    });

    if (conflict) {
      await invitation.update({ Status: 'declined' });
      return res.redirect('/teacher/invitations?error=' + encodeURIComponent('Неможливо прийняти запрошення: це навчальне навантаження вже зайняте в розкладі!'));
    }

    // 1. Оновлюємо статус запрошення на 'accepted'
    await invitation.update({ Status: 'accepted' });

    // 2. Створюємо новий CourseAssignment для запрошеного викладача
    await CourseAssignment.create({
      GroupID: original.GroupID,
      SubjectID: original.SubjectID,
      TeacherID: teacherId,
      AcademicYear: original.AcademicYear,
      CourseYear: original.CourseYear,
      Semester: original.Semester,
      Subgroup: invitation.Subgroup || 'Підгрупа 2',
      RoleType: invitation.RoleType || 'Лабораторні заняття'
    });

    return res.redirect('/teacher/courses?success=' + encodeURIComponent('Запрошення прийнято! Курс успішно додано до вашого розкладу.'));
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postDeclineInvitation = async (req, res) => {
  const teacherId = req.user.teacherId;
  const { invitationId } = req.params;

  try {
    const invitation = await CourseInvitation.findByPk(invitationId);
    if (!invitation) {
      return res.status(404).render('common/error.njk', { error: 'Запрошення не знайдено' });
    }

    if (invitation.ReceiverTeacherID !== teacherId && req.user.role !== 'admin') {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ заборонено',
        message: 'Ви можете відхиляти лише запрошення, адресовані вам.'
      });
    }

    await invitation.update({ Status: 'declined' });
    return res.redirect('/teacher/invitations?success=' + encodeURIComponent('Запрошення відхилено.'));
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};
