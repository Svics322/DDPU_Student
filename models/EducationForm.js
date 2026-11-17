import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const EducationForm = sequelize.define(
  'education_forms',
  {
    FormID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    FormName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [
          2,
          100
        ]
      }
    }
  }
);