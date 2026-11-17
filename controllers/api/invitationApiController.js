import { Op } from 'sequelize';
import { 
  CourseInvitation, 
  CourseAssignment, 
  Teacher, 
  Group, 
  Subject, 
  Department, 
  SubjectRequest, 
  Semester 
} from '../../models/index.js';
import { isSemesterDateExpired, getAuthoritativeDateStr } from '../../utils/semesterHelper.js';
import { apiSuccess, apiError } from './apiHelpers.js';

/**
 * Отримання списку запрошень для викладача (вхідні та надіслані)
 * GET /api/invitations
 */
export const apiGetInvitations = async (req, res) => {
  const teacherId = req.user.teacherId;
  const isAdmin = req.user.role === 'admin';

  if (!teacherId && !isAdmin) {
    return apiError(res, 'Для роботи із запрошеннями необхідний профіль викладача', 403);
  }

  try {
    const receivedWhere = teacherId ? { ReceiverTeacherID: teacherId } : {};
    const sentWhere = teacherId ? { SenderTeacherID: teacherId } : {};

    const [received, sent] = await Promise.all([
      CourseInvitation.findAll({
        where: receivedWhere,
        include: [
          {
            model: CourseAssignment,
            as: 'assignment',
            include: [
              { model: Subject, as: 'subject' },
              { model: Group, as: 'group' }
            ]
          },
          {
            model: Teacher,
            as: 'senderTeacher',
            include: [{ model: Department, as: 'department' }]
          }
        ],
        order: [['CreatedAt', 'DESC']]
      }),
      CourseInvitation.findAll({
        where: sentWhere,
        include: [
          {
            model: CourseAssignment,
            as: 'assignment',
            include: [
              { model: Subject, as: 'subject' },
              { model: Group, as: 'group' }
            ]
          },
          {
            model: Teacher,
            as: 'receiverTeacher',
            include: [{ model: Department, as: 'department' }]
          }
        ],
        order: [['CreatedAt', 'DESC']]
      })
    ]);

    const pendingCount = received.filter(i => i.Status === 'pending').length;

    return apiSuccess(res, {
      received,
      sent
    }, 200, {
      receivedCount: received.length,
      sentCount: sent.length,
      pendingCount
    });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Отримання одного запрошення
 * GET /api/invitations/:id
 */
export const apiGetInvitationById = async (req, res) => {
  const { id } = req.params;
  try {
    const inv = await CourseInvitation.findByPk(id, {
      include: [
        {
          model: CourseAssignment,
          as: 'assignment',
          include: [
            { model: Subject, as: 'subject' },
            { model: Group, as: 'group' }
          ]
        },
        { model: Teacher, as: 'senderTeacher' },
        { model: Teacher, as: 'receiverTeacher' }
      ]
    });
    if (!inv) return apiError(res, 'Запрошення не знайдено', 404);

    return apiSuccess(res, inv);
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Надсилання запрошення колезі-співвикладачу
 * POST /api/invitations
 */
export const apiCreateInvitation = async (req, res) => {
  const senderTeacherId = req.user.teacherId;
  const { assignmentId, receiverTeacherId, roleType, subgroup, message } = req.body;

  if (!senderTeacherId && req.user.role !== 'admin') {
    return apiError(res, 'Для надсилання запрошення необхідний профіль викладача', 403);
  }

  const errors = {};
  if (!assignmentId) errors.assignmentId = 'Вкажіть ID навчального курсу';
  if (!receiverTeacherId) errors.receiverTeacherId = 'Оберіть викладача для запрошення';
  if (!roleType) errors.roleType = 'Оберіть вид навантаження (лекції/практичні/лабораторні)';
  if (!subgroup) errors.subgroup = 'Вкажіть підгрупу або потік';

  if (Object.keys(errors).length > 0) {
    return apiError(res, 'Помилка валідації запрошення', 400, { fieldErrors: errors });
  }

  try {
    const assignment = await CourseAssignment.findByPk(assignmentId, {
      include: [{ model: Subject, as: 'subject' }]
    });
    if (!assignment) return apiError(res, 'Навчальний курс не знайдено', 404);

    if (req.user.role !== 'admin' && assignment.TeacherID !== senderTeacherId) {
      return apiError(res, 'Ви можете запрошувати співвикладачів лише до власних курсів', 403);
    }

    if (Number(receiverTeacherId) === Number(assignment.TeacherID)) {
      return apiError(res, 'Ви не можете надіслати запрошення самому собі', 400);
    }

    // Перевірка семестру за авторитетною датою з Time API
    const sem = await Semester.findOne({
      where: { AcademicYear: assignment.AcademicYear, SemesterNumber: assignment.Semester }
    });
    const today = await getAuthoritativeDateStr();

    if (sem && req.user.role !== 'admin') {
      if (sem.Status === 'completed' || isSemesterDateExpired(sem, today)) {
        return apiError(res, 'Цей семестр закрито або його термін вичерпано. Запрошення заблоковано.', 403);
      }
    }

    // Перевірка чи викладач має схвалений доступ до дисципліни
    const receiverRequest = await SubjectRequest.findOne({
      where: { TeacherID: receiverTeacherId, SubjectID: assignment.SubjectID, Status: 'approved' }
    });
    if (!receiverRequest && req.user.role !== 'admin') {
      return apiError(res, 'Обраний викладач не має схваленого адміністратором доступу до цієї дисципліни', 403);
    }

    // Перевірка на дублювання запиту
    const existing = await CourseInvitation.findOne({
      where: {
        AssignmentID: assignmentId,
        ReceiverTeacherID: receiverTeacherId,
        Status: 'pending'
      }
    });
    if (existing) {
      return apiError(res, 'Запрошення цьому викладачу вже надіслано та очікує відповіді', 409);
    }

    const newInvitation = await CourseInvitation.create({
      AssignmentID: assignmentId,
      SenderTeacherID: senderTeacherId || assignment.TeacherID,
      ReceiverTeacherID: Number(receiverTeacherId),
      RoleType: roleType,
      Subgroup: subgroup,
      Message: message ? String(message).trim() : null,
      Status: 'pending'
    });

    return apiSuccess(res, newInvitation, 201, { message: 'Запрошення успішно надіслано колезі' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Прийняття запрошення
 * POST /api/invitations/:id/accept
 */
export const apiAcceptInvitation = async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.teacherId;

  try {
    const inv = await CourseInvitation.findByPk(id, {
      include: [{ model: CourseAssignment, as: 'assignment' }]
    });
    if (!inv) return apiError(res, 'Запрошення не знайдено', 404);

    if (req.user.role !== 'admin' && inv.ReceiverTeacherID !== teacherId) {
      return apiError(res, 'Ви можете приймати лише запрошення, адресовані вам', 403);
    }

    if (inv.Status !== 'pending') {
      return apiError(res, `Запрошення вже має статус "${inv.Status}"`, 400);
    }

    const original = inv.assignment;
    if (!original) return apiError(res, 'Пов\'язаний навчальний курс не знайдено', 404);

    // Перевірка семестру за авторитетною датою з Time API
    const sem = await Semester.findOne({
      where: { AcademicYear: original.AcademicYear, SemesterNumber: original.Semester }
    });
    const today = await getAuthoritativeDateStr();

    if (sem && req.user.role !== 'admin') {
      if (sem.Status === 'completed' || isSemesterDateExpired(sem, today)) {
        return apiError(res, 'Неможливо прийняти запрошення: навчальний семестр закрито або його термін вичерпано', 403);
      }
    }

    // Створюємо нове закріплення за співвикладачем
    const newAssignment = await CourseAssignment.create({
      TeacherID: inv.ReceiverTeacherID,
      GroupID: original.GroupID,
      SubjectID: original.SubjectID,
      AcademicYear: original.AcademicYear,
      CourseYear: original.CourseYear,
      Semester: original.Semester,
      RoleType: inv.RoleType,
      Subgroup: inv.Subgroup
    });

    await inv.update({ Status: 'accepted' });

    return apiSuccess(res, {
      invitationId: Number(id),
      createdAssignmentId: newAssignment.AssignmentID,
      status: 'accepted'
    }, 200, { message: 'Запрошення успішно прийнято! Курс додано до ваших навантажень.' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Відхилення запрошення
 * POST /api/invitations/:id/decline
 */
export const apiDeclineInvitation = async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.teacherId;

  try {
    const inv = await CourseInvitation.findByPk(id);
    if (!inv) return apiError(res, 'Запрошення не знайдено', 404);

    if (req.user.role !== 'admin' && inv.ReceiverTeacherID !== teacherId && inv.SenderTeacherID !== teacherId) {
      return apiError(res, 'Доступ до зміни цього запрошення заборонено', 403);
    }

    await inv.update({ Status: 'declined' });
    return apiSuccess(res, { invitationId: Number(id), status: 'declined' }, 200, { message: 'Запрошення відхилено' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};
