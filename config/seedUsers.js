import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';

export const initAndSeedUsers = async () => {
  try {
    // Створюємо таблицю users, якщо вона ще не існує
    await User.sync();

    const count = await User.count();
    if (count === 0) {
      console.log('Ініціалізація початкових користувачів...');

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
          teacherId: 1
        },
        {
          username: 'visitor',
          password: await bcrypt.hash('visitor123', 10),
          role: 'visitor',
          fullName: 'Юрків Віталій Романович',
          studentId: 6
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
