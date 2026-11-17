import bcrypt from 'bcryptjs';
import { User, Teacher, Student } from '../models/index.js';

// На готовій схемі (Postgres + sql.sql) записи 1 і 6 існують, і акаунти до них
// прив'язуються. На порожній базі SQLite їх немає — тоді створюємо акаунти без
// зовнішніх ключів, інакше вставка падає з FOREIGN KEY constraint failed.
const hasTeacher = async (id) => Boolean(await Teacher.findByPk(id));
const hasStudent = async (id) => Boolean(await Student.findByPk(id));

export const initAndSeedUsers = async () => {
  try {
    // Створюємо таблицю users, якщо вона ще не існує
    await User.sync();

    const count = await User.count();
    if (count === 0) {
      console.log('Ініціалізація початкових користувачів...');

      const teacherId = (await hasTeacher(1)) ? 1 : null;
      const studentId = (await hasStudent(6)) ? 6 : null;

      const defaultUsers = [
        {
          username: 'admin',
          password: await bcrypt.hash('admin123', 10),
          role: 'admin',
          fullName: 'Адміністратор Системи'
        },
        {
          username: 'teacher',
          password: await bcrypt.hash('teacher123', 10),
          role: 'teacher',
          fullName: 'Гольський Віталій Богданович',
          teacherId
        },
        {
          username: 'visitor',
          password: await bcrypt.hash('visitor123', 10),
          role: 'visitor',
          fullName: 'Юрків Віталій Романович',
          studentId
        }
      ];

      await User.bulkCreate(defaultUsers);
      console.log('Початкові користувачі успішно створені:');
      console.log(' - admin / admin123 (роль: admin)');
      console.log(' - teacher / teacher123 (роль: teacher)');
      console.log(' - visitor / visitor123 (роль: visitor)');
    }
  } catch (err) {
    console.error('Помилка ініціалізації користувачів:', err.message);
  }
};
