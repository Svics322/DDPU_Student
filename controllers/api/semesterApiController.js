import { Semester, Teacher, CourseAssignment, Subject, Group, Specialization, Student, CourseInvitation } from '../../models/index.js';
import { 
  getSemesterGradingState, 
  enrichSemesterDateFlags, 
  getAuthoritativeDateStr 
} from '../../utils/semesterHelper.js';
import { apiSuccess, apiError } from './apiHelpers.js';

/**
 * Отримання списку всіх семестрів з інформацією про терміни та дисципліни
 * GET /api/semesters
 */
export const apiGetSemesters = async (req, res) => {
  try {
    const semesters = await Semester.findAll({
      include: [{ model: Teacher, as: 'creator' }],
      order: [
        ['StartDate', 'DESC'],
        ['SemesterNumber', 'DESC']
      ]
    });

    const today = await getAuthoritativeDateStr();

    const data = await Promise.all(
      semesters.map(async (sem) => {
        const item = sem.toJSON();
        const flags = enrichSemesterDateFlags(sem, today);
        item.isDateExpired = flags.isDateExpired;
        item.isDateFuture = flags.isDateFuture;
        item.isDateActive = flags.isDateActive;

        const assignmentsCount = await CourseAssignment.count({
          where: { AcademicYear: sem.AcademicYear, Semester: sem.SemesterNumber }
        });
        item.coursesCount = assignmentsCount;
        item.gradingState = getSemesterGradingState(sem, today);
        return item;
      })
    );

    return apiSuccess(res, data, 200, { count: data.length, currentDate: today });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Отримання одного семестру за ID
 * GET /api/semesters/:id
 */
export const apiGetSemesterById = async (req, res) => {
  const { id } = req.params;
  try {
    const semester = await Semester.findByPk(id, {
      include: [{ model: Teacher, as: 'creator' }]
    });
    if (!semester) {
      return apiError(res, 'Семестр не знайдено', 404);
    }

    const today = await getAuthoritativeDateStr();
    const item = semester.toJSON();
    const flags = enrichSemesterDateFlags(semester, today);
    item.isDateExpired = flags.isDateExpired;
    item.isDateFuture = flags.isDateFuture;
    item.isDateActive = flags.isDateActive;
    item.gradingState = getSemesterGradingState(semester, today);

    return apiSuccess(res, item);
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Створення нового семестру
 * POST /api/semesters
 */
export const apiCreateSemester = async (req, res) => {
  const { academicYear, semesterNumber, name, startDate, endDate, status } = req.body;
  const errors = {};

  if (!academicYear || String(academicYear).trim() === '') {
    errors.academicYear = 'Вкажіть навчальний рік (наприклад: 2025/2026)';
  }
  if (!semesterNumber || ![1, 2, '1', '2'].includes(semesterNumber)) {
    errors.semesterNumber = 'Оберіть семестр (1 або 2)';
  }
  if (!name || String(name).trim() === '') {
    errors.name = 'Вкажіть повну назву семестру';
  }
  if (!startDate) errors.startDate = 'Вкажіть дату початку семестру';
  if (!endDate) errors.endDate = 'Вкажіть дату завершення семестру';

  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    errors.endDate = 'Дата завершення повинна бути пізнішою за дату початку';
  }

  if (Object.keys(errors).length > 0) {
    return apiError(res, 'Помилка валідації семестру', 400, { fieldErrors: errors });
  }

  try {
    const existing = await Semester.findOne({
      where: { AcademicYear: academicYear.trim(), SemesterNumber: Number(semesterNumber) }
    });
    if (existing) {
      return apiError(res, `Семестр ${semesterNumber} для ${academicYear} вже існує в системі`, 409);
    }

    const newSemester = await Semester.create({
      AcademicYear: academicYear.trim(),
      SemesterNumber: Number(semesterNumber),
      Name: name.trim(),
      StartDate: startDate,
      EndDate: endDate,
      Status: status || 'planned',
      CreatedByTeacherID: req.user.teacherId || null
    });

    return apiSuccess(res, newSemester, 201, { message: 'Навчальний семестр успішно створено' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Оновлення семестру
 * PUT /api/semesters/:id
 */
export const apiUpdateSemester = async (req, res) => {
  const { id } = req.params;
  const { academicYear, semesterNumber, name, startDate, endDate, status } = req.body;

  try {
    const semester = await Semester.findByPk(id);
    if (!semester) {
      return apiError(res, 'Семестр не знайдено', 404);
    }

    const today = await getAuthoritativeDateStr();
    const isExpired = Boolean(semester.EndDate && today > semester.EndDate);

    if ((semester.Status === 'completed' || isExpired) && req.user.role !== 'admin') {
      return apiError(res, 'Цей семестр закрито або його термін вичерпано. Редагування дозволено лише адміністратору.', 403);
    }

    const updateData = {};
    if (academicYear) updateData.AcademicYear = academicYear.trim();
    if (semesterNumber) updateData.SemesterNumber = Number(semesterNumber);
    if (name) updateData.Name = name.trim();
    if (startDate) updateData.StartDate = startDate;
    if (endDate) updateData.EndDate = endDate;
    if (status) updateData.Status = status;

    await semester.update(updateData);
    return apiSuccess(res, semester, 200, { message: 'Семестр успішно оновлено' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Оновлення статусу семестру (planned, active, completed)
 * PATCH /api/semesters/:id/status
 */
export const apiUpdateSemesterStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['planned', 'active', 'completed'].includes(status)) {
    return apiError(res, 'Некоректний статус. Дозволені значення: planned, active, completed', 400);
  }

  try {
    const semester = await Semester.findByPk(id);
    if (!semester) {
      return apiError(res, 'Семестр не знайдено', 404);
    }

    const today = await getAuthoritativeDateStr();
    const isExpired = Boolean(semester.EndDate && today > semester.EndDate);

    if ((semester.Status === 'completed' || isExpired) && req.user.role !== 'admin') {
      return apiError(res, 'Завершений семестр закрито або його термін вичерпано. Лише адміністратор має повноваження змінювати статус.', 403);
    }

    await semester.update({ Status: status });
    return apiSuccess(res, semester, 200, { message: `Статус семестру змінено на "${status}"` });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Видалення семестру
 * DELETE /api/semesters/:id
 */
export const apiDeleteSemester = async (req, res) => {
  const { id } = req.params;

  try {
    const semester = await Semester.findByPk(id);
    if (!semester) {
      return apiError(res, 'Семестр не знайдено', 404);
    }

    const coursesCount = await CourseAssignment.count({
      where: { AcademicYear: semester.AcademicYear, Semester: semester.SemesterNumber }
    });
    if (coursesCount > 0) {
      return apiError(res, `Неможливо видалити семестр, оскільки в ньому закріплено ${coursesCount} курсів.`, 409);
    }

    await semester.destroy();
    return apiSuccess(res, { deletedId: Number(id) }, 200, { message: 'Семестр успішно видалено' });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Перевірка можливості оцінювання викладачем у семестрі
 * GET /api/semesters/:id/grading-state
 */
export const apiGetSemesterGradingState = async (req, res) => {
  const { id } = req.params;

  try {
    const semester = await Semester.findByPk(id);
    if (!semester) {
      return apiError(res, 'Семестр не знайдено', 404);
    }

    const today = await getAuthoritativeDateStr();
    const state = getSemesterGradingState(semester, today);
    return apiSuccess(res, {
      semesterId: Number(id),
      semesterName: semester.Name,
      today,
      ...state
    });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};
