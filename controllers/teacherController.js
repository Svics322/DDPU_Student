import { Op } from 'sequelize';
import { 
  Teacher, 
  CourseAssignment, 
  Group, 
  Subject, 
  Student, 
  SuccessRate, 
  ControlType,
  Specialization,
  Semester,
  SubjectRequest,
  CourseInvitation,
  EducationForm
} from '../models/index.js';
import { 
  getSemesterGradingState, 
  getSemesterGradingStateAsync, 
  enrichSemesterDateFlags, 
  getCurrentDateStr, 
  getAuthoritativeDateStr 
} from '../utils/semesterHelper.js';
import { getTeacherAcceptedInvitations } from '../utils/coTeacherHelper.js';

// Експорт для зворотної сумісності з іншими модулями
export { getSemesterGradingState, getSemesterGradingStateAsync };

export const getTeacherCourses = async (req, res) => {
  try {
    let teacherId = req.user.teacherId;
    if (req.user.role === 'admin' && req.query.teacherId) {
      teacherId = Number(req.query.teacherId);
    }

    if (!teacherId) {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ заборонено',
        message: 'Обліковий запис не прив\'язаний до профілю викладача.'
      });
    }

    const teacher = await Teacher.findByPk(teacherId);
    if (!teacher) {
      return res.status(404).render('common/error.njk', { error: 'Профіль викладача не знайдено.' });
    }

    // Всі закріплені навчальні курси за цим викладачем
    const assignments = await CourseAssignment.findAll({
      where: { TeacherID: teacherId },
      include: [
        {
          model: Group,
          as: 'group',
          include: [{ model: Specialization, as: 'specialization' }]
        },
        { model: Subject, as: 'subject' }
      ],
      order: [
        ['AcademicYear', 'DESC'],
        ['CourseYear', 'ASC'],
        ['Semester', 'ASC'],
        ['GroupID', 'ASC']
      ]
    });

    // Завантажуємо всі семестри для визначення їх статусів та повних назв
    const allSemesters = await Semester.findAll({ raw: true });

    // Отримуємо запрошення, які прийняв цей викладач, щоб визначити де він є співвикладачем
    const myAcceptedInvitations = await getTeacherAcceptedInvitations(teacherId);

    // Авторитетна поточна дата із Time API
    const today = await getAuthoritativeDateStr();

    // Групуємо курси за навчальними роками та семестрами
    const groupedByYear = {};
    let totalStudents = 0;

    for (const a of assignments) {
      const yearKey = a.AcademicYear;
      if (!groupedByYear[yearKey]) {
        groupedByYear[yearKey] = {
          academicYear: yearKey,
          semesters: {}
        };
      }

      const semKey = `Курс ${a.CourseYear}, Семестр ${a.Semester}`;
      if (!groupedByYear[yearKey].semesters[semKey]) {
        const semRecord = allSemesters.find(
          s => s.AcademicYear === a.AcademicYear && s.SemesterNumber === a.Semester
        );
        const { isDateExpired, isDateFuture } = enrichSemesterDateFlags(semRecord, today);

        groupedByYear[yearKey].semesters[semKey] = {
          title: semKey,
          courseYear: a.CourseYear,
          semester: a.Semester,
          status: semRecord ? semRecord.Status : null,
          isDateExpired,
          isDateFuture,
          semesterName: semRecord ? semRecord.Name : semKey,
          items: [],
          subjects: {}
        };
      }

      const studentWhere = { GroupID: a.GroupID };
      if (a.Subgroup && a.Subgroup !== 'Вся група') {
        studentWhere.Subgroup = a.Subgroup;
      }
      const studentCount = await Student.count({ where: studentWhere });
      totalStudents += studentCount;

      groupedByYear[yearKey].semesters[semKey].items.push({
        assignment: a,
        studentCount
      });

      const subjId = a.SubjectID;
      if (!groupedByYear[yearKey].semesters[semKey].subjects[subjId]) {
        groupedByYear[yearKey].semesters[semKey].subjects[subjId] = {
          subjectId: a.SubjectID,
          subjectName: a.subject?.SubjectName || 'Дисципліна',
          groups: {}
        };
      }

      const grpId = a.GroupID;
      if (!groupedByYear[yearKey].semesters[semKey].subjects[subjId].groups[grpId]) {
        groupedByYear[yearKey].semesters[semKey].subjects[subjId].groups[grpId] = {
          groupId: a.GroupID,
          groupName: a.group?.GroupName || 'Група',
          specName: a.group?.specialization?.SpecName || '',
          courseYear: a.CourseYear,
          classes: []
        };
      }

      const isCoTeacher = myAcceptedInvitations.some(inv => 
        inv.assignment && 
        Number(inv.assignment.GroupID) === Number(a.GroupID) && 
        Number(inv.assignment.SubjectID) === Number(a.SubjectID) &&
        String(inv.assignment.AcademicYear).trim() === String(a.AcademicYear).trim() &&
        Number(inv.assignment.Semester) === Number(a.Semester)
      );

      groupedByYear[yearKey].semesters[semKey].subjects[subjId].groups[grpId].classes.push({
        assignment: a,
        studentCount,
        canInvite: !isCoTeacher || req.user.role === 'admin'
      });
    }

    // Загальна статистика викладача
    const teacherGrades = await SuccessRate.findAll({
      where: { TeacherID: teacherId }
    });
    const gradedCount = teacherGrades.length;
    let avgMark = null;
    if (gradedCount > 0) {
      const sum = teacherGrades.reduce((acc, curr) => acc + curr.Mark, 0);
      avgMark = (sum / gradedCount).toFixed(1);
    }

    // Очікуючі запрошення від колег
    const pendingInvitations = await CourseInvitation.findAll({
      where: {
        ReceiverTeacherID: teacherId,
        Status: 'pending'
      },
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
    });

    res.render('teacher/courses.njk', {
      title: 'Панель викладача: Навчальні курси',
      teacher,
      groupedByYear,
      pendingInvitations,
      stats: {
        coursesCount: assignments.length,
        totalStudents,
        gradedCount,
        avgMark,
        pendingInvitationsCount: pendingInvitations.length
      },
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null
    });
  } catch (error) {
    console.error('Помилка отримання курсів викладача:', error);
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const getTeacherCourseStudents = async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const assignment = await CourseAssignment.findByPk(assignmentId, {
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

    if (!assignment) {
      return res.status(404).render('common/error.njk', { error: 'Призначення курсу не знайдено.' });
    }

    // Перевірка прав
    if (req.user.role === 'teacher' && req.user.teacherId !== assignment.TeacherID) {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Ви не маєте доступу до студентів цього курсу, оскільки заняття проводить інший викладач.'
      });
    }

    const studentWhere = { GroupID: assignment.GroupID };
    if (assignment.Subgroup && assignment.Subgroup !== 'Вся група') {
      studentWhere.Subgroup = assignment.Subgroup;
    }

    const students = await Student.findAll({
      where: studentWhere,
      order: [['FullName', 'ASC']]
    });

    const studentData = [];
    for (const student of students) {
      const grade = await SuccessRate.findOne({
        where: {
          StudentID: student.StudentID,
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester
        },
        include: [{ model: ControlType, as: 'controlType' }]
      });

      studentData.push({
        student,
        grade
      });
    }

    const [coTeachers, invitations, semester] = await Promise.all([
      CourseAssignment.findAll({
        where: {
          GroupID: assignment.GroupID,
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester
        },
        include: [{ model: Teacher, as: 'teacher' }]
      }),
      CourseInvitation.findAll({
        where: { AssignmentID: assignmentId },
        include: [{ model: Teacher, as: 'receiverTeacher' }],
        order: [['CreatedAt', 'DESC']]
      }),
      Semester.findOne({
        where: {
          AcademicYear: assignment.AcademicYear,
          SemesterNumber: assignment.Semester
        }
      })
    ]);

    const today = await getAuthoritativeDateStr();
    const gradingState = getSemesterGradingState(semester, today);
    const canTeacherGrade = gradingState.canGrade || req.user.role === 'admin';

    // Перевіряємо чи поточний викладач не є запрошеним співвикладачем
    const coTeacherInvite = await CourseInvitation.findOne({
      where: {
        ReceiverTeacherID: req.user.teacherId,
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

    const isOwner = !coTeacherInvite && (assignment.TeacherID === req.user.teacherId || req.user.role === 'admin');

    res.render('teacher/group-students.njk', {
      title: `${assignment.subject.SubjectName} - ${assignment.group.GroupName}`,
      assignment,
      studentData,
      coTeachers,
      invitations,
      canTeacherGrade,
      gradingState,
      isOwner,
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null
    });
  } catch (error) {
    console.error('Помилка отримання студентів курсу:', error);
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

// Форма виставлення або редагування оцінки викладачем
export const getTeacherGradeForm = async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const { studentId, gradeId } = req.params;

    const assignment = await CourseAssignment.findByPk(assignmentId, {
      include: [
        { model: Group, as: 'group' },
        { model: Subject, as: 'subject' }
      ]
    });

    if (!assignment) {
      return res.status(404).render('common/error.njk', { error: 'Курс не знайдено.' });
    }

    if (req.user.role === 'teacher' && req.user.teacherId !== assignment.TeacherID) {
      return res.status(403).render('common/403.njk', { title: 'Доступ заборонено', message: 'Ви не можете виставляти оцінки для чужого курсу.' });
    }

    const semester = await Semester.findOne({
      where: {
        AcademicYear: assignment.AcademicYear,
        SemesterNumber: assignment.Semester
      }
    });

    const today = await getAuthoritativeDateStr();

    if (req.user.role !== 'admin') {
      const gradingState = getSemesterGradingState(semester, today);
      if (!gradingState.canGrade) {
        return res.status(403).render('common/403.njk', {
          title: 'Оцінювання заблоковано',
          message: gradingState.reason
        });
      }
    }

    const isEdit = Boolean(gradeId);
    let student = null;
    let formData = {};

    if (isEdit) {
      const grade = await SuccessRate.findByPk(gradeId);
      if (!grade) {
        return res.status(404).render('common/error.njk', { error: 'Оцінку не знайдено.' });
      }
      student = await Student.findByPk(grade.StudentID);
      formData = {
        controlTypeId: grade.ControlTypeID,
        assessmentDate: grade.AssessmentDate,
        mark: grade.Mark
      };
    } else {
      student = await Student.findByPk(studentId);
      if (!student) {
        return res.status(404).render('common/error.njk', { error: 'Студента не знайдено.' });
      }

      // Якщо для студента в цьому курсі оцінка вже виставлена, сторінка створення недоступна — перенаправляємо на редагування
      const existingGrade = await SuccessRate.findOne({
        where: {
          StudentID: Number(studentId),
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester
        }
      });
      if (existingGrade) {
        return res.redirect(`/teacher/courses/${assignmentId}/grades/edit/${existingGrade.SuccRateID}`);
      }

      let defaultDate = today;
      if (semester && semester.StartDate && semester.EndDate) {
        if (today < semester.StartDate || today > semester.EndDate) {
          defaultDate = semester.StartDate;
        }
      }
      formData = {
        assessmentDate: defaultDate
      };
    }

    if (!student) {
      return res.status(404).render('common/error.njk', { error: 'Студента не знайдено.' });
    }

    const controlTypes = await ControlType.findAll({ order: [['ControlTypeName', 'ASC']] });

    // Визначаємо які види контролю вже виставлені студенту за цією дисципліною у поточному періоді
    const existingStudentGrades = await SuccessRate.findAll({
      where: {
        StudentID: student.StudentID,
        SubjectID: assignment.SubjectID,
        AcademicYear: assignment.AcademicYear,
        Semester: assignment.Semester
      }
    });
    const takenControlTypeIds = existingStudentGrades.map(g => Number(g.ControlTypeID));

    res.render('teacher/grade-form.njk', {
      title: isEdit ? 'Редагування оцінки' : 'Виставлення оцінки',
      assignment,
      student,
      semester,
      isEdit,
      gradeId,
      controlTypes,
      takenControlTypeIds,
      formData,
      errors: {}
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

// Збереження або оновлення оцінки викладачем
export const postTeacherSaveGrade = async (req, res) => {
  const assignmentId = Number(req.params.assignmentId);
  const { studentId, gradeId } = req.params;
  const { controlTypeId, assessmentDate, mark } = req.body;
  const isEdit = Boolean(gradeId);

  const errors = {};

  if (!controlTypeId || controlTypeId === '') {
    errors.controlTypeId = 'Оберіть вид семестрового контролю';
  }
  if (!assessmentDate || assessmentDate.trim() === '') {
    errors.assessmentDate = 'Вкажіть дату проведення оцінювання';
  }
  if (mark === undefined || mark === '' || isNaN(Number(mark))) {
    errors.mark = 'Введіть числове значення оцінки';
  } else {
    const numMark = Number(mark);
    if (numMark < 0 || numMark > 100) {
      errors.mark = 'Оцінка повинна бути в діапазоні від 0 до 100 балів';
    }
  }

  try {
    const assignment = await CourseAssignment.findByPk(assignmentId, {
      include: [
        { model: Group, as: 'group' },
        { model: Subject, as: 'subject' }
      ]
    });

    if (!assignment) {
      return res.status(404).render('common/error.njk', { error: 'Курс не знайдено.' });
    }

    if (req.user.role === 'teacher' && req.user.teacherId !== assignment.TeacherID) {
      return res.status(403).render('common/403.njk', { title: 'Доступ заборонено', message: 'Ви не можете виставляти оцінки для чужого курсу.' });
    }

    const semester = await Semester.findOne({
      where: {
        AcademicYear: assignment.AcademicYear,
        SemesterNumber: assignment.Semester
      }
    });

    if (req.user.role !== 'admin') {
      const today = await getAuthoritativeDateStr();
      const gradingState = getSemesterGradingState(semester, today);
      if (!gradingState.canGrade) {
        return res.status(403).render('common/403.njk', {
          title: 'Оцінювання заблоковано',
          message: gradingState.reason
        });
      }
    }

    if (semester && semester.StartDate && semester.EndDate && assessmentDate) {
      if (assessmentDate < semester.StartDate || assessmentDate > semester.EndDate) {
        errors.assessmentDate = `Дата оцінювання повинна бути в межах навчального семестру (з ${semester.StartDate} по ${semester.EndDate})`;
      }
    }

    const targetStudentId = isEdit ? (await SuccessRate.findByPk(gradeId))?.StudentID : studentId;
    const student = await Student.findByPk(targetStudentId);

    // Перевірка на дублікат оцінки з того самого виду контролю для даного студента
    if (!errors.controlTypeId && !isEdit) {
      const duplicateGrade = await SuccessRate.findOne({
        where: {
          StudentID: Number(targetStudentId),
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester,
          ControlTypeID: Number(controlTypeId)
        }
      });
      if (duplicateGrade) {
        errors.controlTypeId = 'Оцінка з цього виду контролю для обраного студента вже виставлена у відомості!';
      }
    }

    if (Object.keys(errors).length > 0) {
      const controlTypes = await ControlType.findAll({ order: [['ControlTypeName', 'ASC']] });
      const existingStudentGrades = await SuccessRate.findAll({
        where: {
          StudentID: Number(targetStudentId),
          SubjectID: assignment.SubjectID,
          AcademicYear: assignment.AcademicYear,
          Semester: assignment.Semester
        }
      });
      const takenControlTypeIds = existingStudentGrades.map(g => Number(g.ControlTypeID));

      return res.status(400).render('teacher/grade-form.njk', {
        title: isEdit ? 'Редагування оцінки' : 'Виставлення оцінки',
        assignment,
        student,
        semester,
        isEdit,
        gradeId,
        controlTypes,
        takenControlTypeIds,
        formData: req.body,
        errors
      });
    }

    if (isEdit) {
      const grade = await SuccessRate.findByPk(gradeId);
      if (!grade) {
        return res.status(404).render('common/error.njk', { error: 'Оцінку не знайдено.' });
      }
      await grade.update({
        ControlTypeID: Number(controlTypeId),
        AssessmentDate: assessmentDate,
        Mark: Number(mark)
      });
    } else {
      await SuccessRate.create({
        TeacherID: assignment.TeacherID,
        StudentID: Number(studentId),
        SubjectID: assignment.SubjectID,
        AssignmentID: assignment.AssignmentID,
        AcademicYear: assignment.AcademicYear,
        CourseYear: assignment.CourseYear,
        Semester: assignment.Semester,
        ControlTypeID: Number(controlTypeId),
        AssessmentDate: assessmentDate,
        Mark: Number(mark)
      });
    }

    return res.redirect(`/teacher/courses/${assignmentId}/students`);
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

// Видалення оцінки викладачем
export const postTeacherDeleteGrade = async (req, res) => {
  const gradeId = Number(req.params.gradeId);
  const assignmentId = req.query.assignmentId;

  try {
    const grade = await SuccessRate.findByPk(gradeId);
    if (!grade) {
      return res.status(404).render('common/error.njk', { error: 'Оцінку не знайдено.' });
    }

    if (req.user.role === 'teacher' && req.user.teacherId !== grade.TeacherID) {
      return res.status(403).render('common/403.njk', { title: 'Доступ заборонено', message: 'Викладач може видаляти лише власноруч виставлені оцінки.' });
    }

    const semester = await Semester.findOne({
      where: {
        AcademicYear: grade.AcademicYear,
        SemesterNumber: grade.Semester
      }
    });

    if (req.user.role !== 'admin') {
      const today = await getAuthoritativeDateStr();
      const gradingState = getSemesterGradingState(semester, today);
      if (!gradingState.canGrade) {
        return res.status(403).render('common/403.njk', {
          title: 'Видалення заблоковано',
          message: gradingState.reason
        });
      }
    }

    await grade.destroy();

    if (assignmentId) {
      return res.redirect(`/teacher/courses/${assignmentId}/students`);
    }
    return res.redirect('/teacher/courses');
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

// Створення курсу викладачем
export const getCreateCourseForm = async (req, res) => {
  try {
    let teacherId = req.user.teacherId;
    if (req.user.role === 'admin' && req.query.teacherId) {
      teacherId = Number(req.query.teacherId);
    }

    if (!teacherId && req.user.role !== 'admin') {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Для створення курсу необхідний профіль викладача.'
      });
    }

    // Доступні дисципліни: для викладача ТІЛЬКИ ті, до яких є схвалений доступ
    let subjects = [];
    let accessibleSubjectIds = [];

    if (req.user.role === 'admin') {
      subjects = await Subject.findAll({ order: [['SubjectName', 'ASC']] });
      accessibleSubjectIds = subjects.map(s => s.SubjectID);
    } else {
      const approvedRequests = await SubjectRequest.findAll({
        where: { TeacherID: teacherId, Status: 'approved' }
      });
      const approvedSubjectIds = approvedRequests.map(r => r.SubjectID);

      const restrictedRequests = await SubjectRequest.findAll({
        where: { TeacherID: teacherId, Status: { [Op.in]: ['restricted', 'rejected'] } }
      });
      const restrictedSubjectIds = restrictedRequests.map(r => r.SubjectID);

      const existingAssignments = await CourseAssignment.findAll({
        where: { TeacherID: teacherId },
        attributes: ['SubjectID']
      });
      const existingSubjectIds = existingAssignments.map(a => a.SubjectID);

      accessibleSubjectIds = [...new Set([...approvedSubjectIds, ...existingSubjectIds])]
        .filter(id => !restrictedSubjectIds.includes(Number(id)));

      if (accessibleSubjectIds.length > 0) {
        subjects = await Subject.findAll({
          where: { SubjectID: { [Op.in]: accessibleSubjectIds } },
          order: [['SubjectName', 'ASC']]
        });
      }
    }

    const today = await getAuthoritativeDateStr();
    const semesterWhere = {};
    if (req.user.role !== 'admin') {
      semesterWhere.Status = { [Op.ne]: 'completed' };
      semesterWhere.EndDate = { [Op.gte]: today };
    }

    const [semesters, groups, allAssignments] = await Promise.all([
      Semester.findAll({
        where: semesterWhere,
        order: [['StartDate', 'DESC']]
      }),
      Group.findAll({
        include: [{ model: Specialization, as: 'specialization' }],
        order: [['GroupName', 'ASC']]
      }),
      CourseAssignment.findAll({
        attributes: ['AssignmentID', 'GroupID', 'SubjectID', 'AcademicYear', 'Semester', 'Subgroup', 'RoleType'],
        include: [{ model: Teacher, as: 'teacher', attributes: ['FullName'] }]
      })
    ]);

    const existingAssignmentsData = allAssignments.map(a => ({
      id: Number(a.AssignmentID),
      groupId: Number(a.GroupID),
      subjectId: Number(a.SubjectID),
      academicYear: String(a.AcademicYear).trim(),
      semester: Number(a.Semester),
      subgroup: String(a.Subgroup).trim(),
      roleType: String(a.RoleType).trim(),
      teacherName: a.teacher?.FullName || ''
    }));

    const semestersData = semesters.map(s => ({
      id: Number(s.SemesterID),
      year: String(s.AcademicYear).trim(),
      num: Number(s.SemesterNumber)
    }));

    res.render('teacher/create-course.njk', {
      title: 'Створення нового навчального курсу',
      subjects,
      semesters,
      groups,
      accessibleSubjectIds,
      existingAssignmentsJSON: JSON.stringify(existingAssignmentsData),
      semestersJSON: JSON.stringify(semestersData),
      formData: {
        courseYear: 2,
        subgroup: '',
        roleType: ''
      },
      errors: {}
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postCreateCourse = async (req, res) => {
  let teacherId = req.user.teacherId;
  if (req.user.role === 'admin' && req.body.teacherId) {
    teacherId = Number(req.body.teacherId);
  }

  const { subjectId, semesterId, groupId, courseYear, subgroup, roleType } = req.body;
  const errors = {};

  const ALLOWED_ROLES = [
    'Лабораторні заняття',
    'Практичні заняття',
    'Лекційні заняття',
    'Лекції та семінари',
    'Лекції та практика',
    'Семінарські заняття'
  ];
  const ALLOWED_SUBGROUPS = ['Вся група', 'Підгрупа 1', 'Підгрупа 2'];

  // Перевірка прав викладача на дисципліну
  let accessibleSubjectIds = [];
  if (req.user.role === 'admin') {
    const allSubjects = await Subject.findAll({ attributes: ['SubjectID'] });
    accessibleSubjectIds = allSubjects.map(s => s.SubjectID);
  } else {
    const approvedRequests = await SubjectRequest.findAll({
      where: { TeacherID: teacherId, Status: 'approved' }
    });
    const approvedSubjectIds = approvedRequests.map(r => r.SubjectID);

    const restrictedRequests = await SubjectRequest.findAll({
      where: { TeacherID: teacherId, Status: { [Op.in]: ['restricted', 'rejected'] } }
    });
    const restrictedSubjectIds = restrictedRequests.map(r => r.SubjectID);

    const existingAssignments = await CourseAssignment.findAll({
      where: { TeacherID: teacherId },
      attributes: ['SubjectID']
    });
    accessibleSubjectIds = [...new Set([...approvedSubjectIds, ...existingAssignments.map(a => a.SubjectID)])]
      .filter(id => !restrictedSubjectIds.includes(Number(id)));
  }

  if (!subjectId || subjectId === '') {
    errors.subjectId = 'Оберіть навчальну дисципліну';
  } else if (req.user.role !== 'admin' && !accessibleSubjectIds.includes(Number(subjectId))) {
    const isRestricted = await SubjectRequest.findOne({
      where: { TeacherID: teacherId, SubjectID: Number(subjectId), Status: 'restricted' }
    });
    if (isRestricted) {
      errors.subjectId = 'Доступ до планування нових семестрів та курсів з цієї дисципліни було обмежено адміністрацією.';
    } else {
      errors.subjectId = 'У вас немає підтвердженого доступу до цієї дисципліни. Спочатку подайте заявку адміністрації.';
    }
  }

  let semester = null;
  if (!semesterId || semesterId === '') {
    errors.semesterId = 'Оберіть семестр зі списку';
  } else {
    semester = await Semester.findByPk(Number(semesterId));
    if (!semester) {
      errors.semesterId = 'Обраний семестр не знайдено';
    } else if (req.user.role !== 'admin') {
      const today = await getAuthoritativeDateStr();
      if (semester.Status === 'completed') {
        errors.semesterId = 'Обраний семестр вже завершено. Лише адміністратор може призначати курси у закритому періоді.';
      } else if (semester.EndDate && today > semester.EndDate) {
        errors.semesterId = `Термін семестру вже вичерпано (${semester.EndDate}). Лише адміністратор може призначати курси у завершеному періоді.`;
      }
    }
  }

  if (!groupId || groupId === '') {
    errors.groupId = 'Оберіть академічну групу';
  }
  if (!courseYear || isNaN(Number(courseYear)) || Number(courseYear) < 1 || Number(courseYear) > 6) {
    errors.courseYear = 'Вкажіть курс навчання від 1 до 6';
  }
  if (!subgroup || !ALLOWED_SUBGROUPS.includes(subgroup.trim())) {
    errors.subgroup = 'Оберіть підгрупу або розподіл навантаження зі списку';
  }
  if (!roleType || !ALLOWED_ROLES.includes(roleType.trim())) {
    errors.roleType = 'Оберіть вид навчального навантаження зі списку';
  }

  // Перевірка на дублікат закріплення курсу та конфлікти підгруп
  if (!errors.subjectId && !errors.groupId && semester && !errors.subgroup && !errors.roleType) {
    const duplicate = await CourseAssignment.findOne({
      where: {
        GroupID: Number(groupId),
        SubjectID: Number(subjectId),
        AcademicYear: semester.AcademicYear,
        Semester: semester.SemesterNumber,
        Subgroup: subgroup.trim(),
        RoleType: roleType.trim()
      },
      include: [
        { model: Teacher, as: 'teacher' },
        { model: Subject, as: 'subject' },
        { model: Group, as: 'group' }
      ]
    });

    if (duplicate) {
      errors.general = `Такий навчальний курс вже закріплено в розкладі! Дисципліну "${duplicate.subject?.SubjectName || 'предмет'}" для групи ${duplicate.group?.GroupName || ''} (${subgroup.trim()}, ${roleType.trim()}) вже веде викладач: ${duplicate.teacher?.FullName || 'інший викладач'}.`;
    }

    // Якщо користувач обирає "Вся група", але для цієї ролі вже закріплено окремі підгрупи
    if (!errors.general && subgroup.trim() === 'Вся група') {
      const splitConflict = await CourseAssignment.findOne({
        where: {
          GroupID: Number(groupId),
          SubjectID: Number(subjectId),
          AcademicYear: semester.AcademicYear,
          Semester: semester.SemesterNumber,
          RoleType: roleType.trim(),
          Subgroup: { [Op.in]: ['Підгрупа 1', 'Підгрупа 2'] }
        },
        include: [
          { model: Teacher, as: 'teacher' },
          { model: Subject, as: 'subject' },
          { model: Group, as: 'group' }
        ]
      });

      if (splitConflict) {
        errors.subgroup = `Неможливо закріпити навантаження на всю групу, оскільки для цієї дисципліни (${roleType.trim()}) група вже розділена на окремі підгрупи (закріплено: ${splitConflict.Subgroup}, викладач ${splitConflict.teacher?.FullName || ''})!`;
      }
    }

    // Якщо користувач обирає окрему підгрупу ("Підгрупа 1" або "Підгрупа 2"), але ця роль вже закріплена на весь потік ("Вся група")
    if (!errors.general && ['Підгрупа 1', 'Підгрупа 2'].includes(subgroup.trim())) {
      const wholeConflict = await CourseAssignment.findOne({
        where: {
          GroupID: Number(groupId),
          SubjectID: Number(subjectId),
          AcademicYear: semester.AcademicYear,
          Semester: semester.SemesterNumber,
          RoleType: roleType.trim(),
          Subgroup: 'Вся група'
        },
        include: [
          { model: Teacher, as: 'teacher' },
          { model: Subject, as: 'subject' }
        ]
      });

      if (wholeConflict) {
        errors.subgroup = `Неможливо закріпити окрему підгрупу, оскільки навантаження "${roleType.trim()}" уже закріплено для всієї групи разом (викладач ${wholeConflict.teacher?.FullName || ''})!`;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    let subjects = [];
    if (req.user.role === 'admin') {
      subjects = await Subject.findAll({ order: [['SubjectName', 'ASC']] });
    } else if (accessibleSubjectIds.length > 0) {
      subjects = await Subject.findAll({
        where: { SubjectID: { [Op.in]: accessibleSubjectIds } },
        order: [['SubjectName', 'ASC']]
      });
    }

    const today = await getAuthoritativeDateStr();
    const semesterWhere = {};
    if (req.user.role !== 'admin') {
      semesterWhere.Status = { [Op.ne]: 'completed' };
      semesterWhere.EndDate = { [Op.gte]: today };
    }

    const [semesters, groups, allAssignments] = await Promise.all([
      Semester.findAll({ where: semesterWhere, order: [['StartDate', 'DESC']] }),
      Group.findAll({
        include: [{ model: Specialization, as: 'specialization' }],
        order: [['GroupName', 'ASC']]
      }),
      CourseAssignment.findAll({
        attributes: ['AssignmentID', 'GroupID', 'SubjectID', 'AcademicYear', 'Semester', 'Subgroup', 'RoleType'],
        include: [{ model: Teacher, as: 'teacher', attributes: ['FullName'] }]
      })
    ]);

    const existingAssignmentsData = allAssignments.map(a => ({
      id: Number(a.AssignmentID),
      groupId: Number(a.GroupID),
      subjectId: Number(a.SubjectID),
      academicYear: String(a.AcademicYear).trim(),
      semester: Number(a.Semester),
      subgroup: String(a.Subgroup).trim(),
      roleType: String(a.RoleType).trim(),
      teacherName: a.teacher?.FullName || ''
    }));

    const semestersData = semesters.map(s => ({
      id: Number(s.SemesterID),
      year: String(s.AcademicYear).trim(),
      num: Number(s.SemesterNumber)
    }));

    return res.status(400).render('teacher/create-course.njk', {
      title: 'Створення нового навчального курсу',
      subjects,
      semesters,
      groups,
      accessibleSubjectIds,
      existingAssignmentsJSON: JSON.stringify(existingAssignmentsData),
      semestersJSON: JSON.stringify(semestersData),
      formData: req.body,
      errors
    });
  }

  try {
    if (!semester) {
      semester = await Semester.findByPk(Number(semesterId));
    }

    await CourseAssignment.create({
      GroupID: Number(groupId),
      SubjectID: Number(subjectId),
      TeacherID: teacherId,
      AcademicYear: semester.AcademicYear,
      CourseYear: Number(courseYear),
      Semester: semester.SemesterNumber,
      Subgroup: subgroup.trim(),
      RoleType: roleType.trim()
    });

    return res.redirect(`/teacher/courses?success=${encodeURIComponent('Навчальний курс успішно створено!')}`);
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

// Детальний перегляд академічної групи (список студентів та дисциплін із розмежуванням доступу)
export const getGroupDetails = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const group = await Group.findByPk(groupId, {
      include: [{ model: Specialization, as: 'specialization' }]
    });

    if (!group) {
      return res.status(404).render('common/error.njk', { error: 'Академічну групу не знайдено' });
    }

    // Студенти групи
    const students = await Student.findAll({
      where: { GroupID: groupId },
      include: [{ model: EducationForm, as: 'educationForm' }],
      order: [
        ['Subgroup', 'ASC'],
        ['FullName', 'ASC']
      ]
    });

    const subgroup1Count = students.filter(s => s.Subgroup === 'Підгрупа 1').length;
    const subgroup2Count = students.filter(s => s.Subgroup === 'Підгрупа 2').length;

    // Предмети групи з розмежуванням прав доступу:
    // Для викладача: ТІЛЬКИ дисципліни, до яких він має схвалений доступ або де сам призначений
    // Для адміністратора: всі дисципліни цієї групи
    let coursesWhere = { GroupID: groupId };

    if (req.user.role === 'teacher') {
      const teacherId = req.user.teacherId;

      const approvedRequests = await SubjectRequest.findAll({
        where: { TeacherID: teacherId, Status: 'approved' },
        attributes: ['SubjectID']
      });
      const approvedSubjectIds = approvedRequests.map(r => r.SubjectID);

      coursesWhere = {
        GroupID: groupId,
        [Op.or]: [
          { TeacherID: teacherId },
          { SubjectID: { [Op.in]: approvedSubjectIds } }
        ]
      };
    }

    const courses = await CourseAssignment.findAll({
      where: coursesWhere,
      include: [
        { model: Subject, as: 'subject' },
        { model: Teacher, as: 'teacher' }
      ],
      order: [
        ['AcademicYear', 'DESC'],
        ['Semester', 'ASC'],
        ['Subgroup', 'ASC']
      ]
    });

    res.render('teacher/group-details.njk', {
      title: `Академічна група: ${group.GroupName}`,
      group,
      students,
      courses,
      stats: {
        totalStudents: students.length,
        subgroup1Count,
        subgroup2Count,
        coursesCount: courses.length
      }
    });
  } catch (error) {
    console.error('Помилка завантаження деталей групи:', error);
    res.status(500).render('common/error.njk', { error: error.message });
  }
};
