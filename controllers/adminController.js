import { Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import { tableConfig } from '../config/tableConfig.js';
import { checkEntityRelations } from '../services/relationService.js';
import { getCurrentDateStr } from '../utils/semesterHelper.js';
import { 
  Teacher, 
  Department, 
  Student, 
  Group, 
  Subject, 
  SuccessRate, 
  User,
  CourseAssignment,
  Semester,
  SubjectRequest,
  CourseInvitation,
  ControlType
} from '../models/index.js';

// Допоміжна функція перекладу помилок Sequelize
const translateErrors = (error, config) => {
  const fieldErrors = {};

  if (!error.errors || !Array.isArray(error.errors)) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return { _global: 'Помилка зовнішнього ключа: вказаний зв\'язаний запис не існує або на нього посилаються інші дані.' };
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      return { _global: 'Запис з таким унікальним значенням вже існує в системі.' };
    }
    return { _global: error.message || 'Сталася помилка збереження даних.' };
  }

  error.errors.forEach(err => {
    const fieldConfig = config.fields.find(f => f.name === err.path);
    const label = fieldConfig ? fieldConfig.label : err.path;
    let msg = `Некоректне значення у полі "${label}".`;

    switch (err.validatorKey) {
      case 'is_null':
      case 'notNull':
        msg = `Поле "${label}" обов'язкове для заповнення.`;
        break;
      case 'len':
        msg = `Довжина поля "${label}" не відповідає вимогам.`;
        break;
      case 'isEmail':
        msg = `Введіть коректну адресу електронної пошти.`;
        break;
      case 'min':
        msg = `Значення поля "${label}" занадто мале.`;
        break;
      case 'max':
        msg = `Значення поля "${label}" перевищує допустимий ліміт.`;
        break;
      case 'isIn':
        msg = `Оберіть одне із запропонованих значень.`;
        break;
    }

    if (!fieldErrors[err.path]) {
      fieldErrors[err.path] = msg;
    }
  });

  return fieldErrors;
};

// Завантаження опцій для полів select
const getSelectOptions = async (fields) => {
  const optionsMap = {};
  for (const field of fields) {
    if (field.type === 'select') {
      if (field.foreignModel) {
        const items = await field.foreignModel.findAll({ raw: true });
        optionsMap[field.name] = items.map(item => ({
          value: item[field.foreignPk],
          label: item[field.foreignLabel] || item[field.foreignPk]
        }));
      } else if (field.options) {
        optionsMap[field.name] = field.options;
      }
    }
  }
  return optionsMap;
};

