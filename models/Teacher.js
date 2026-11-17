import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Teacher = sequelize.define(
  'teachers',
  {
    TeacherID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    DepartmentID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    FullName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [
          5,
          255
        ]
      }
    },
    Degree: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    Birth_Date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    HireDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    Email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    Phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    }
  }
);