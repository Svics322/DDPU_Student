import { Student, Teacher, Group, Department, Specialization, EducationForm } from '../../models/index.js';

export const structureTables = {
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
      { name: 'Subgroup', label: 'Підгрупа', type: 'text' },
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
  }
};
