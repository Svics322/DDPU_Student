import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const User = sequelize.define(
  'users',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50]
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'visitor',
      validate: {
        isIn: [['admin', 'teacher', 'visitor']]
      }
    },
    fullName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    teacherId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  },
  {
    tableName: 'users',
    timestamps: true
  }
);
