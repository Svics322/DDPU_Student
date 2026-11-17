import passport from 'passport';
import bcrypt from 'bcryptjs';
import { User, Student, Group, Department, EducationForm } from '../models/index.js';

export const getLoginPage = (req, res) => {
  const error = req.query.error ? 'Невірний логін або пароль' : null;
  const success = req.query.registered ? 'Реєстрація успішна! Увійдіть під своїми даними' : null;
  res.render('auth/login.njk', {
    title: 'Вхід до системи',
    error,
    success,
    formData: {},
    errors: {}
  });
};

export const postLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = {};

  if (!username || username.trim() === '') {
    errors.username = 'Поле "Логін" обов\'язкове для заповнення';
  }
  if (!password || password.trim() === '') {
    errors.password = 'Поле "Пароль" обов\'язкове для заповнення';
  }

  // Серверна валідація без обов'язкового клієнтського required
  if (Object.keys(errors).length > 0) {
    return res.status(400).render('auth/login.njk', {
      title: 'Вхід до системи',
      errors,
      formData: req.body,
      error: null,
      success: null
    });
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).render('auth/login.njk', {
        title: 'Вхід до системи',
        error: info?.message || 'Невірний логін або пароль',
        formData: req.body,
        errors: {},
        success: null
      });
    }
    req.logIn(user, (err) => {
      if (err) return next(err);

      // Перенаправлення за роллю:
      if (user.role === 'admin') {
        return res.redirect('/admin/tables');
      } else if (user.role === 'teacher') {
        return res.redirect('/teacher/courses');
      } else {
        return res.redirect('/student/profile');
      }
    });
  })(req, res, next);
};

export const getRegisterPage = async (req, res) => {
  try {
    const groups = await Group.findAll({ order: [['GroupName', 'ASC']] });
    const departments = await Department.findAll({ order: [['FullName', 'ASC']] });
    const forms = await EducationForm.findAll();

    res.render('auth/register.njk', {
      title: 'Реєстрація студента',
      groups,
      departments,
      forms,
      formData: {},
      errors: {}
    });
  } catch (error) {
    res.status(500).render('common/error.njk', { error: error.message });
  }
};

export const postRegister = async (req, res) => {
  const { 
    username, 
    password, 
    fullName, 
    groupId, 
    departmentId, 
    formId, 
    subgroup,
    email, 
    phone, 
    birthDate 
  } = req.body;

  const errors = {};

  // Серверна валідація обов'язкових та необов'язкових полів
  if (!username || username.trim() === '') {
    errors.username = 'Поле "Логін" обов\'язкове для заповнення';
  } else if (username.trim().length < 3) {
    errors.username = 'Логін повинен містити щонайменше 3 символи';
  }

  if (!password || password.trim() === '') {
    errors.password = 'Поле "Пароль" обов\'язкове для заповнення';
  } else if (password.length < 4) {
    errors.password = 'Пароль повинен містити щонайменше 4 символи';
  }

  if (!fullName || fullName.trim() === '') {
    errors.fullName = 'Поле "ПІБ студента" обов\'язкове для заповнення';
  } else if (fullName.trim().length < 5) {
    errors.fullName = 'ПІБ студента має містити щонайменше 5 символів';
  }

  if (!groupId || groupId === '') {
    errors.groupId = 'Оберіть академічну групу зі списку';
  }

  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.email = 'Введіть коректний формат електронної пошти';
    }
  }

  try {
    if (username && username.trim() !== '') {
      const existing = await User.findOne({ where: { username: username.trim() } });
      if (existing) {
        errors.username = 'Користувач із таким логіном вже зареєстрований';
      }
    }

    if (Object.keys(errors).length > 0) {
      const groups = await Group.findAll({ order: [['GroupName', 'ASC']] });
      const departments = await Department.findAll({ order: [['FullName', 'ASC']] });
      const forms = await EducationForm.findAll();

      return res.status(400).render('auth/register.njk', {
        title: 'Реєстрація студента',
        groups,
        departments,
        forms,
        formData: req.body,
        errors
      });
    }

    const resolvedDeptId = departmentId ? Number(departmentId) : 1;
    const resolvedFormId = formId ? Number(formId) : 1;

    // Створюємо профіль студента
    const student = await Student.create({
      FullName: fullName.trim(),
      DepartmentID: resolvedDeptId,
      GroupID: Number(groupId),
      FormID: resolvedFormId,
      Subgroup: subgroup || 'Підгрупа 1',
      Email: email && email.trim() !== '' ? email.trim() : null,
      Phone: phone && phone.trim() !== '' ? phone.trim() : null,
      Birth_Date: birthDate || null
    });

    // Створюємо обліковий запис студента (роль 'visitor')
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      username: username.trim(),
      password: hashedPassword,
      role: 'visitor',
      fullName: student.FullName,
      studentId: student.StudentID
    });

    return res.redirect('/login?registered=1');
  } catch (err) {
    return res.status(500).render('common/error.njk', { error: err.message });
  }
};

export const logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect('/login');
    });
  });
};
