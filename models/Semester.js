import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Semester = sequelize.define(
  'semesters',
  {
    SemesterID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    AcademicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        len: [4, 20]
      }
    },
    SemesterNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isIn: [[1, 2]]
      }
    },
    Name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        len: [3, 150]
      }
    },
    StartDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    EndDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'planned',
      validate: {
        isIn: [['planned', 'active', 'completed']]
      }
    },
    CreatedByTeacherID: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  },
  {
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt'
  }
);
