import { Op } from 'sequelize';
import { 
  SubjectRequest, 
  Subject, 
  Teacher, 
  Department, 
  CourseAssignment, 
  CourseInvitation, 
  Group 
} from '../models/index.js';
import { getCoTeachersForDiscipline } from '../utils/coTeacherHelper.js';

export const getTeacherSubjectRequests = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    if (!teacherId) {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Для роботи із заявками необхідний обліковий запис викладача.'
      });
    }

    const [allSubjects, myRequests] = await Promise.all([
      Subject.findAll({ order: [['SubjectName', 'ASC']] }),
      SubjectRequest.findAll({
        where: { TeacherID: teacherId },
        include: [{ model: Subject, as: 'subject' }],
        order: [['CreatedAt', 'DESC']]
      })
    ]);

    // Карта статусів для кожного предмету
    const subjectStatusMap = {};
    myRequests.forEach(reqItem => {
      // Пріоритет: approved > pending > rejected
      if (!subjectStatusMap[reqItem.SubjectID] || reqItem.Status === 'approved') {
        subjectStatusMap[reqItem.SubjectID] = reqItem;
      }
    });

    res.render('teacher/subject-requests.njk', {
      title: 'Заявки на доступ до дисциплін',
      allSubjects,
      myRequests,
      subjectStatusMap,
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null,
      errors: {}
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postTeacherSubjectRequest = async (req, res) => {
  const teacherId = req.user.teacherId;
  const { subjectId, comment } = req.body;
  const errors = {};

  if (!subjectId || subjectId === '') {
    errors.subjectId = 'Оберіть навчальну дисципліну зі списку';
  }

  if (Object.keys(errors).length > 0) {
    const [allSubjects, myRequests] = await Promise.all([
      Subject.findAll({ order: [['SubjectName', 'ASC']] }),
      SubjectRequest.findAll({
        where: { TeacherID: teacherId },
        include: [{ model: Subject, as: 'subject' }],
        order: [['CreatedAt', 'DESC']]
      })
    ]);
    return res.status(400).render('teacher/subject-requests.njk', {
      title: 'Заявки на доступ до дисциплін',
      allSubjects,
      myRequests,
      formData: req.body,
      errors
    });
  }

  try {
    // Перевірка чи немає вже запису по цій дисципліні
    const existingReq = await SubjectRequest.findOne({
      where: {
        TeacherID: teacherId,
        SubjectID: Number(subjectId)
      }
    });

    if (existingReq) {
      if (existingReq.Status === 'approved') {
        return res.redirect('/teacher/subject-requests?error=' + encodeURIComponent('У вас вже є підтверджений та схвалений доступ до цієї навчальної дисципліни!'));
      }
      if (existingReq.Status === 'pending') {
        return res.redirect('/teacher/subject-requests?error=' + encodeURIComponent('Ви вже подали заявку на цей предмет, вона очікує розгляду адміністратора.'));
      }
      // Якщо статус був 'restricted' або 'rejected', переводимо в 'pending' на повторний розгляд
      await existingReq.update({
        Status: 'pending',
        Comment: comment ? comment.trim() : null,
        AdminComment: null
      });
      return res.redirect('/teacher/subject-requests?success=' + encodeURIComponent('Заявку успішно надіслано на розгляд адміністратора!'));
    }

    await SubjectRequest.create({
      TeacherID: teacherId,
      SubjectID: Number(subjectId),
      Status: 'pending',
      Comment: comment ? comment.trim() : null
    });

    return res.redirect('/teacher/subject-requests?success=' + encodeURIComponent('Заявку успішно надіслано на розгляд адміністратора!'));
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const getAdminSubjectRequests = async (req, res) => {
  try {
    const statusFilter = req.query.status || 'all';
    const where = {};
    if (statusFilter !== 'all') {
      where.Status = statusFilter;
    }

    const requests = await SubjectRequest.findAll({
      where,
      include: [
        {
          model: Teacher,
          as: 'teacher',
          include: [{ model: Department, as: 'department' }]
        },
        { model: Subject, as: 'subject' }
      ],
      order: [
        ['CreatedAt', 'DESC']
      ]
    });

    // Збагачуємо інформацією про наявні курси, семестри та співвикладачів
    const enrichedRequests = [];
    for (const r of requests) {
      const assignments = await CourseAssignment.findAll({
        where: { TeacherID: r.TeacherID, SubjectID: r.SubjectID },
        include: [{ model: Group, as: 'group' }]
      });

      const coTeachersNames = await getCoTeachersForDiscipline(r.TeacherID, r.SubjectID);

      enrichedRequests.push({
        ...r.toJSON(),
        teacher: r.teacher,
        subject: r.subject,
        assignmentsCount: assignments.length,
        assignmentsSummary: assignments.map(a => `${a.group?.GroupName || 'Група'} (${a.AcademicYear}, ${a.Semester} сем.)`).join(', '),
        coTeachersCount: coTeachersNames.length,
        coTeachersSummary: coTeachersNames.join(', ')
      });
    }

    const pendingCount = await SubjectRequest.count({ where: { Status: 'pending' } });
    const approvedCount = await SubjectRequest.count({ where: { Status: 'approved' } });
    const restrictedCount = await SubjectRequest.count({ where: { Status: 'restricted' } });
    const rejectedCount = await SubjectRequest.count({ where: { Status: 'rejected' } });

    res.render('admin/subject-requests.njk', {
      title: 'Розгляд заявок викладачів на предмети',
      requests: enrichedRequests,
      statusFilter,
      stats: { pendingCount, approvedCount, restrictedCount, rejectedCount },
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postAdminApproveRequest = async (req, res) => {
  const { requestId } = req.params;
  const { adminComment } = req.body;

  try {
    const requestItem = await SubjectRequest.findByPk(requestId);
    if (!requestItem) {
      return res.status(404).render('common/error.njk', { error: 'Заявку не знайдено' });
    }

    await requestItem.update({
      Status: 'approved',
      AdminComment: adminComment ? adminComment.trim() : 'Схвалено адміністратором'
    });

    return res.redirect('/admin/subject-requests?success=' + encodeURIComponent('Заявку успішно схвалено! Викладач отримав доступ до дисципліни.'));
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postAdminRejectRequest = async (req, res) => {
  const { requestId } = req.params;
  const { adminComment } = req.body;

  try {
    const requestItem = await SubjectRequest.findByPk(requestId);
    if (!requestItem) {
      return res.status(404).render('common/error.njk', { error: 'Заявку не знайдено' });
    }

    await requestItem.update({
      Status: 'rejected',
      AdminComment: adminComment ? adminComment.trim() : 'Відхилено адміністрацією'
    });

    return res.redirect('/admin/subject-requests?success=' + encodeURIComponent('Заявку відхилено.'));
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postAdminManageSubjectAccess = async (req, res) => {
  const { requestId, teacherId, subjectId, actionType, adminComment } = req.body;

  try {
    const tId = Number(teacherId);
    const sId = Number(subjectId);
    const comment = adminComment ? adminComment.trim() : '';

    if (actionType === 'restrict_new') {
      // 1. Обмеження доступу (заборона нових семестрів / створення курсів):
      if (requestId) {
        await SubjectRequest.update(
          {
            Status: 'restricted',
            AdminComment: comment || 'Доступ обмежено: заборонено відкриття нових семестрів та курсів'
          },
          { where: { RequestID: Number(requestId) } }
        );
      } else {
        const [existing] = await SubjectRequest.findOrCreate({
          where: { TeacherID: tId, SubjectID: sId },
          defaults: {
            Status: 'restricted',
            AdminComment: comment || 'Доступ обмежено: заборонено відкриття нових семестрів та курсів'
          }
        });
        if (existing) {
          await existing.update({
            Status: 'restricted',
            AdminComment: comment || 'Доступ обмежено: заборонено відкриття нових семестрів та курсів'
          });
        }
      }

      return res.redirect('/admin/subject-requests?success=' + encodeURIComponent('Доступ викладача обмежено: заборонено відкриття нових семестрів. Можливість виставляти оцінки у наявних закріплених семестрах збережено.'));

    } else if (actionType === 'revoke_full') {
      // 2. Повне відкликання доступу (разом із семестрами, закріпленнями курсів та співвикладачами):
      if (requestId) {
        await SubjectRequest.update(
          {
            Status: 'rejected',
            AdminComment: comment || 'Доступ повністю відкликано адміністрацією'
          },
          { where: { RequestID: Number(requestId) } }
        );
      } else {
        const [existing] = await SubjectRequest.findOrCreate({
          where: { TeacherID: tId, SubjectID: sId },
          defaults: {
            Status: 'rejected',
            AdminComment: comment || 'Доступ повністю відкликано адміністрацією'
          }
        });
        if (existing) {
          await existing.update({
            Status: 'rejected',
            AdminComment: comment || 'Доступ повністю відкликано адміністрацією'
          });
        }
      }

      // Знаходимо всі навантаження викладача за цією дисципліною
      const assignments = await CourseAssignment.findAll({
        where: { TeacherID: tId, SubjectID: sId }
      });
      const assignmentIds = assignments.map(a => a.AssignmentID);
      const disconnectCoTeachers = req.body.disconnectCoTeachers === 'true';

      if (assignmentIds.length > 0) {
        if (disconnectCoTeachers) {
          // Знаходимо всіх співвикладачів, яких запрошував цей викладач
          const coTeacherInvitations = await CourseInvitation.findAll({
            where: {
              AssignmentID: { [Op.in]: assignmentIds },
              Status: 'accepted'
            }
          });

          // Скасовуємо закріплення співвикладачів за цими курсами
          for (const inv of coTeacherInvitations) {
            const original = assignments.find(a => a.AssignmentID === inv.AssignmentID);
            if (original) {
              await CourseAssignment.destroy({
                where: {
                  TeacherID: inv.ReceiverTeacherID,
                  GroupID: original.GroupID,
                  SubjectID: sId,
                  AcademicYear: original.AcademicYear,
                  Semester: original.Semester,
                  RoleType: inv.RoleType,
                  Subgroup: inv.Subgroup
                }
              });
            }
            await inv.update({ Status: 'declined' });
          }
        }

        // Скасовуємо всі очікуючі запрошення до цих курсів
        await CourseInvitation.update(
          { Status: 'declined' },
          { where: { AssignmentID: { [Op.in]: assignmentIds }, Status: 'pending' } }
        );

        // Видаляємо закріплення курсів самого викладача
        await CourseAssignment.destroy({
          where: { AssignmentID: { [Op.in]: assignmentIds } }
        });
      }

      // Якщо цей викладач сам був співвикладачем на курсі іншого викладача з цього предмету
      const coTeachingInvitations = await CourseInvitation.findAll({
        where: { ReceiverTeacherID: tId, Status: 'accepted' },
        include: [{ model: CourseAssignment, as: 'assignment' }]
      });

      for (const inv of coTeachingInvitations) {
        if (inv.assignment && Number(inv.assignment.SubjectID) === sId) {
          await CourseAssignment.destroy({
            where: {
              TeacherID: tId,
              SubjectID: sId,
              GroupID: inv.assignment.GroupID,
              AcademicYear: inv.assignment.AcademicYear,
              Semester: inv.assignment.Semester,
              RoleType: inv.RoleType,
              Subgroup: inv.Subgroup
            }
          });
          await inv.update({ Status: 'declined' });
        }
      }

      return res.redirect('/admin/subject-requests?success=' + encodeURIComponent('Доступ до дисципліни повністю відкликано: діючі закріплення за семестрами скасовано, а пов\'язані співвикладачі від\'єднані.'));

    } else if (actionType === 'restore_full') {
      // 3. Поновлення повного доступу:
      if (requestId) {
        await SubjectRequest.update(
          {
            Status: 'approved',
            AdminComment: comment || 'Повний доступ поновлено адміністратором'
          },
          { where: { RequestID: Number(requestId) } }
        );
      } else {
        await SubjectRequest.update(
          {
            Status: 'approved',
            AdminComment: comment || 'Повний доступ поновлено адміністратором'
          },
          { where: { TeacherID: tId, SubjectID: sId } }
        );
      }

      return res.redirect('/admin/subject-requests?success=' + encodeURIComponent('Повний доступ викладача до дисципліни успішно поновлено!'));
    }

    return res.redirect('/admin/subject-requests');
  } catch (error) {
    console.error('Помилка керування доступом до дисципліни:', error);
    res.status(500).render('common/error.njk', { error: error.message });
  }
};
