import { 
  Student, 
  Group, 
  Department, 
  Specialization, 
  EducationForm, 
  CourseAssignment, 
  Subject, 
  Teacher, 
  SuccessRate, 
  ControlType 
} from '../models/index.js';

export const getStudentProfile = async (req, res) => {
  try {
    let studentId = req.user.studentId;

    // Якщо адмін або викладач переглядає профіль конкретного студента
    if ((req.user.role === 'admin' || req.user.role === 'teacher') && req.params.id) {
      studentId = Number(req.params.id);
    }

    if (!studentId) {
      return res.status(403).render('common/403.njk', {
        title: 'Доступ обмежено',
        message: 'Обліковий запис не прив\'язаний до профілю студента.'
      });
    }

    const student = await Student.findByPk(studentId, {
      include: [
        {
          model: Group,
          as: 'group',
          include: [{ model: Specialization, as: 'specialization' }]
        },
        { model: Department, as: 'department' },
        { model: EducationForm, as: 'educationForm' }
      ]
    });

    if (!student) {
      return res.status(404).render('common/error.njk', { error: 'Профіль студента не знайдено.' });
    }

    // Отримуємо всі оцінки студента за весь час навчання
    const grades = await SuccessRate.findAll({
      where: { StudentID: studentId },
      include: [
        { model: Subject, as: 'subject' },
        { model: Teacher, as: 'teacher' },
        { model: ControlType, as: 'controlType' }
      ],
      order: [
        ['AcademicYear', 'ASC'],
        ['CourseYear', 'ASC'],
        ['Semester', 'ASC'],
        ['AssessmentDate', 'ASC']
      ]
    });

    // Отримуємо всі призначені курси для групи студента (навчальний план)
    const assignments = await CourseAssignment.findAll({
      where: { GroupID: student.GroupID },
      include: [
        { model: Subject, as: 'subject' },
        { model: Teacher, as: 'teacher' }
      ],
      order: [
        ['AcademicYear', 'ASC'],
        ['CourseYear', 'ASC'],
        ['Semester', 'ASC']
      ]
    });

    // Групуємо предмети та оцінки за навчальними роками і семестрами
    const curriculumHistory = {};

    // 1. Спочатку заповнюємо з курсів групи
    for (const a of assignments) {
      const yearKey = a.AcademicYear;
      if (!curriculumHistory[yearKey]) {
        curriculumHistory[yearKey] = {
          academicYear: yearKey,
          semesters: {}
        };
      }

      const semKey = `Курс ${a.CourseYear}, Семестр ${a.Semester}`;
      if (!curriculumHistory[yearKey].semesters[semKey]) {
        curriculumHistory[yearKey].semesters[semKey] = {
          title: semKey,
          courseYear: a.CourseYear,
          semester: a.Semester,
          subjects: {}
        };
      }

      const subjId = a.SubjectID;
      if (!curriculumHistory[yearKey].semesters[semKey].subjects[subjId]) {
        curriculumHistory[yearKey].semesters[semKey].subjects[subjId] = {
          subjectName: a.subject.SubjectName,
          teachers: [],
          grade: null
        };
      }

      curriculumHistory[yearKey].semesters[semKey].subjects[subjId].teachers.push({
        teacherName: a.teacher.FullName,
        subgroup: a.Subgroup,
        roleType: a.RoleType
      });
    }

    // 2. Додаємо/підставляємо оцінки студента
    let totalMarks = 0;
    let marksCount = 0;

    for (const g of grades) {
      const yearKey = g.AcademicYear;
      if (!curriculumHistory[yearKey]) {
        curriculumHistory[yearKey] = {
          academicYear: yearKey,
          semesters: {}
        };
      }

      const semKey = `Курс ${g.CourseYear}, Семестр ${g.Semester}`;
      if (!curriculumHistory[yearKey].semesters[semKey]) {
        curriculumHistory[yearKey].semesters[semKey] = {
          title: semKey,
          courseYear: g.CourseYear,
          semester: g.Semester,
          subjects: {}
        };
      }

      const subjId = g.SubjectID;
      if (!curriculumHistory[yearKey].semesters[semKey].subjects[subjId]) {
        curriculumHistory[yearKey].semesters[semKey].subjects[subjId] = {
          subjectName: g.subject.SubjectName,
          teachers: [{ teacherName: g.teacher.FullName, subgroup: 'Вся група', roleType: 'Викладач' }],
          grade: null
        };
      }

      curriculumHistory[yearKey].semesters[semKey].subjects[subjId].grade = {
        mark: g.Mark,
        controlType: g.controlType ? g.controlType.ControlTypeName : 'Контроль',
        assessmentDate: g.AssessmentDate,
        teacherName: g.teacher.FullName
      };

      totalMarks += g.Mark;
      marksCount += 1;
    }

    const averageGrade = marksCount > 0 ? (totalMarks / marksCount).toFixed(1) : null;

    res.render('student/profile.njk', {
      title: `Профіль студента: ${student.FullName}`,
      student,
      curriculumHistory,
      gradesCount: marksCount,
      averageGrade
    });
  } catch (error) {
    console.error('Помилка отримання профілю студента:', error);
    res.status(500).render('common/error.njk', { error: error.message });
  }
};
