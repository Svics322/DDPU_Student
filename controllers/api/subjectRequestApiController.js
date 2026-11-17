import { Op } from 'sequelize';
import { 
  SubjectRequest, 
  Subject, 
  Teacher, 
  Department, 
  CourseAssignment, 
  CourseInvitation, 
  Group 
} from '../../models/index.js';
import { getCoTeachersForDiscipline } from '../../utils/coTeacherHelper.js';
import { apiSuccess, apiError } from './apiHelpers.js';

/**
 * Отримання списку заявок на предмети
 * GET /api/subject-requests
 */
export const apiGetSubjectRequests = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const teacherId = req.user.teacherId;
    const statusFilter = req.query.status || 'all';

    const where = {};
    if (!isAdmin) {
      if (!teacherId) {
        return apiError(res, 'Для перегляду заявок необхідний профіль викладача', 403);
      }
      where.TeacherID = teacherId;
    }
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
      order: [['CreatedAt', 'DESC']]
    });

    const enriched = await Promise.all(
      requests.map(async (r) => {
        const item = r.toJSON();
        const assignments = await CourseAssignment.findAll({
          where: { TeacherID: r.TeacherID, SubjectID: r.SubjectID },
          include: [{ model: Group, as: 'group' }]
        });
        const coTeachersNames = await getCoTeachersForDiscipline(r.TeacherID, r.SubjectID);

        item.assignmentsCount = assignments.length;
        item.assignmentsSummary = assignments.map(a => `${a.group?.GroupName || 'Група'} (${a.AcademicYear}, ${a.Semester} сем.)`).join(', ');
        item.coTeachersCount = coTeachersNames.length;
        item.coTeachersSummary = coTeachersNames.join(', ');
        return item;
      })
    );

    let stats = null;
    if (isAdmin) {
      const [pendingCount, approvedCount, restrictedCount, rejectedCount] = await Promise.all([
        SubjectRequest.count({ where: { Status: 'pending' } }),
        SubjectRequest.count({ where: { Status: 'approved' } }),
        SubjectRequest.count({ where: { Status: 'restricted' } }),
        SubjectRequest.count({ where: { Status: 'rejected' } })
      ]);
      stats = { pendingCount, approvedCount, restrictedCount, rejectedCount };
    }

    return apiSuccess(res, enriched, 200, { count: enriched.length, stats });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Отримання однієї заявки
 * GET /api/subject-requests/:id
 */
