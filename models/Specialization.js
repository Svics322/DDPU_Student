import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Specialization = sequelize.define(
  'specializations',
  {
    SpecID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    SpecName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [
          3,
          255
        ]
      }
    }
  }
);