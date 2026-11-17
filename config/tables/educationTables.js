import { CourseAssignment, SuccessRate, Subject, ControlType, Teacher, Group, Student } from '../../models/index.js';

export const educationTables = {
  course_assignments: {
    category: 'education',
    title: 'Призначення предметів викладачам',
    description: 'Закріплення навчальних предметів за викладачами та академічними групами',
    model: CourseAssignment,
    pk: 'AssignmentID',
    fields: [
      { 
        name: 'TeacherID', 
        label: 'Викладач', 
        type: 'select', 
        foreignModel: Teacher, 
        foreignPk: 'TeacherID', 
        foreignLabel: 'FullName' 
      },
      { 
        name: 'GroupID', 
        label: 'Група', 
        type: 'select', 
        foreignModel: Group, 
        foreignPk: 'GroupID', 
        foreignLabel: 'GroupName' 
      },
      { 
        name: 'SubjectID', 
        label: 'Предмет', 
        type: 'select', 
        foreignModel: Subject, 
        foreignPk: 'SubjectID', 
        foreignLabel: 'SubjectName' 
      },
      { name: 'AcademicYear', label: 'Навчальний рік', type: 'text' },
      { name: 'CourseYear', label: 'Курс (1-6)', type: 'number' },
      { name: 'Semester', label: 'Семестр (1-2)', type: 'number' },
      { name: 'Subgroup', label: 'Підгрупа / Потік', type: 'text' },
      { name: 'RoleType', label: 'Вид навантаження', type: 'text' }
    ]
  },
  success_rate: {
    category: 'education',
    title: 'Відомість успішності',
    description: 'Семестрові та підсумкові бали студентів у відомостях',
    model: SuccessRate,
    pk: 'SuccRateID',
    fields: [
      { 
        name: 'StudentID', 
        label: 'Студент', 
        type: 'select', 
        foreignModel: Student, 
        foreignPk: 'StudentID', 
        foreignLabel: 'FullName' 
      },
      { 
        name: 'TeacherID', 
        label: 'Викладач', 
        type: 'select', 
        foreignModel: Teacher, 
        foreignPk: 'TeacherID', 
        foreignLabel: 'FullName' 
      },
      { 
        name: 'SubjectID', 
        label: 'Предмет', 
        type: 'select', 
        foreignModel: Subject, 
        foreignPk: 'SubjectID', 
        foreignLabel: 'SubjectName' 
      },
      { name: 'AcademicYear', label: 'Навчальний рік', type: 'text' },
      { name: 'CourseYear', label: 'Курс', type: 'number' },
      { name: 'Semester', label: 'Семестр', type: 'number' },
      { 
        name: 'ControlTypeID', 
        label: 'Вид контролю', 
        type: 'select', 
        foreignModel: ControlType, 
        foreignPk: 'ControlTypeID', 
        foreignLabel: 'ControlTypeName' 
      },
      { name: 'AssessmentDate', label: 'Дата оцінювання', type: 'date' },
      { name: 'Mark', label: 'Оцінка (0-100)', type: 'number' }
    ]
  },
  subjects: {
    category: 'education',
    title: 'Предмети (Дисципліни)',
    description: 'Перелік навчальних дисциплін освітніх програм',
    model: Subject,
    pk: 'SubjectID',
    fields: [
      { name: 'SubjectName', label: 'Назва предмета', type: 'text' }
    ]
  },
  control_types: {
    category: 'education',
    title: 'Види контролю',
    description: 'Види семестрового контролю (іспит, залік, диф. залік)',
    model: ControlType,
    pk: 'ControlTypeID',
    fields: [
      { name: 'ControlTypeName', label: 'Назва виду контролю', type: 'text' }
    ]
  }
};
