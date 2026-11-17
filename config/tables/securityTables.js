import { User } from '../../models/index.js';

export const securityTables = {
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
