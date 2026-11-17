import { 
  Department, Group, EducationForm, Specialization, 
  Teacher, Student, Subject, ControlType, SuccessRate,
  CourseAssignment, User, Semester, SubjectRequest, CourseInvitation
} from '../models/index.js';

export const tableConfig = {
  // Навчальний процес
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
      { 
        name: 'Subgroup', 
        label: 'Підгрупа / Потік', 
        type: 'select',
        options: [
          { value: 'Вся група', label: 'Вся група' },
          { value: 'Підгрупа 1', label: 'Підгрупа 1' },
          { value: 'Підгрупа 2', label: 'Підгрупа 2' }
        ]
      },
      { 
        name: 'RoleType', 
        label: 'Вид навантаження', 
        type: 'select',
        options: [
          { value: 'Лекційні заняття', label: 'Лекційні заняття' },
          { value: 'Лабораторні заняття', label: 'Лабораторні заняття' },
          { value: 'Практичні заняття', label: 'Практичні заняття' },
          { value: 'Лекції та семінари', label: 'Лекції та семінари' },
          { value: 'Лекції та практика', label: 'Лекції та практика' },
          { value: 'Семінарські заняття', label: 'Семінарські заняття' }
        ]
      }
    ]
  },
  semesters: {
    category: 'education',
    title: 'Семестри (Навчальні періоди)',
    description: 'Планування та графік семестрів: дати початку, закриття та статус',
    model: Semester,
    pk: 'SemesterID',
    fields: [
      { name: 'AcademicYear', label: 'Навчальний рік', type: 'text' },
      { name: 'SemesterNumber', label: 'Семестр (1-2)', type: 'number' },
      { name: 'Name', label: 'Назва семестру', type: 'text' },
      { name: 'StartDate', label: 'Дата початку', type: 'date' },
      { name: 'EndDate', label: 'Дата закриття', type: 'date' },
      {
        name: 'Status',
        label: 'Статус семестру',
        type: 'select',
        options: [
          { value: 'planned', label: 'Заплановано' },
          { value: 'active', label: 'Виконується / Триває' },
          { value: 'completed', label: 'Завершено / Закрито' }
        ]
      },
      {
        name: 'CreatedByTeacherID',
        label: 'Ініціатор (Викладач)',
        type: 'select',
        foreignModel: Teacher,
        foreignPk: 'TeacherID',
        foreignLabel: 'FullName'
      }
    ]
  },
  subject_requests: {
    category: 'education',
    title: 'Заявки викладачів на предмети',
    description: 'Запити на закріплення та викладання навчальних дисциплін',
    model: SubjectRequest,
    pk: 'RequestID',
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
        name: 'SubjectID',
        label: 'Дисципліна',
        type: 'select',
        foreignModel: Subject,
        foreignPk: 'SubjectID',
        foreignLabel: 'SubjectName'
      },
      {
        name: 'Status',
        label: 'Статус розгляду',
        type: 'select',
        options: [
          { value: 'pending', label: 'Очікує розгляду' },
          { value: 'approved', label: 'Схвалено' },
          { value: 'rejected', label: 'Відхилено' },
          { value: 'restricted', label: 'Обмежено (без нових семестрів)' }
        ]
      },
      { name: 'Comment', label: 'Обґрунтування викладача', type: 'text' },
      { name: 'AdminComment', label: 'Рішення адміністратора', type: 'text' }
    ]
  },
  course_invitations: {
    category: 'education',
    title: 'Запрошення викладачів до курсів',
    description: 'Запрошення колег до спільного ведення курсів та розподілу підгруп',
    model: CourseInvitation,
    pk: 'InvitationID',
    fields: [
      {
        name: 'AssignmentID',
        label: 'ID закріплення курсу',
        type: 'number'
      },
      {
        name: 'SenderTeacherID',
        label: 'Хто запросив',
        type: 'select',
        foreignModel: Teacher,
        foreignPk: 'TeacherID',
        foreignLabel: 'FullName'
      },
      {
        name: 'ReceiverTeacherID',
        label: 'Запрошений викладач',
        type: 'select',
        foreignModel: Teacher,
        foreignPk: 'TeacherID',
        foreignLabel: 'FullName'
      },
      { 
        name: 'RoleType', 
        label: 'Вид навантаження', 
        type: 'select',
        options: [
          { value: 'Лабораторні заняття', label: 'Лабораторні заняття' },
          { value: 'Практичні заняття', label: 'Практичні заняття' },
          { value: 'Лекційні заняття', label: 'Лекційні заняття' },
          { value: 'Лекції та семінари', label: 'Лекції та семінари' },
          { value: 'Лекції та практика', label: 'Лекції та практика' },
          { value: 'Семінарські заняття', label: 'Семінарські заняття' }
        ]
      },
      { 
        name: 'Subgroup', 
        label: 'Підгрупа', 
        type: 'select',
        options: [
          { value: 'Підгрупа 1', label: 'Підгрупа 1' },
          { value: 'Підгрупа 2', label: 'Підгрупа 2' },
          { value: 'Вся група', label: 'Вся група' }
        ]
      },
      {
        name: 'Status',
        label: 'Статус запрошення',
        type: 'select',
        options: [
          { value: 'pending', label: 'Очікує відповіді' },
          { value: 'accepted', label: 'Прийнято' },
          { value: 'declined', label: 'Відхилено' }
        ]
      },
      { name: 'Message', label: 'Повідомлення колезі', type: 'text' }
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
  },

  // Структура та контингент
  students: {
    category: 'structure',
    title: 'Студенти',
    description: 'Контингент студентів, академічні групи та підгрупи',
    model: Student,
    pk: 'StudentID',
    fields: [
      { name: 'FullName', label: 'ПІБ студента', type: 'text' },
      { 
        name: 'DepartmentID', 
        label: 'Кафедра', 
        type: 'select', 
        foreignModel: Department, 
        foreignPk: 'DepartmentID', 
        foreignLabel: 'AbbreviatedName' 
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
        name: 'FormID', 
        label: 'Форма навчання', 
        type: 'select', 
        foreignModel: EducationForm, 
        foreignPk: 'FormID', 
        foreignLabel: 'FormName' 
      },
      { 
        name: 'Subgroup', 
        label: 'Підгрупа', 
        type: 'select',
        options: [
          { value: 'Підгрупа 1', label: 'Підгрупа 1' },
          { value: 'Підгрупа 2', label: 'Підгрупа 2' }
        ]
      },
      { name: 'Birth_Date', label: 'Дата народження', type: 'date' },
      { name: 'Email', label: 'Email', type: 'text' },
      { name: 'Phone', label: 'Телефон', type: 'text' }
    ]
  },
  teachers: {
    category: 'structure',
    title: 'Викладачі',
    description: 'Науково-педагогічний склад та кафедральна приналежність',
    model: Teacher,
    pk: 'TeacherID',
    fields: [
      { name: 'FullName', label: 'ПІБ викладача', type: 'text' },
      { 
        name: 'DepartmentID', 
        label: 'Кафедра', 
        type: 'select', 
        foreignModel: Department, 
        foreignPk: 'DepartmentID', 
        foreignLabel: 'AbbreviatedName' 
      },
      { name: 'Degree', label: 'Вчений ступінь / Посада', type: 'text' },
      { name: 'Birth_Date', label: 'Дата народження', type: 'date' },
      { name: 'HireDate', label: 'Дата найму', type: 'date' },
      { name: 'Email', label: 'Email', type: 'text' },
      { name: 'Phone', label: 'Телефон', type: 'text' }
    ]
  },
  groups: {
    category: 'structure',
    title: 'Академічні групи',
    description: 'Академічні студентські групи та закріплені спеціальності',
    model: Group,
    pk: 'GroupID',
    fields: [
      { name: 'GroupName', label: 'Шифр групи', type: 'text' },
      { 
        name: 'SpecID', 
        label: 'Спеціальність', 
        type: 'select', 
        foreignModel: Specialization, 
        foreignPk: 'SpecID', 
        foreignLabel: 'SpecName' 
      },
      { name: 'StartYear', label: 'Рік вступу', type: 'number' },
      { name: 'ReleaseYear', label: 'Рік випуску', type: 'number' }
    ]
  },
  departments: {
    category: 'structure',
    title: 'Кафедри / Факультети',
    description: 'Факультети, кафедри та навчально-наукові підрозділи',
    model: Department,
    pk: 'DepartmentID',
    fields: [
      { name: 'FullName', label: 'Повна назва', type: 'text' },
      { name: 'AbbreviatedName', label: 'Скорочена назва', type: 'text' }
    ]
  },
  specializations: {
    category: 'structure',
    title: 'Спеціальності',
    description: 'Напрями та спеціальності вищої освіти',
    model: Specialization,
    pk: 'SpecID',
    fields: [
      { name: 'SpecName', label: 'Назва спеціальності', type: 'text' }
    ]
  },
  education_forms: {
    category: 'structure',
    title: 'Форми навчання',
    description: 'Організаційні форми здобуття вищої освіти',
    model: EducationForm,
    pk: 'FormID',
    fields: [
      { name: 'FormName', label: 'Форма навчання', type: 'text' }
    ]
  },

  // Безпека
  users: {
    category: 'security',
    title: 'Облікові записи',
    description: 'Автентифікація, системні ролі та права доступу користувачів',
    model: User,
    pk: 'id',
    fields: [
      { name: 'username', label: 'Логін', type: 'text' },
      { name: 'fullName', label: 'Повне ім\'я', type: 'text' },
      { 
        name: 'role', 
        label: 'Роль', 
        type: 'select',
        options: [
          { value: 'admin', label: 'Адміністратор' },
          { value: 'teacher', label: 'Викладач' },
          { value: 'visitor', label: 'Студент (відвідувач)' }
        ]
      },
      { name: 'password', label: 'Новий пароль (залиште порожнім, щоб не змінювати)', type: 'password' }
    ]
  }
};
