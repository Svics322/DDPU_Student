import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Department = sequelize.define(
  'departments',
  {
    DepartmentID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    FullName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [
          3,
          255
        ]
      }
    },
    AbbreviatedName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [
          2,
          50
        ]
      }
    }
  }
);