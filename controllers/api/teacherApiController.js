import bcrypt from 'bcryptjs';
import { Teacher, User } from '../../models/index.js';

export const apiRegisterTeacher = async (req, res) => {
  const { 
    fullName, departmentId, degree, birthDate, hireDate, email, phone, username, password 
  } = req.body;

  const errors = {};
  if (!fullName || fullName.trim() === '') errors.fullName = 'Поле "ПІБ викладача" обов\'язкове для заповнення';
  else if (fullName.trim().length < 5) errors.fullName = 'ПІБ викладача має містити щонайменше 5 символів';

  if (!departmentId || departmentId === '') errors.departmentId = 'Оберіть кафедру/факультет зі списку';

  if (!username || username.trim() === '') errors.username = 'Поле "Логін викладача" обов\'язкове для заповнення';
  else if (username.trim().length < 3) errors.username = 'Логін повинен містити щонайменше 3 символи';

  if (!password || password.trim() === '') errors.password = 'Поле "Початковий пароль" обов\'язкове для заповнення';
  else if (password.length < 4) errors.password = 'Пароль повинен містити щонайменше 4 символи';

  if (email && email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) errors.email = 'Введіть коректний формат електронної пошти';
  }

  try {
    if (username && username.trim() !== '') {
      const existingUser = await User.findOne({ where: { username: username.trim() } });
      if (existingUser) errors.username = 'Користувач із таким логіном вже існує в системі';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Помилка валідації полів реєстрації викладача',
        fieldErrors: errors
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
    const user = await User.create({
      username: username.trim(),
      password: hashedPassword,
      role: 'teacher',
      fullName: teacher.FullName,
      teacherId: teacher.TeacherID
    });

    return res.status(201).json({
      success: true,
      message: 'Викладача успішно зареєстровано.',
      data: {
        teacher,
        user: { id: user.id, username: user.username, role: user.role }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