export const getAdminDashboard = async (req, res) => {
  try {
    const [
      studentsCount,
      teachersCount,
      groupsCount,
      subjectsCount,
      gradesCount
    ] = await Promise.all([
      Student.count(),
      Teacher.count(),
      Group.count(),
      Subject.count(),
      SuccessRate.count()
    ]);

    const categories = {
      education: [],
      structure: [],
      security: []
    };

    for (const [key, config] of Object.entries(tableConfig)) {
      const count = await config.model.count();
      const item = {
        key,
        title: config.title,
        description: config.description || 'Керування даними розділу',
        count
      };
      if (categories[config.category]) {
        categories[config.category].push(item);
      }
    }

    res.render('admin/dashboard.njk', {
      title: 'Панель керування системою',
      stats: {
        studentsCount,
        teachersCount,
        groupsCount,
        subjectsCount,
        gradesCount
      },
      categories
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

// Функція формування зрозумілої людині назви запису для модальних вікон і заголовків
export const getItemDisplayName = (tableName, item) => {
  switch (tableName) {
    case 'students':
      return `Студент: ${item.FullName || ('ID ' + item.StudentID)}`;
    case 'teachers':
      return `Викладач: ${item.FullName || ('ID ' + item.TeacherID)}`;
    case 'groups':
      return `Група: ${item.GroupName || ('ID ' + item.GroupID)}`;
    case 'subjects':
      return `Предмет: ${item.SubjectName || ('ID ' + item.SubjectID)}`;
    case 'departments':
      return `Кафедра/Факультет: ${item.FullName || item.AbbreviatedName || ('ID ' + item.DepartmentID)}`;
    case 'specializations':
      return `Спеціальність: ${item.SpecName || ('ID ' + item.SpecID)}`;
    case 'education_forms':
      return `Форма навчання: ${item.FormName || ('ID ' + item.FormID)}`;
    case 'control_types':
      return `Вид контролю: ${item.ControlTypeName || ('ID ' + item.ControlTypeID)}`;
    case 'users':
      return `Користувач: ${item.fullName ? (item.fullName + ' (' + item.username + ')') : item.username}`;
    case 'course_assignments':
      return `Курс: ${item.SubjectID} (${item.GroupID}, ${item.TeacherID})`;
    case 'semesters':
      return `Семестр: ${item.Name || (item.AcademicYear + ', сем. ' + item.SemesterNumber)}`;
    case 'subject_requests':
      return `Заявка на предмет: ${item.SubjectID_label || item.SubjectID} (${item.TeacherID_label || item.TeacherID})`;
    case 'course_invitations':
      return `Запрошення: на курс #${item.AssignmentID}`;
    case 'success_rate':
      return `Оцінка: ${item.StudentID} — ${item.SubjectID} (${item.Mark} б.)`;
    default:
      return `${item.FullName || item.name || ('Запис #' + (item.id || item[Object.keys(item)[0]]))}`;
  }
};

export const getAdminTableRecords = async (req, res) => {
  const { tableName } = req.params;
  const config = tableConfig[tableName];

  if (!config) {
    return res.status(404).render('common/error.njk', { error: 'Розділ даних не знайдено.' });
  }

  try {
    const records = await config.model.findAll({ raw: true });
    const selectOptions = await getSelectOptions(config.fields);

    const formattedRecords = records.map(record => {
      const item = { ...record };
      config.fields.forEach(field => {
        if (field.type === 'select' && selectOptions[field.name]) {
          const opt = selectOptions[field.name].find(
            o => String(o.value) === String(record[field.name])
          );
          item[field.name] = opt ? opt.label : (record[field.name] ?? '—');
        }
      });
      item._displayName = getItemDisplayName(tableName, item);
      return item;
    });

    res.render('admin/table-records.njk', {
      title: config.title,
      tableName,
      config,
      records: formattedRecords
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const checkSuccessRateDuplicate = async (req, res) => {
  try {
    const { studentId, subjectId, controlTypeId, academicYear, semester, excludeId } = req.query;

    if (!studentId || !subjectId || !controlTypeId || !academicYear || !semester) {
      return res.json({ exists: false });
    }

    const whereCond = {
      StudentID: Number(studentId),
      SubjectID: Number(subjectId),
      ControlTypeID: Number(controlTypeId),
      AcademicYear: String(academicYear).trim(),
      Semester: Number(semester)
    };

    if (excludeId && !isNaN(Number(excludeId))) {
      whereCond.SuccRateID = { [Op.ne]: Number(excludeId) };
    }

    const existing = await SuccessRate.findOne({
      where: whereCond,
      include: [
        { model: Teacher, as: 'teacher' },
        { model: Subject, as: 'subject' },
        { model: Student, as: 'student' },
        { model: ControlType, as: 'controlType' }
      ]
    });

    if (existing) {
      return res.json({
        exists: true,
        record: {
          succRateId: existing.SuccRateID,
          mark: existing.Mark,
          assessmentDate: existing.AssessmentDate,
          teacherName: existing.teacher?.FullName || 'Не вказано',
          studentName: existing.student?.FullName || 'Не вказано',
          subjectName: existing.subject?.SubjectName || 'Не вказано',
          controlTypeName: existing.controlType?.ControlTypeName || 'Не вказано',
          academicYear: existing.AcademicYear,
          semester: existing.Semester
        }
      });
    }

    return res.json({ exists: false });
  } catch (error) {
    console.error('Помилка перевірки дублікатів оцінок:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getAdminForm = async (req, res) => {
  const { tableName, id } = req.params;
  const config = tableConfig[tableName];

  if (!config) {
    return res.status(404).render('common/error.njk', { error: 'Розділ даних не знайдено.' });
  }

  const isEdit = Boolean(id);
  let itemData = {};
  let itemTitle = null;

  try {
    const selectOptions = await getSelectOptions(config.fields);

    if (isEdit) {
      const record = await config.model.findByPk(id);
      if (!record) {
        return res.status(404).render('common/error.njk', { error: 'Запис не знайдено.' });
      }
      itemData = record.toJSON();
      if (itemData.password) {
        itemData.password = ''; // не передаємо хеш у форму
      }

      const formattedItem = { ...itemData };
      config.fields.forEach(field => {
        if (field.type === 'select' && selectOptions[field.name]) {
          const opt = selectOptions[field.name].find(
            o => String(o.value) === String(formattedItem[field.name])
          );
          if (opt) formattedItem[field.name] = opt.label;
        }
      });
      itemTitle = getItemDisplayName(tableName, formattedItem);
    }

    if (tableName === 'success_rate') {
      const [groups, allStudents, allSemesters, allAssignments, allSubjects, allTeachers, controlTypes] = await Promise.all([
        Group.findAll({ order: [['GroupName', 'ASC']] }),
        Student.findAll({
          order: [['FullName', 'ASC']],
          attributes: ['StudentID', 'GroupID', 'FullName', 'Subgroup']
        }),
        Semester.findAll({
          order: [['AcademicYear', 'DESC'], ['SemesterNumber', 'ASC']]
        }),
        CourseAssignment.findAll({
          include: [
            { model: Subject, as: 'subject' },
            { model: Teacher, as: 'teacher' },
            { model: Group, as: 'group' }
          ]
        }),
        Subject.findAll({ order: [['SubjectName', 'ASC']] }),
        Teacher.findAll({ order: [['FullName', 'ASC']] }),
        ControlType.findAll({ order: [['ControlTypeName', 'ASC']] })
      ]);

      let selectedGroupId = '';
      if (isEdit && itemData.StudentID) {
        const student = await Student.findByPk(itemData.StudentID);
        if (student) {
          selectedGroupId = String(student.GroupID);
        }
      }

      return res.render('admin/success-rate-form.njk', {
        title: isEdit ? 'Редагування оцінки у відомості' : 'Створення нового запису у відомості',
        tableName,
        config,
        isEdit,
        id,
        itemData,
        selectedGroupId,
        groups,
        allStudents,
        allSemesters,
        allAssignments,
        allSubjects,
        allTeachers,
        controlTypes,
        fieldErrors: {}
      });
    }

    res.render('admin/form.njk', {
      title: isEdit ? `Редагування: ${config.title}` : `Створення: ${config.title}`,
      tableName,
      config,
      isEdit,
      id,
      itemData,
      itemTitle,
      selectOptions,
      fieldErrors: {}
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postAdminSave = async (req, res) => {
  const { tableName, id } = req.params;
  const config = tableConfig[tableName];

  if (!config) {
    return res.status(404).render('common/error.njk', { error: 'Розділ даних не знайдено.' });
  }

  const isEdit = Boolean(id);
  const formData = { ...req.body };

  // Очищення порожніх рядків у null
  Object.keys(formData).forEach(key => {
    if (formData[key] === '' || formData[key] === undefined) {
      formData[key] = null;
    }
  });

  // Обробка пароля для користувачів
  if (tableName === 'users') {
    if (formData.password && formData.password.trim() !== '') {
      formData.password = await bcrypt.hash(formData.password.trim(), 10);
    } else if (isEdit) {
      delete formData.password; // не оновлюємо, якщо поле порожнє
    }
  }

  // Швидке оновлення наявної оцінки при підтвердженні адміністратором у модальному вікні
  if (tableName === 'success_rate' && formData.confirmOverwrite === 'true' && formData.existingSuccRateId) {
    const existingRec = await SuccessRate.findByPk(formData.existingSuccRateId);
    if (existingRec) {
      await existingRec.update({
        Mark: Number(formData.Mark),
        AssessmentDate: formData.AssessmentDate || getCurrentDateStr(),
        TeacherID: Number(formData.TeacherID),
        CourseYear: Number(formData.CourseYear) || existingRec.CourseYear
      });
      return res.redirect('/admin/tables/success_rate');
    }
  }

  // Захист від дублікатів та взаємовиключних конфліктів для всіх сутностей системи
  const customErrors = {};

  if (tableName === 'success_rate') {
    if (!formData.GroupID) {
      customErrors.GroupID = 'Оберіть академічну групу зі списку';
    }
    if (!formData.StudentID) {
      customErrors.StudentID = 'Оберіть студента зі списку';
    }
    if (!formData.SubjectID) {
      customErrors.SubjectID = 'Оберіть навчальну дисципліну зі списку';
    }
    if (!formData.TeacherID) {
      customErrors.TeacherID = 'Оберіть викладача зі списку';
    }
    if (!formData.ControlTypeID) {
      customErrors.ControlTypeID = 'Оберіть вид семестрового контролю зі списку';
    }
    if (!formData.AcademicYear || formData.AcademicYear.trim() === '') {
      customErrors.AcademicYear = 'Вкажіть навчальний рік';
    }
    if (!formData.CourseYear || isNaN(Number(formData.CourseYear)) || Number(formData.CourseYear) < 1 || Number(formData.CourseYear) > 6) {
      customErrors.CourseYear = 'Курс повинен бути числом від 1 до 6';
    }
    if (!formData.Semester || ![1, 2].includes(Number(formData.Semester))) {
      customErrors.Semester = 'Семестр повинен бути 1 або 2';
    }
    if (!formData.AssessmentDate) {
      customErrors.AssessmentDate = 'Вкажіть дату оцінювання';
    } else if (formData.AcademicYear && formData.Semester) {
      const semObj = await Semester.findOne({
        where: {
          AcademicYear: formData.AcademicYear.trim(),
          SemesterNumber: Number(formData.Semester)
        }
      });
      if (semObj && semObj.StartDate && semObj.EndDate) {
        if (formData.AssessmentDate < semObj.StartDate || formData.AssessmentDate > semObj.EndDate) {
          customErrors.AssessmentDate = `Дата оцінювання (${formData.AssessmentDate}) повинна бути в межах навчального семестру (з ${semObj.StartDate} по ${semObj.EndDate})!`;
        }
      }
    }
    if (formData.Mark === null || formData.Mark === undefined || formData.Mark === '' || isNaN(Number(formData.Mark)) || Number(formData.Mark) < 0 || Number(formData.Mark) > 100) {
      customErrors.Mark = 'Оцінка повинна бути числом від 0 до 100';
    }

    if (!customErrors.StudentID && !customErrors.SubjectID && !customErrors.ControlTypeID && !customErrors.AcademicYear && !customErrors.Semester) {
      const dupWhere = {
        StudentID: Number(formData.StudentID),
        SubjectID: Number(formData.SubjectID),
        ControlTypeID: Number(formData.ControlTypeID),
        AcademicYear: formData.AcademicYear.trim(),
        Semester: Number(formData.Semester)
      };
      if (isEdit) {
        dupWhere.SuccRateID = { [Op.ne]: Number(id) };
      }
      const dup = await SuccessRate.findOne({
        where: dupWhere,
        include: [
          { model: Teacher, as: 'teacher' },
          { model: Subject, as: 'subject' },
          { model: Student, as: 'student' },
          { model: ControlType, as: 'controlType' }
        ]
      });
      if (dup) {
        customErrors._global = `Для студента ${dup.student?.FullName || ''} вже внесено оцінку (${dup.Mark} балів) з дисципліни "${dup.subject?.SubjectName || ''}" (${dup.controlType?.ControlTypeName || ''}) у ${formData.Semester} семестрі!`;
        customErrors.existingDuplicate = {
          succRateId: dup.SuccRateID,
          mark: dup.Mark,
          assessmentDate: dup.AssessmentDate,
          teacherName: dup.teacher?.FullName || '',
          studentName: dup.student?.FullName || '',
          subjectName: dup.subject?.SubjectName || '',
          controlTypeName: dup.controlType?.ControlTypeName || '',
          academicYear: dup.AcademicYear,
          semester: dup.Semester,
          newMark: formData.Mark
        };
      }
    }
  } else if (tableName === 'course_assignments' && formData.GroupID && formData.SubjectID && formData.Semester && formData.RoleType && formData.Subgroup) {
    const whereCond = {
      GroupID: Number(formData.GroupID),
      SubjectID: Number(formData.SubjectID),
      AcademicYear: formData.AcademicYear,
      Semester: Number(formData.Semester),
      RoleType: formData.RoleType,
      Subgroup: formData.Subgroup
    };
    if (isEdit) whereCond.AssignmentID = { [Op.ne]: Number(id) };

    const dup = await CourseAssignment.findOne({ where: whereCond });
    if (dup) {
      customErrors.Subgroup = 'Таке закріплення навантаження (роль + підгрупа) вже існує в розкладі!';
    }

    if (!customErrors.Subgroup && formData.Subgroup === 'Вся група') {
      const splitWhere = {
        GroupID: Number(formData.GroupID),
        SubjectID: Number(formData.SubjectID),
        AcademicYear: formData.AcademicYear,
        Semester: Number(formData.Semester),
        RoleType: formData.RoleType,
        Subgroup: { [Op.in]: ['Підгрупа 1', 'Підгрупа 2'] }
      };
      if (isEdit) splitWhere.AssignmentID = { [Op.ne]: Number(id) };
      const split = await CourseAssignment.findOne({ where: splitWhere });
      if (split) {
        customErrors.Subgroup = 'Неможливо призначити на всю групу: навантаження вже розділене на окремі підгрупи!';
      }
    }

    if (!customErrors.Subgroup && ['Підгрупа 1', 'Підгрупа 2'].includes(formData.Subgroup)) {
      const wholeWhere = {
        GroupID: Number(formData.GroupID),
        SubjectID: Number(formData.SubjectID),
        AcademicYear: formData.AcademicYear,
        Semester: Number(formData.Semester),
        RoleType: formData.RoleType,
        Subgroup: 'Вся група'
      };
      if (isEdit) wholeWhere.AssignmentID = { [Op.ne]: Number(id) };
      const whole = await CourseAssignment.findOne({ where: wholeWhere });
      if (whole) {
        customErrors.Subgroup = 'Неможливо призначити окрему підгрупу: навантаження вже закріплене на всю групу разом!';
      }
    }
  } else if (tableName === 'semesters') {
    if (formData.StartDate && formData.EndDate && new Date(formData.StartDate) >= new Date(formData.EndDate)) {
      customErrors.EndDate = 'Дата закриття повинна бути пізнішою за дату початку!';
    }
    if (formData.AcademicYear && formData.SemesterNumber) {
      const whereCond = {
        AcademicYear: formData.AcademicYear.trim(),
        SemesterNumber: Number(formData.SemesterNumber)
      };
      if (isEdit) whereCond.SemesterID = { [Op.ne]: Number(id) };
      const dup = await Semester.findOne({ where: whereCond });
      if (dup) {
        customErrors.SemesterNumber = `Семестр ${formData.SemesterNumber} для ${formData.AcademicYear.trim()} вже існує!`;
      }
    }
  } else if (tableName === 'students') {
    if (formData.Email) {
      const whereEmail = { Email: formData.Email.trim() };
      if (isEdit) whereEmail.StudentID = { [Op.ne]: Number(id) };
      const dup = await Student.findOne({ where: whereEmail });
      if (dup) customErrors.Email = 'Студент з такою електронною поштою вже зареєстрований!';
    }
    if (formData.Phone) {
      const wherePhone = { Phone: formData.Phone.trim() };
      if (isEdit) wherePhone.StudentID = { [Op.ne]: Number(id) };
      const dup = await Student.findOne({ where: wherePhone });
      if (dup) customErrors.Phone = 'Студент з таким номером телефону вже існує!';
    }
  } else if (tableName === 'teachers') {
    if (formData.Email) {
      const whereEmail = { Email: formData.Email.trim() };
      if (isEdit) whereEmail.TeacherID = { [Op.ne]: Number(id) };
      const dup = await Teacher.findOne({ where: whereEmail });
      if (dup) customErrors.Email = 'Викладач з такою електронною поштою вже зареєстрований!';
    }
    if (formData.Phone) {
      const wherePhone = { Phone: formData.Phone.trim() };
      if (isEdit) wherePhone.TeacherID = { [Op.ne]: Number(id) };
      const dup = await Teacher.findOne({ where: wherePhone });
      if (dup) customErrors.Phone = 'Викладач з таким номером телефону вже існує!';
    }
  } else if (tableName === 'users' && formData.username) {
    const whereU = { username: formData.username.trim() };
    if (isEdit) whereU.id = { [Op.ne]: Number(id) };
    const dup = await User.findOne({ where: whereU });
    if (dup) customErrors.username = 'Користувач з таким логіном вже існує в системі!';
  } else if (tableName === 'groups' && formData.GroupName) {
    const whereG = { GroupName: formData.GroupName.trim() };
    if (isEdit) whereG.GroupID = { [Op.ne]: Number(id) };
    const dup = await Group.findOne({ where: whereG });
    if (dup) customErrors.GroupName = 'Академічна група з такою назвою вже існує!';
  } else if (tableName === 'subjects' && formData.SubjectName) {
    const whereS = { SubjectName: formData.SubjectName.trim() };
    if (isEdit) whereS.SubjectID = { [Op.ne]: Number(id) };
    const dup = await Subject.findOne({ where: whereS });
    if (dup) customErrors.SubjectName = 'Дисципліна з такою назвою вже існує!';
  } else if (tableName === 'course_invitations') {
    if (formData.SenderTeacherID && formData.ReceiverTeacherID && Number(formData.SenderTeacherID) === Number(formData.ReceiverTeacherID)) {
      customErrors.ReceiverTeacherID = 'Неможливо надіслати запрошення самому собі!';
    }
  }

  if (Object.keys(customErrors).length > 0) {
    if (tableName === 'success_rate') {
      const [groups, allStudents, allSemesters, allAssignments, allSubjects, allTeachers, controlTypes] = await Promise.all([
        Group.findAll({ order: [['GroupName', 'ASC']] }),
        Student.findAll({
          order: [['FullName', 'ASC']],
          attributes: ['StudentID', 'GroupID', 'FullName', 'Subgroup']
        }),
        Semester.findAll({
          order: [['AcademicYear', 'DESC'], ['SemesterNumber', 'ASC']]
        }),
        CourseAssignment.findAll({
          include: [
            { model: Subject, as: 'subject' },
            { model: Teacher, as: 'teacher' },
            { model: Group, as: 'group' }
          ]
        }),
        Subject.findAll({ order: [['SubjectName', 'ASC']] }),
        Teacher.findAll({ order: [['FullName', 'ASC']] }),
        ControlType.findAll({ order: [['ControlTypeName', 'ASC']] })
      ]);

      return res.status(400).render('admin/success-rate-form.njk', {
        title: isEdit ? 'Редагування оцінки у відомості' : 'Створення нового запису у відомості',
        tableName,
        config,
        isEdit,
        id,
        itemData: req.body,
        selectedGroupId: req.body.GroupID || '',
        groups,
        allStudents,
        allSemesters,
        allAssignments,
        allSubjects,
        allTeachers,
        controlTypes,
        fieldErrors: customErrors,
        existingDuplicate: customErrors.existingDuplicate || null
      });
    }

    const selectOptions = await getSelectOptions(config.fields);
    return res.status(400).render('admin/form.njk', {
      title: isEdit ? `Редагування: ${config.title}` : `Створення: ${config.title}`,
      tableName,
      config,
      isEdit,
      id,
      itemData: req.body,
      selectOptions,
      fieldErrors: customErrors
    });
  }

  try {
    if (tableName === 'success_rate') {
      if (!formData.AssignmentID && formData.SubjectID && formData.TeacherID && formData.GroupID) {
        const matchedAssignment = await CourseAssignment.findOne({
          where: {
            GroupID: Number(formData.GroupID),
            SubjectID: Number(formData.SubjectID),
            TeacherID: Number(formData.TeacherID),
            AcademicYear: formData.AcademicYear.trim(),
            Semester: Number(formData.Semester)
          }
        });
        if (matchedAssignment) {
          formData.AssignmentID = matchedAssignment.AssignmentID;
        }
      }
      delete formData.GroupID;
      delete formData.confirmOverwrite;
      delete formData.existingSuccRateId;
      delete formData.semesterSelect;
    }

    if (isEdit) {
      const record = await config.model.findByPk(id);
      if (!record) {
        return res.status(404).render('common/error.njk', { error: 'Запис не знайдено.' });
      }
      await record.update(formData);
    } else {
      await config.model.create(formData);
    }

    return res.redirect(`/admin/tables/${tableName}`);
  } catch (error) {
    if (tableName === 'success_rate') {
      const [groups, allStudents, allSemesters, allAssignments, allSubjects, allTeachers, controlTypes] = await Promise.all([
        Group.findAll({ order: [['GroupName', 'ASC']] }),
        Student.findAll({
          order: [['FullName', 'ASC']],
          attributes: ['StudentID', 'GroupID', 'FullName', 'Subgroup']
        }),
        Semester.findAll({
          order: [['AcademicYear', 'DESC'], ['SemesterNumber', 'ASC']]
        }),
        CourseAssignment.findAll({
          include: [
            { model: Subject, as: 'subject' },
            { model: Teacher, as: 'teacher' },
            { model: Group, as: 'group' }
          ]
        }),
        Subject.findAll({ order: [['SubjectName', 'ASC']] }),
        Teacher.findAll({ order: [['FullName', 'ASC']] }),
        ControlType.findAll({ order: [['ControlTypeName', 'ASC']] })
      ]);
      const fieldErrors = translateErrors(error, config);
      return res.status(400).render('admin/success-rate-form.njk', {
        title: isEdit ? 'Редагування оцінки у відомості' : 'Створення нового запису у відомості',
        tableName,
        config,
        isEdit,
        id,
        itemData: req.body,
        selectedGroupId: req.body.GroupID || '',
        groups,
        allStudents,
        allSemesters,
        allAssignments,
        allSubjects,
        allTeachers,
        controlTypes,
        fieldErrors
      });
    }

    const fieldErrors = translateErrors(error, config);
    const selectOptions = await getSelectOptions(config.fields);

    return res.status(400).render('admin/form.njk', {
      title: isEdit ? `Редагування: ${config.title}` : `Створення: ${config.title}`,
      tableName,
      config,
      isEdit,
      id,
      itemData: req.body,
      selectOptions,
      fieldErrors
    });
  }
};

export const checkAdminTableRelations = async (req, res) => {
  const { tableName, id } = req.params;
  const config = tableConfig[tableName];

  if (!config) {
    return res.status(404).json({ error: 'Розділ даних не знайдено.' });
  }

  try {
    const relationInfo = await checkEntityRelations(tableName, id);
    return res.json(relationInfo);
  } catch (error) {
    console.error('Помилка перевірки зв\'язків:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const postAdminDelete = async (req, res) => {
  const { tableName, id } = req.params;
  const config = tableConfig[tableName];

  if (!config) {
    return res.status(404).render('common/error.njk', { error: 'Розділ даних не знайдено.' });
  }

  try {
    const numId = Number(id);

    // Каскадне очищення пов'язаних облікових записів користувачів перед видаленням сутностей
    if (tableName === 'departments') {
      const teachers = await Teacher.findAll({ where: { DepartmentID: numId }, attributes: ['TeacherID'] });
      const teacherIds = teachers.map(t => t.TeacherID);
      const students = await Student.findAll({ where: { DepartmentID: numId }, attributes: ['StudentID'] });
      const studentIds = students.map(s => s.StudentID);
      if (teacherIds.length > 0) await User.destroy({ where: { teacherId: teacherIds } });
      if (studentIds.length > 0) await User.destroy({ where: { studentId: studentIds } });
    } else if (tableName === 'groups') {
      const students = await Student.findAll({ where: { GroupID: numId }, attributes: ['StudentID'] });
      const studentIds = students.map(s => s.StudentID);
      if (studentIds.length > 0) await User.destroy({ where: { studentId: studentIds } });
    } else if (tableName === 'specializations') {
      const groups = await Group.findAll({ where: { SpecID: numId }, attributes: ['GroupID'] });
      const groupIds = groups.map(g => g.GroupID);
      if (groupIds.length > 0) {
        const students = await Student.findAll({ where: { GroupID: groupIds }, attributes: ['StudentID'] });
        const studentIds = students.map(s => s.StudentID);
        if (studentIds.length > 0) await User.destroy({ where: { studentId: studentIds } });
      }
    } else if (tableName === 'teachers') {
      await User.destroy({ where: { teacherId: numId } });
    } else if (tableName === 'students') {
      await User.destroy({ where: { studentId: numId } });
    }

    // Видалення основного запису (завдяки ON DELETE CASCADE у базі даних
    // всі зв'язані таблиці: оцінки, курси, студенти, викладачі тощо видаляються каскадно)
    await config.model.destroy({ where: { [config.pk]: numId } });

    return res.redirect(`/admin/tables/${tableName}`);
  } catch (error) {
    console.error('Помилка каскадного видалення запису:', error);
    res.status(500).render('common/error.njk', { 
      error: `Не вдалося видалити запис: ${error.message}` 
    });
  }
};

export const getCreateTeacher = async (req, res) => {
  try {
    const departments = await Department.findAll({ order: [['FullName', 'ASC']] });
    res.render('admin/create-teacher.njk', {
      title: 'Реєстрація нового викладача',
      departments,
      formData: {},
      errors: {}
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postCreateTeacher = async (req, res) => {
  const { 
    fullName, 
    departmentId, 
    degree, 
    birthDate, 
    hireDate, 
    email, 
    phone,
    username, 
    password 
  } = req.body;

  const errors = {};

  if (!fullName || fullName.trim() === '') {
    errors.fullName = 'Поле "ПІБ викладача" обов\'язкове для заповнення';
  } else if (fullName.trim().length < 5) {
    errors.fullName = 'ПІБ викладача має містити щонайменше 5 символів';
  }

  if (!departmentId || departmentId === '') {
    errors.departmentId = 'Оберіть кафедру/факультет зі списку';
  }

  if (!username || username.trim() === '') {
    errors.username = 'Поле "Логін викладача" обов\'язкове для заповнення';
  } else if (username.trim().length < 3) {
    errors.username = 'Логін повинен містити щонайменше 3 символи';
  }

  if (!password || password.trim() === '') {
    errors.password = 'Поле "Початковий пароль" обов\'язкове для заповнення';
  } else if (password.length < 4) {
    errors.password = 'Пароль повинен містити щонайменше 4 символи';
  }

  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.email = 'Введіть коректний формат електронної пошти';
    }
  }

  try {
    if (username && username.trim() !== '') {
      const existingUser = await User.findOne({ where: { username: username.trim() } });
      if (existingUser) {
        errors.username = 'Користувач із таким логіном вже існує в системі';
      }
    }

    if (Object.keys(errors).length > 0) {
      const departments = await Department.findAll({ order: [['FullName', 'ASC']] });
      return res.status(400).render('admin/create-teacher.njk', {
        title: 'Реєстрація нового викладача',
        departments,
        formData: req.body,
        errors
      });
    }

    const teacher = await Teacher.create({
      DepartmentID: Number(departmentId),
      FullName: fullName.trim(),
      Degree: degree && degree.trim() !== '' ? degree.trim() : null,
      Birth_Date: birthDate || null,
      HireDate: hireDate || null,
      Email: email && email.trim() !== '' ? email.trim() : null,
      Phone: phone && phone.trim() !== '' ? phone.trim() : null
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      username: username.trim(),
      password: hashedPassword,
      role: 'teacher',
      fullName: teacher.FullName,
      teacherId: teacher.TeacherID
    });

    return res.redirect('/admin/tables/teachers');
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};
