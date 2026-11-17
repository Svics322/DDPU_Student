import bcrypt from 'bcryptjs';
import { tableConfig } from '../../config/tableConfig.js';
import { checkEntityRelations } from '../../services/relationService.js';
import { formatValidationErrors, getSelectOptions, getItemDisplayName } from './apiHelpers.js';
import { Teacher, Student, Group, User } from '../../models/index.js';

export const apiListTableRecords = async (req, res) => {
  const { tableName } = req.params;
  const config = tableConfig[tableName];
  if (!config) return res.status(404).json({ success: false, error: 'Розділ даних не знайдено.' });

  try {
    const records = await config.model.findAll({ raw: true });
    const selectOptions = await getSelectOptions(config.fields);

    const formattedRecords = records.map(record => {
      const item = { ...record };
      config.fields.forEach(field => {
        if (field.type === 'select' && selectOptions[field.name]) {
          const opt = selectOptions[field.name].find(o => String(o.value) === String(record[field.name]));
          item[`${field.name}_label`] = opt ? opt.label : item[field.name];
        }
      });
      item._displayName = getItemDisplayName(tableName, item);
      return item;
    });

    return res.json({
      success: true,
      tableName,
      title: config.title,
      description: config.description,
      count: formattedRecords.length,
      data: formattedRecords
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const apiGetTableRecord = async (req, res) => {
  const { tableName, id } = req.params;
  const config = tableConfig[tableName];
  if (!config) return res.status(404).json({ success: false, error: 'Розділ даних не знайдено.' });

  try {
    const record = await config.model.findByPk(id);
    if (!record) return res.status(404).json({ success: false, error: 'Запис не знайдено.' });

    const data = record.toJSON();
    if (data.password) delete data.password;
    return res.json({ success: true, tableName, title: config.title, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const apiCreateTableRecord = async (req, res) => {
  const { tableName } = req.params;
  const config = tableConfig[tableName];
  if (!config) return res.status(404).json({ success: false, error: 'Розділ даних не знайдено.' });

  try {
    const formData = {};
    for (const field of config.fields) {
      let val = req.body[field.name];
      if (val === '' || val === undefined) val = null;
      else if (field.type === 'number' || (field.type === 'select' && field.foreignPk)) val = Number(val);
      formData[field.name] = val;
    }

    if (tableName === 'users' && formData.password) {
      formData.password = await bcrypt.hash(formData.password, 10);
    }

    const created = await config.model.create(formData);
    const data = created.toJSON();
    if (data.password) delete data.password;

    return res.status(201).json({ success: true, message: 'Запис успішно створено.', data });
  } catch (error) {
    const { general, fieldErrors } = formatValidationErrors(error, config);
    return res.status(400).json({ success: false, error: general, fieldErrors });
  }
};

export const apiUpdateTableRecord = async (req, res) => {
  const { tableName, id } = req.params;
  const config = tableConfig[tableName];
  if (!config) return res.status(404).json({ success: false, error: 'Розділ даних не знайдено.' });

  try {
    const record = await config.model.findByPk(id);
    if (!record) return res.status(404).json({ success: false, error: 'Запис не знайдено.' });

    const formData = {};
    for (const field of config.fields) {
      let val = req.body[field.name];
      if (val === '' || val === undefined) val = null;
      else if (field.type === 'number' || (field.type === 'select' && field.foreignPk)) val = Number(val);
      formData[field.name] = val;
    }

    if (tableName === 'users') {
      if (formData.password && formData.password.trim() !== '') {
        formData.password = await bcrypt.hash(formData.password.trim(), 10);
      } else {
        delete formData.password;
      }
    }

    await record.update(formData);
    const updatedData = record.toJSON();
    if (updatedData.password) delete updatedData.password;

    return res.json({ success: true, message: 'Запис успішно оновлено.', data: updatedData });
  } catch (error) {
    const { general, fieldErrors } = formatValidationErrors(error, config);
    return res.status(400).json({ success: false, error: general, fieldErrors });
  }
};

export const apiDeleteTableRecord = async (req, res) => {
  const { tableName, id } = req.params;
  const config = tableConfig[tableName];
  if (!config) return res.status(404).json({ success: false, error: 'Розділ даних не знайдено.' });

  try {
    const numId = Number(id);
    const record = await config.model.findByPk(numId);
    if (!record) return res.status(404).json({ success: false, error: 'Запис не знайдено.' });

    if (tableName === 'departments') {
      const teachers = await Teacher.findAll({ where: { DepartmentID: numId }, attributes: ['TeacherID'] });
      const students = await Student.findAll({ where: { DepartmentID: numId }, attributes: ['StudentID'] });
      if (teachers.length > 0) await User.destroy({ where: { teacherId: teachers.map(t => t.TeacherID) } });
      if (students.length > 0) await User.destroy({ where: { studentId: students.map(s => s.StudentID) } });
    } else if (tableName === 'groups') {
      const students = await Student.findAll({ where: { GroupID: numId }, attributes: ['StudentID'] });
      if (students.length > 0) await User.destroy({ where: { studentId: students.map(s => s.StudentID) } });
    } else if (tableName === 'specializations') {
      const groups = await Group.findAll({ where: { SpecID: numId }, attributes: ['GroupID'] });
      if (groups.length > 0) {
        const students = await Student.findAll({ where: { GroupID: groups.map(g => g.GroupID) }, attributes: ['StudentID'] });
        if (students.length > 0) await User.destroy({ where: { studentId: students.map(s => s.StudentID) } });
      }
    } else if (tableName === 'teachers') {
      await User.destroy({ where: { teacherId: numId } });
    } else if (tableName === 'students') {
      await User.destroy({ where: { studentId: numId } });
    }

    await config.model.destroy({ where: { [config.pk]: numId } });
    return res.json({ success: true, message: 'Запис успішно видалено разом із усіма пов\'язаними даними.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: `Помилка видалення: ${error.message}` });
  }
};

export const apiCheckTableRelations = async (req, res) => {
  const { tableName, id } = req.params;
  const config = tableConfig[tableName];
  if (!config) return res.status(404).json({ success: false, error: 'Розділ даних не знайдено.' });

  try {
    const relationInfo = await checkEntityRelations(tableName, id);
    return res.json({ success: true, ...relationInfo });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
