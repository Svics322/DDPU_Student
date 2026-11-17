import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Student = sequelize.define(
  'students',
  {
    StudentID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    DepartmentID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    GroupID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    FormID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    FullName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [5, 255]
      }
    },
    Subgroup: {
      type: DataTypes.STRING(50),
      defaultValue: 'Підгрупа 1'
    },
    Birth_Date: {
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
