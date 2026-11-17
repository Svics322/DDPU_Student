import { Op } from 'sequelize';
import { 
  Semester, 
  Teacher, 
  CourseAssignment, 
  CourseInvitation,
  Subject, 
  Group, 
  Specialization, 
  Student 
} from '../models/index.js';
import { enrichSemesterDateFlags, getAuthoritativeDateStr } from '../utils/semesterHelper.js';

export const getSemesters = async (req, res) => {
  try {
    const semesters = await Semester.findAll({
      include: [
        { model: Teacher, as: 'creator' }
      ],
      order: [
        ['StartDate', 'DESC'],
        ['SemesterNumber', 'DESC']
      ]
    });

    const currentTeacherId = req.user?.teacherId || null;
    const isAdmin = req.user?.role === 'admin';

    const today = await getAuthoritativeDateStr();

    // Збагачуємо кожен семестр розподілом за дисциплінами, видами занять та академічними групами
    const enrichedSemesters = await Promise.all(
      semesters.map(async (sem) => {
        const item = sem.toJSON();
        const dateFlags = enrichSemesterDateFlags(sem, today);
        item.isDateExpired = dateFlags.isDateExpired;
        item.isDateFuture = dateFlags.isDateFuture;

        // Знаходимо всі навантаження, закріплені за цим семестром
        const assignments = await CourseAssignment.findAll({
          where: {
            AcademicYear: sem.AcademicYear,
            Semester: sem.SemesterNumber
          },
          include: [
            { model: Subject, as: 'subject' },
            { 
              model: Group, 
              as: 'group',
              include: [{ model: Specialization, as: 'specialization' }]
            },
            { model: Teacher, as: 'teacher' }
          ],
          order: [
            ['SubjectID', 'ASC'],
            ['GroupID', 'ASC'],
            ['RoleType', 'ASC']
          ]
        });

        // Знаходимо всі прийняті запрошення співвикладачів для цього семестру
        const coTeacherInvs = await CourseInvitation.findAll({
          where: { Status: 'accepted' },
          include: [{ model: CourseAssignment, as: 'assignment' }]
        });

        item.coursesCount = assignments.length;

        // Ієрархічне групування: Семестр -> Предмети -> Академічні групи -> Види занять
        const subjectsMap = {};

        for (const a of assignments) {
          const subId = a.SubjectID;
          if (!subjectsMap[subId]) {
            subjectsMap[subId] = {
              subjectId: a.SubjectID,
              subjectName: a.subject?.SubjectName || 'Навчальна дисципліна',
              groups: {}
            };
          }

          const grpId = a.GroupID;
          if (!subjectsMap[subId].groups[grpId]) {
            subjectsMap[subId].groups[grpId] = {
              groupId: a.GroupID,
              groupName: a.group?.GroupName || 'Група',
              specName: a.group?.specialization?.SpecName || '',
              courseYear: a.CourseYear,
              classes: []
            };
          }

          // Кількість студентів у цій групі / підгрупі
          const studentWhere = { GroupID: a.GroupID };
          if (a.Subgroup && a.Subgroup !== 'Вся група') {
            studentWhere.Subgroup = a.Subgroup;
          }
          const studentCount = await Student.count({ where: studentWhere });

          const isCoTeacher = coTeacherInvs.some(inv =>
            inv.ReceiverTeacherID === a.TeacherID &&
            inv.assignment &&
            Number(inv.assignment.GroupID) === Number(a.GroupID) &&
            Number(inv.assignment.SubjectID) === Number(a.SubjectID) &&
            String(inv.assignment.AcademicYear).trim() === String(a.AcademicYear).trim() &&
            Number(inv.assignment.Semester) === Number(a.Semester)
          );

          subjectsMap[subId].groups[grpId].classes.push({
            assignmentId: a.AssignmentID,
            roleType: a.RoleType, // тип занять: Лекційні, Лабораторні тощо
            subgroup: a.Subgroup, // підгрупа / потік: Вся група, Підгрупа 1, Підгрупа 2
            courseYear: a.CourseYear,
            teacherId: a.TeacherID,
            teacherName: a.teacher?.FullName || 'Не призначено',
            studentCount,
            canAccess: isAdmin || (currentTeacherId && currentTeacherId === a.TeacherID),
            canInvite: isAdmin || (currentTeacherId && currentTeacherId === a.TeacherID && !isCoTeacher)
          });
        }

        item.subjects = Object.values(subjectsMap).map(s => ({
          ...s,
          groupsList: Object.values(s.groups)
        }));
        item.subjectsCount = item.subjects.length;

        return item;
      })
    );

    res.render('semesters/index.njk', {
      title: 'Навчальні семестри',
      semesters: enrichedSemesters,
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const getCreateSemester = (req, res) => {
  res.render('semesters/form.njk', {
    title: 'Планування навчального семестру',
    isEdit: false,
    formData: {
      academicYear: '2025/2026',
      semesterNumber: 1,
      status: 'planned'
    },
    errors: {}
  });
};

export const getEditSemester = async (req, res) => {
  try {
    const { semesterId } = req.params;
    const semester = await Semester.findByPk(semesterId);
    if (!semester) {
      return res.status(404).render('common/error.njk', { error: 'Семестр не знайдено' });
    }

    const today = await getAuthoritativeDateStr();
    const isExpired = Boolean(semester.EndDate && today > semester.EndDate);

    // Завершений семестр або семестр з вичерпаним терміном може редагувати лише адміністратор
    if ((semester.Status === 'completed' || isExpired) && req.user.role !== 'admin') {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Цей навчальний семестр закрито або його термін вичерпано. Лише адміністратор має повноваження редагувати такі періоди.'
      });
    }

    res.render('semesters/form.njk', {
      title: 'Редагування навчального семестру',
      isEdit: true,
      semester,
      formData: {
        academicYear: semester.AcademicYear,
        semesterNumber: semester.SemesterNumber,
        name: semester.Name,
        startDate: semester.StartDate,
        endDate: semester.EndDate,
        status: semester.Status
      },
      errors: {}
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postEditSemester = async (req, res) => {
  try {
    const { semesterId } = req.params;
    const semester = await Semester.findByPk(semesterId);
    if (!semester) {
      return res.status(404).render('common/error.njk', { error: 'Семестр не знайдено' });
    }

    const today = await getAuthoritativeDateStr();
    const isExpired = Boolean(semester.EndDate && today > semester.EndDate);

    // Завершений семестр або семестр з вичерпаним терміном може редагувати лише адміністратор
    if ((semester.Status === 'completed' || isExpired) && req.user.role !== 'admin') {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Цей навчальний семестр закрито або його термін вичерпано. Лише адміністратор має повноваження для його редагування.'
      });
    }

    const { academicYear, semesterNumber, name, startDate, endDate, status } = req.body;
    const errors = {};

    if (!academicYear || academicYear.trim() === '') {
      errors.academicYear = 'Вкажіть навчальний рік (наприклад: 2025/2026)';
    }

    if (!semesterNumber || !['1', '2'].includes(String(semesterNumber))) {
      errors.semesterNumber = 'Оберіть семестр (1 або 2)';
    }

    if (!name || name.trim() === '') {
      errors.name = 'Вкажіть назву семестру';
    }

    if (!startDate) {
      errors.startDate = 'Вкажіть дату початку семестру';
    }

    if (!endDate) {
      errors.endDate = 'Вкажіть дату закриття (завершення) семестру';
    } else if (startDate && new Date(startDate) >= new Date(endDate)) {
      errors.endDate = 'Дата закриття повинна бути пізнішою за дату початку';
    }

    // Перевірка на дублікат семестру при редагуванні
    if (!errors.academicYear && !errors.semesterNumber) {
      const duplicate = await Semester.findOne({
        where: {
          AcademicYear: academicYear.trim(),
          SemesterNumber: Number(semesterNumber),
          SemesterID: { [Op.ne]: Number(semesterId) }
        }
      });
      if (duplicate) {
        errors.semesterNumber = `Семестр ${semesterNumber} для навчального року ${academicYear.trim()} вже існує в системі!`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).render('semesters/form.njk', {
        title: 'Редагування навчального семестру',
        isEdit: true,
        semester,
        formData: req.body,
        errors
      });
    }

    await semester.update({
      AcademicYear: academicYear.trim(),
      SemesterNumber: Number(semesterNumber),
      Name: name.trim(),
      StartDate: startDate,
      EndDate: endDate,
      Status: status || semester.Status
    });

    const redirectPath = req.user.role === 'admin' ? '/admin/semesters' : '/teacher/semesters';
    return res.redirect(`${redirectPath}?success=${encodeURIComponent('Семестр успішно оновлено!')}`);
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postCreateSemester = async (req, res) => {
  const { academicYear, semesterNumber, name, startDate, endDate, status } = req.body;
  const errors = {};

  if (!academicYear || academicYear.trim() === '') {
    errors.academicYear = 'Вкажіть навчальний рік (наприклад: 2025/2026)';
  }

  if (!semesterNumber || !['1', '2'].includes(String(semesterNumber))) {
    errors.semesterNumber = 'Оберіть семестр (1 або 2)';
  }

  if (!name || name.trim() === '') {
    errors.name = 'Вкажіть назву семестру (наприклад: Осінній семестр 2025/2026)';
  }

  if (!startDate) {
    errors.startDate = 'Вкажіть дату початку семестру';
  }

  if (!endDate) {
    errors.endDate = 'Вкажіть дату закриття (завершення) семестру';
  } else if (startDate && new Date(startDate) >= new Date(endDate)) {
    errors.endDate = 'Дата закриття повинна бути пізнішою за дату початку';
  }

  // Перевірка на дублікат семестру
  if (!errors.academicYear && !errors.semesterNumber) {
    const duplicate = await Semester.findOne({
      where: {
        AcademicYear: academicYear.trim(),
        SemesterNumber: Number(semesterNumber)
      }
    });
    if (duplicate) {
      errors.semesterNumber = `Семестр ${semesterNumber} для навчального року ${academicYear.trim()} вже існує в системі!`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render('semesters/form.njk', {
      title: 'Планування навчального семестру',
      isEdit: false,
      formData: req.body,
      errors
    });
  }

  try {
    const creatorId = req.user?.teacherId || null;

    await Semester.create({
      AcademicYear: academicYear.trim(),
      SemesterNumber: Number(semesterNumber),
      Name: name.trim(),
      StartDate: startDate,
      EndDate: endDate,
      Status: status || 'planned',
      CreatedByTeacherID: creatorId
    });

    const redirectPath = req.user.role === 'admin' ? '/admin/semesters' : '/teacher/semesters';
    return res.redirect(`${redirectPath}?success=${encodeURIComponent('Семестр успішно заплановано!')}`);
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postUpdateSemesterStatus = async (req, res) => {
  const { semesterId } = req.params;
  const { status } = req.body;
  const redirectPath = req.user.role === 'admin' ? '/admin/semesters' : '/teacher/semesters';

  if (!['planned', 'active', 'completed'].includes(status)) {
    return res.status(400).redirect(`${redirectPath}?error=${encodeURIComponent('Некоректний статус')}`);
  }

  try {
    const semester = await Semester.findByPk(semesterId);
    if (!semester) {
      return res.status(404).render('common/error.njk', { error: 'Семестр не знайдено' });
    }

    const today = await getAuthoritativeDateStr();
    const isExpired = Boolean(semester.EndDate && today > semester.EndDate);

    // Завершений семестр або семестр з вичерпаним терміном може змінювати або відновлювати лише адміністратор!
    if ((semester.Status === 'completed' || isExpired) && req.user.role !== 'admin') {
      return res.redirect(`${redirectPath}?error=${encodeURIComponent('Завершений семестр закрито або його термін вичерпано. Лише адміністратор має повноваження відновлювати або змінювати статус таких періодів.')}`);
    }

    await semester.update({ Status: status });

    return res.redirect(`${redirectPath}?success=${encodeURIComponent('Статус семестру оновлено!')}`);
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};
