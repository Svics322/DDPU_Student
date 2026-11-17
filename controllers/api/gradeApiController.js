import { Op } from 'sequelize';
import { 
  Student, 
  Teacher, 
  Group, 
  Subject, 
  Department, 
  Specialization, 
  ControlType, 
  CourseAssignment, 
  SuccessRate, 
  Semester 
} from '../../models/index.js';
import { getSemesterGradingState, getAuthoritativeDateStr } from '../../utils/semesterHelper.js';
import { apiSuccess, apiError } from './apiHelpers.js';

/**
 * Отримання списку оцінок з фільтрами
 * GET /api/grades
 */
export const apiGetGrades = async (req, res) => {
  try {
    const { search, onlyMy, academicYear, semester, subjectId, groupId, studentId } = req.query;
    const currentUser = req.user;
    const whereClause = {};
    const studentWhere = {};

    if (academicYear) whereClause.AcademicYear = academicYear;
    if (semester) whereClause.Semester = Number(semester);
    if (subjectId) whereClause.SubjectID = Number(subjectId);
    if (studentId) whereClause.StudentID = Number(studentId);

    if (onlyMy === '1' && currentUser?.studentId) {
      whereClause.StudentID = currentUser.studentId;
    } else if (search && search.trim() !== '') {
      studentWhere.FullName = { [Op.iLike]: `%${search.trim()}%` };
    }

    if (groupId) {
      studentWhere.GroupID = Number(groupId);
    }

    const records = await SuccessRate.findAll({
      where: whereClause,
      include: [
        {
          model: Student,
          as: 'student',
          where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
          required: Object.keys(studentWhere).length > 0,
          include: [
            {
              model: Group,
              as: 'group',
              include: [{ model: Specialization, as: 'specialization' }]
            },
            { model: Department, as: 'department' }
          ]
        },
        { model: Teacher, as: 'teacher' },
        { model: Subject, as: 'subject' },
        { model: ControlType, as: 'controlType' }
      ],
      order: [
        ['AcademicYear', 'DESC'],
        ['Semester', 'DESC'],
        ['AssessmentDate', 'DESC']
      ]
    });

    return apiSuccess(res, records, 200, { count: records.length });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Отримання однієї оцінки
 * GET /api/grades/:id
 */
export const apiGetGradeById = async (req, res) => {
  const { id } = req.params;
  try {
    const grade = await SuccessRate.findByPk(id, {
      include: [
        { model: Student, as: 'student' },
        { model: Teacher, as: 'teacher' },
        { model: Subject, as: 'subject' },
        { model: ControlType, as: 'controlType' },
        { model: CourseAssignment, as: 'assignment' }
      ]
    });
    if (!grade) return apiError(res, 'Оцінку не знайдено', 404);

    return apiSuccess(res, grade);
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Внесення нової оцінки або оновлення наявної (з перевіркою Time API та захистом від дублікатів)
 * POST /api/grades
 */
export const apiSaveGrade = async (req, res) => {
  const { 
    assignmentId, 
    studentId, 
    gradeId, 
    controlTypeId, 
    assessmentDate, 
    mark,
    confirmOverwrite,
    existingSuccRateId
  } = req.body;

  const isEdit = Boolean(gradeId);
  const errors = {};

  if (!controlTypeId) errors.controlTypeId = 'Оберіть вид семестрового контролю';
  if (!assessmentDate) errors.assessmentDate = 'Вкажіть дату проведення оцінювання';

  if (mark === undefined || mark === '' || isNaN(Number(mark))) {
    errors.mark = 'Введіть числове значення оцінки';
  } else {
    const numMark = Number(mark);
    if (numMark < 0 || numMark > 100) errors.mark = 'Оцінка повинна бути в діапазоні від 0 до 100 балів';
  }

  if (Object.keys(errors).length > 0) {
    return apiError(res, 'Помилка валідації оцінки', 400, { fieldErrors: errors });
  }

  try {
    let assignment = null;
    if (assignmentId) {
      assignment = await CourseAssignment.findByPk(assignmentId);
    }

    let existingGrade = null;
    if (isEdit) {
      existingGrade = await SuccessRate.findByPk(gradeId);
      if (!existingGrade) return apiError(res, 'Оцінку не знайдено', 404);
      if (!assignment && existingGrade.AssignmentID) {
        assignment = await CourseAssignment.findByPk(existingGrade.AssignmentID);
      }
    }

    if (!assignment && !existingGrade) {
      return apiError(res, 'Навчальний курс або оцінку не знайдено', 404);
    }

    const academicYear = assignment ? assignment.AcademicYear : existingGrade.AcademicYear;
    const semesterNumber = assignment ? assignment.Semester : existingGrade.Semester;
    const subjectId = assignment ? assignment.SubjectID : existingGrade.SubjectID;
    const targetStudentId = studentId ? Number(studentId) : existingGrade.StudentID;
    const teacherId = assignment ? assignment.TeacherID : existingGrade.TeacherID;

    // Перевірка прав викладача
    if (req.user.role === 'teacher' && req.user.teacherId !== teacherId) {
      return apiError(res, 'Ви не можете вносити оцінки для чужого навчального курсу', 403);
    }

    // Перевірка термінів семестру через Time API
    const semester = await Semester.findOne({
      where: { AcademicYear: academicYear, SemesterNumber: semesterNumber }
    });
    const today = await getAuthoritativeDateStr();

    if (req.user.role !== 'admin') {
      const gradingState = getSemesterGradingState(semester, today);
      if (!gradingState.canGrade) {
        return apiError(res, gradingState.reason, 403, {
          gradingState,
          today
        });
      }
    }

    // Перевірка відповідності дати термінам семестру
    if (semester && semester.StartDate && semester.EndDate && assessmentDate) {
      if (assessmentDate < semester.StartDate || assessmentDate > semester.EndDate) {
        return apiError(res, `Дата оцінювання (${assessmentDate}) повинна бути в межах семестру (з ${semester.StartDate} по ${semester.EndDate})`, 400);
      }
    }

    // Підтверджений перезапис через modal
    if (confirmOverwrite === true || confirmOverwrite === 'true') {
      const targetId = existingSuccRateId || gradeId;
      if (targetId) {
        const toUpdate = await SuccessRate.findByPk(targetId);
        if (toUpdate) {
          await toUpdate.update({
            ControlTypeID: Number(controlTypeId),
            AssessmentDate: assessmentDate,
            Mark: Number(mark),
            TeacherID: req.user.teacherId || toUpdate.TeacherID
          });
          return apiSuccess(res, toUpdate, 200, { message: 'Наявну оцінку успішно оновлено' });
        }
      }
    }

    // Редагування наявної оцінки
    if (isEdit && existingGrade) {
      await existingGrade.update({
        ControlTypeID: Number(controlTypeId),
        AssessmentDate: assessmentDate,
        Mark: Number(mark)
      });
      return apiSuccess(res, existingGrade, 200, { message: 'Оцінку успішно збережено' });
    }

    // Створення нової оцінки: перевірка на дублікат
    const duplicate = await SuccessRate.findOne({
      where: {
        StudentID: targetStudentId,
        SubjectID: subjectId,
        ControlTypeID: Number(controlTypeId),
        AcademicYear: academicYear,
        Semester: semesterNumber
      },
      include: [
        { model: Student, as: 'student' },
        { model: Subject, as: 'subject' },
        { model: ControlType, as: 'controlType' },
        { model: Teacher, as: 'teacher' }
      ]
    });

    if (duplicate) {
      return apiError(res, 'Запис з такими даними вже існує у відомості успішності', 409, {
        isDuplicate: true,
        existingDuplicate: {
          succRateId: duplicate.SuccRateId,
          mark: duplicate.Mark,
          newMark: Number(mark),
          assessmentDate: duplicate.AssessmentDate,
          studentName: duplicate.student?.FullName || 'Студент',
          subjectName: duplicate.subject?.SubjectName || 'Дисципліна',
          controlTypeName: duplicate.controlType?.ControlTypeName || 'Вид контролю',
          teacherName: duplicate.teacher?.FullName || 'Викладач',
          academicYear: duplicate.AcademicYear,
          semester: duplicate.Semester
        }
      });
    }

    // Створення запису
    const newGrade = await SuccessRate.create({
      TeacherID: teacherId,
      StudentID: targetStudentId,
      SubjectID: subjectId,
      AssignmentID: assignment ? assignment.AssignmentID : null,
      AcademicYear: academicYear,
      CourseYear: assignment ? assignment.CourseYear : 1,
      Semester: semesterNumber,
      ControlTypeID: Number(controlTypeId),
      AssessmentDate: assessmentDate,
      Mark: Number(mark)
    });

    return apiSuccess(res, newGrade, 201, { message: 'Оцінку успішно внесено до відомості' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Оновлення оцінки за ID
 * PUT /api/grades/:id
 */
export const apiUpdateGrade = async (req, res) => {
  req.body.gradeId = req.params.id;
  return apiSaveGrade(req, res);
};

/**
 * Видалення оцінки (із перевіркою термінів семестру за Time API)
 * DELETE /api/grades/:id
 */
export const apiDeleteGrade = async (req, res) => {
  const { id } = req.params;

  try {
    const grade = await SuccessRate.findByPk(id);
    if (!grade) return apiError(res, 'Оцінку не знайдено', 404);

    if (req.user.role === 'teacher' && req.user.teacherId !== grade.TeacherID) {
      return apiError(res, 'Викладач може видаляти лише власноруч виставлені оцінки', 403);
    }

    // Перевірка термінів семестру
    const semester = await Semester.findOne({
      where: { AcademicYear: grade.AcademicYear, SemesterNumber: grade.Semester }
    });
    const today = await getAuthoritativeDateStr();

    if (req.user.role !== 'admin') {
      const gradingState = getSemesterGradingState(semester, today);
      if (!gradingState.canGrade) {
        return apiError(res, `Видалення заблоковано: ${gradingState.reason}`, 403, {
          gradingState,
          today
        });
      }
    }

    await grade.destroy();
    return apiSuccess(res, { deletedId: Number(id) }, 200, { message: 'Оцінку успішно видалено' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};
