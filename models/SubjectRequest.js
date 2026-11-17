import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const SubjectRequest = sequelize.define(
  'subject_requests',
  {
    RequestID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    TeacherID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    SubjectID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'approved', 'rejected', 'restricted']]
      }
    },
    Comment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    AdminComment: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt'
  }
);