export const apiGetSubjectRequestById = async (req, res) => {
  const { id } = req.params;
  try {
    const requestItem = await SubjectRequest.findByPk(id, {
      include: [
        {
          model: Teacher,
          as: 'teacher',
          include: [{ model: Department, as: 'department' }]
        },
        { model: Subject, as: 'subject' }
      ]
    });
    if (!requestItem) {
      return apiError(res, 'Заявку не знайдено', 404);
    }

    if (req.user.role !== 'admin' && req.user.teacherId !== requestItem.TeacherID) {
      return apiError(res, 'Доступ до чужої заявки заборонено', 403);
    }

    const assignments = await CourseAssignment.findAll({
      where: { TeacherID: requestItem.TeacherID, SubjectID: requestItem.SubjectID },
      include: [{ model: Group, as: 'group' }]
    });
    const coTeachersNames = await getCoTeachersForDiscipline(requestItem.TeacherID, requestItem.SubjectID);

    const item = requestItem.toJSON();
    item.assignmentsCount = assignments.length;
    item.assignmentsSummary = assignments.map(a => `${a.group?.GroupName || 'Група'} (${a.AcademicYear}, ${a.Semester} сем.)`).join(', ');
    item.coTeachersCount = coTeachersNames.length;
    item.coTeachersSummary = coTeachersNames.join(', ');

    return apiSuccess(res, item);
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Подання викладачем заявки на викладання дисципліни
 * POST /api/subject-requests
 */
export const apiCreateSubjectRequest = async (req, res) => {
  const teacherId = req.user.teacherId;
  const { subjectId, comment } = req.body;

  if (!teacherId) {
    return apiError(res, 'Для подання заявки необхідний обліковий запис викладача', 403);
  }
  if (!subjectId) {
    return apiError(res, 'Оберіть навчальну дисципліну зі списку', 400);
  }

  try {
    const subject = await Subject.findByPk(subjectId);
    if (!subject) {
      return apiError(res, 'Обрану дисципліну не знайдено', 404);
    }

    const existingApproved = await SubjectRequest.findOne({
      where: { TeacherID: teacherId, SubjectID: subjectId, Status: 'approved' }
    });
    if (existingApproved) {
      return apiError(res, 'Ви вже маєте схвалений доступ до цієї дисципліни', 409);
    }

    const existingPending = await SubjectRequest.findOne({
      where: { TeacherID: teacherId, SubjectID: subjectId, Status: 'pending' }
    });
    if (existingPending) {
      return apiError(res, 'Ваша заявка на цю дисципліну вже знаходиться на розгляді в адміністратора', 409);
    }

    const newRequest = await SubjectRequest.create({
      TeacherID: teacherId,
      SubjectID: subjectId,
      Comment: comment ? String(comment).trim() : null,
      Status: 'pending'
    });

    return apiSuccess(res, newRequest, 201, { message: 'Заявку успішно надіслано адміністрації' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Схвалення заявки адміністратором
 * POST /api/subject-requests/:id/approve
 */
export const apiApproveSubjectRequest = async (req, res) => {
  const { id } = req.params;
  const { adminComment } = req.body;

  try {
    const requestItem = await SubjectRequest.findByPk(id);
    if (!requestItem) {
      return apiError(res, 'Заявку не знайдено', 404);
    }

    await requestItem.update({
      Status: 'approved',
      AdminComment: adminComment ? String(adminComment).trim() : 'Схвалено адміністратором'
    });

    return apiSuccess(res, requestItem, 200, { message: 'Заявку схвалено, викладач отримав повний доступ до дисципліни' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Відхилення заявки адміністратором
 * POST /api/subject-requests/:id/reject
 */
export const apiRejectSubjectRequest = async (req, res) => {
  const { id } = req.params;
  const { adminComment } = req.body;

  try {
    const requestItem = await SubjectRequest.findByPk(id);
    if (!requestItem) {
      return apiError(res, 'Заявку не знайдено', 404);
    }

    await requestItem.update({
      Status: 'rejected',
      AdminComment: adminComment ? String(adminComment).trim() : 'Відхилено адміністратором'
    });

    return apiSuccess(res, requestItem, 200, { message: 'Заявку відхилено' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Адміністративне керування доступом викладача до дисципліни
 * POST /api/subject-requests/revoke-access
 * { requestId, teacherId, subjectId, actionType: 'restrict_new' | 'revoke_full' | 'restore_full', disconnectCoTeachers, adminComment }
 */
export const apiRevokeSubjectAccess = async (req, res) => {
  const { requestId, teacherId, subjectId, actionType, disconnectCoTeachers, adminComment } = req.body;

  if (!actionType || !['restrict_new', 'revoke_full', 'restore_full'].includes(actionType)) {
    return apiError(res, 'Некоректний тип дії (очікується restrict_new, revoke_full або restore_full)', 400);
  }

  try {
    let targetTeacherId = teacherId;
    let targetSubjectId = subjectId;

    if (requestId) {
      const r = await SubjectRequest.findByPk(requestId);
      if (r) {
        targetTeacherId = r.TeacherID;
        targetSubjectId = r.SubjectID;
      }
    }

    if (!targetTeacherId || !targetSubjectId) {
      return apiError(res, 'Необхідно вказати teacherId та subjectId або коректний requestId', 400);
    }

    let resultStatus = 'restricted';
    let resultMessage = '';

    if (actionType === 'restrict_new') {
      resultStatus = 'restricted';
      resultMessage = 'Доступ обмежено: викладач не може відкривати нові семестри для цього предмету, але зберігає право ставити оцінки в уже закріплених семестрах.';
    } else if (actionType === 'revoke_full') {
      resultStatus = 'rejected';
      resultMessage = 'Доступ повністю відкликано. Закріплення за курсами скасовано.';

      const assignments = await CourseAssignment.findAll({
        where: { TeacherID: targetTeacherId, SubjectID: targetSubjectId }
      });
      const assignmentIds = assignments.map(a => a.AssignmentID);

      if (disconnectCoTeachers === true || disconnectCoTeachers === 'true') {
        if (assignmentIds.length > 0) {
          await CourseInvitation.update(
            { Status: 'declined' },
            { where: { AssignmentID: { [Op.in]: assignmentIds } } }
          );
        }
      }

      await CourseAssignment.destroy({
        where: { TeacherID: targetTeacherId, SubjectID: targetSubjectId }
      });
    } else if (actionType === 'restore_full') {
      resultStatus = 'approved';
      resultMessage = 'Повний доступ успішно поновлено. Викладач знову може планувати нові семестри та закріплювати групи.';
    }

    if (requestId) {
      const r = await SubjectRequest.findByPk(requestId);
      if (r) {
        await r.update({
          Status: resultStatus,
          AdminComment: adminComment ? String(adminComment).trim() : `Статус змінено на: ${resultStatus}`
        });
      }
    } else {
      const [r] = await SubjectRequest.findOrCreate({
        where: { TeacherID: targetTeacherId, SubjectID: targetSubjectId },
        defaults: { Status: resultStatus, AdminComment: adminComment || null }
      });
      await r.update({
        Status: resultStatus,
        AdminComment: adminComment ? String(adminComment).trim() : `Статус змінено на: ${resultStatus}`
      });
    }

    return apiSuccess(res, {
      teacherId: targetTeacherId,
      subjectId: targetSubjectId,
      status: resultStatus,
      actionType
    }, 200, { message: resultMessage });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};
