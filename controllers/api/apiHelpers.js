/**
 * Допоміжні функції для RESTful API контролерів
 */

export const apiSuccess = (res, data, statusCode = 200, meta = {}) => {
  return res.status(statusCode).json({
    success: true,
    ...meta,
    data
  });
};

export const apiError = (res, message, statusCode = 400, details = {}) => {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...details
  });
};

export const formatValidationErrors = (error, config) => {
  const fieldErrors = {};

  if (!error.errors || !Array.isArray(error.errors)) {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return { 
        general: 'Помилка зовнішнього ключа: вказаний зв\'язаний запис не існує або на нього посилаються інші дані.',
        fieldErrors 
      };
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      return { 
        general: 'Запис з таким унікальним значенням вже існує в системі.',
        fieldErrors 
      };
    }
    return { 
      general: error.message || 'Сталася помилка валідації даних.',
      fieldErrors 
    };
  }

  error.errors.forEach(err => {
    const fieldConfig = config ? config.fields.find(f => f.name === err.path) : null;
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

  return {
    general: 'Помилка валідації введених даних.',
    fieldErrors
  };
};

export const getSelectOptions = async (fields) => {
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
    case 'success_rate':
      return `Оцінка: ${item.StudentID} — ${item.SubjectID} (${item.Mark} б.)`;
    case 'semesters':
      return `Семестр: ${item.Name || (item.AcademicYear + ', ' + item.SemesterNumber + ' сем.')}`;
    case 'subject_requests':
      return `Заявка на предмет: #${item.RequestID}`;
    case 'course_invitations':
      return `Запрошення співвикладача: #${item.InvitationID}`;
    default:
      return `${item.FullName || item.Name || item.name || ('Запис #' + (item.id || item[Object.keys(item)[0]]))}`;
  }
};
