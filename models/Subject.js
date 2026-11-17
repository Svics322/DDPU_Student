import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Subject = sequelize.define(
  'subjects',
  {
    SubjectID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    SubjectName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [
          2,
          255
        ]
      }
    }
  }
);