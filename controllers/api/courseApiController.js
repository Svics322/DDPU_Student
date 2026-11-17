import { Op } from 'sequelize';
import { 
  CourseAssignment, 
  Teacher, 
  Group, 
  Subject, 
  Specialization, 
  Student, 
  SuccessRate, 
  Semester, 
  SubjectRequest, 
  CourseInvitation 
} from '../../models/index.js';
import { 
  getSemesterGradingState, 
  enrichSemesterDateFlags, 
  getAuthoritativeDateStr 
} from '../../utils/semesterHelper.js';
import { getTeacherAcceptedInvitations, getCoTeachersForDiscipline } from '../../utils/coTeacherHelper.js';
import { apiSuccess, apiError } from './apiHelpers.js';

/**
 * Отримання курсів викладача (або всіх курсів для адміністратора)
 * GET /api/courses
 */
export const apiGetCourses = async (req, res) => {
  try {
    let teacherId = req.user.teacherId;
    if (req.user.role === 'admin' && req.query.teacherId) {
      teacherId = Number(req.query.teacherId);
    }

    const where = {};
    if (teacherId && req.user.role !== 'admin') {
      where.TeacherID = teacherId;
    }

    const assignments = await CourseAssignment.findAll({
      where,
      include: [
        {
          model: Group,
          as: 'group',
          include: [{ model: Specialization, as: 'specialization' }]
        },
        { model: Subject, as: 'subject' },
        { model: Teacher, as: 'teacher' }
      ],
      order: [
        ['AcademicYear', 'DESC'],
        ['CourseYear', 'ASC'],
        ['Semester', 'ASC']
      ]
    });

    const today = await getAuthoritativeDateStr();

    const data = await Promise.all(
      assignments.map(async (a) => {
        const item = a.toJSON();
        const studentWhere = { GroupID: a.GroupID };
        if (a.Subgroup && a.Subgroup !== 'Вся група') {
          studentWhere.Subgroup = a.Subgroup;
        }
        item.studentCount = await Student.count({ where: studentWhere });

        const sem = await Semester.findOne({
          where: { AcademicYear: a.AcademicYear, SemesterNumber: a.Semester }
        });
        if (sem) {
          item.semesterInfo = sem.toJSON();
          const flags = enrichSemesterDateFlags(sem, today);
          item.semesterInfo.isDateExpired = flags.isDateExpired;
          item.semesterInfo.isDateFuture = flags.isDateFuture;
          item.semesterInfo.isDateActive = flags.isDateActive;
          item.gradingState = getSemesterGradingState(sem, today);
        } else {
          item.semesterInfo = null;
          item.gradingState = { canGrade: false, reason: 'Семестр не знайдено в системі' };
        }

        return item;
      })
    );

    return apiSuccess(res, data, 200, { count: data.length });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Отримання одного курсу
 * GET /api/courses/:id
 */
export const apiGetCourseById = async (req, res) => {
  const { id } = req.params;
  try {
    const assignment = await CourseAssignment.findByPk(id, {
      include: [
        {
          model: Group,
          as: 'group',
          include: [{ model: Specialization, as: 'specialization' }]
        },
        { model: Subject, as: 'subject' },
        { model: Teacher, as: 'teacher' }
      ]
    });
    if (!assignment) return apiError(res, 'Навчальний курс не знайдено', 404);

    const today = await getAuthoritativeDateStr();
    const sem = await Semester.findOne({
      where: { AcademicYear: assignment.AcademicYear, SemesterNumber: assignment.Semester }
    });

    const item = assignment.toJSON();
    if (sem) {
      item.semesterInfo = sem.toJSON();
      const flags = enrichSemesterDateFlags(sem, today);
      item.semesterInfo.isDateExpired = flags.isDateExpired;
      item.semesterInfo.isDateFuture = flags.isDateFuture;
      item.gradingState = getSemesterGradingState(sem, today);
    }

    return apiSuccess(res, item);
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Отримання контингенту студентів та журналу курсу
 * GET /api/courses/:id/students
 */
export const apiGetCourseStudents = async (req, res) => {
  const { id } = req.params;

  try {
    const assignment = await CourseAssignment.findByPk(id, {
      include: [
        {
          model: Group,
          as: 'group',
          include: [{ model: Specialization, as: 'specialization' }]
        },
        { model: Subject, as: 'subject' },
        { model: Teacher, as: 'teacher' }
      ]
    });
    if (!assignment) return apiError(res, 'Навчальний курс не знайдено', 404);

    const studentWhere = { GroupID: assignment.GroupID };
    if (assignment.Subgroup && assignment.Subgroup !== 'Вся група') {
      studentWhere.Subgroup = assignment.Subgroup;
    }

    const [students, coTeachers, sem] = await Promise.all([
      Student.findAll({
        where: studentWhere,
        include: [
          {
            model: SuccessRate,
            as: 'successRates',
            where: {
              SubjectID: assignment.SubjectID,
              AcademicYear: assignment.AcademicYear,
              Semester: assignment.Semester
            },
            required: false
          }
        ],
        order: [['FullName', 'ASC']]
      }),
      CourseAssignment.findAll({
        where: {
          GroupID: assignment.GroupID,
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester
        },
        include: [{ model: Teacher, as: 'teacher' }]
      }),
      Semester.findOne({
        where: { AcademicYear: assignment.AcademicYear, SemesterNumber: assignment.Semester }
      })
    ]);

    const today = await getAuthoritativeDateStr();
    const gradingState = getSemesterGradingState(sem, today);
    const canTeacherGrade = gradingState.canGrade || req.user.role === 'admin';

    return apiSuccess(res, {
      assignment,
      students,
      coTeachers,
      today,
      canTeacherGrade,
      gradingState
    }, 200, { studentCount: students.length });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Створення нового закріплення курсу
 * POST /api/courses
 */
export const apiCreateCourse = async (req, res) => {
  let teacherId = req.user.teacherId;
  if (req.user.role === 'admin' && req.body.teacherId) {
    teacherId = Number(req.body.teacherId);
  }

  const { subjectId, groupId, semesterId, roleType, subgroup, courseYear } = req.body;
  const errors = {};

  if (!teacherId) errors.teacherId = 'Необхідно вказати викладача';
  if (!subjectId) errors.subjectId = 'Оберіть навчальну дисципліну';
  if (!groupId) errors.groupId = 'Оберіть академічну групу';
  if (!semesterId) errors.semesterId = 'Оберіть семестр';
  if (!roleType) errors.roleType = 'Оберіть вид занять';
  if (!subgroup) errors.subgroup = 'Вкажіть підгрупу або потік';

  if (Object.keys(errors).length > 0) {
    return apiError(res, 'Помилка валідації створення курсу', 400, { fieldErrors: errors });
  }

  try {
    // Перевірка дозволу на предмет
    if (req.user.role !== 'admin') {
      const accessRequest = await SubjectRequest.findOne({
        where: { TeacherID: teacherId, SubjectID: subjectId }
      });
      if (!accessRequest || accessRequest.Status === 'rejected') {
        return apiError(res, 'Ви не маєте доступу до викладання цієї дисципліни', 403);
      }
      if (accessRequest.Status === 'restricted') {
        return apiError(res, 'Адміністратор обмежив вам відкриття нових семестрів для цієї дисципліни', 403);
      }
    }

    const semester = await Semester.findByPk(semesterId);
    if (!semester) return apiError(res, 'Семестр не знайдено', 404);

    const today = await getAuthoritativeDateStr();
    if (req.user.role !== 'admin') {
      if (semester.Status === 'completed') {
        return apiError(res, 'Обраний семестр вже завершено. Призначення нових курсів заблоковано.', 403);
      }
      if (semester.EndDate && today > semester.EndDate) {
        return apiError(res, `Термін семестру вже вичерпано (${semester.EndDate}). Призначення нових курсів заблоковано.`, 403);
      }
    }

    const newAssignment = await CourseAssignment.create({
      TeacherID: teacherId,
      SubjectID: Number(subjectId),
      GroupID: Number(groupId),
      AcademicYear: semester.AcademicYear,
      CourseYear: Number(courseYear) || 1,
      Semester: semester.SemesterNumber,
      RoleType: roleType,
      Subgroup: subgroup
    });

    return apiSuccess(res, newAssignment, 201, { message: 'Навчальний курс успішно створено та закріплено' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Видалення закріплення курсу
 * DELETE /api/courses/:id
 */
export const apiDeleteCourse = async (req, res) => {
  const { id } = req.params;
  try {
    const assignment = await CourseAssignment.findByPk(id);
    if (!assignment) return apiError(res, 'Курс не знайдено', 404);

    const gradesCount = await SuccessRate.count({ where: { AssignmentID: id } });
    if (gradesCount > 0) {
      return apiError(res, `Неможливо видалити курс, оскільки за ним виставлено ${gradesCount} оцінок`, 409);
    }

    await CourseInvitation.destroy({ where: { AssignmentID: id } });
    await assignment.destroy();

    return apiSuccess(res, { deletedId: Number(id) }, 200, { message: 'Курс успішно видалено' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};
