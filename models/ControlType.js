import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const ControlType = sequelize.define(
  'control_types',
  {
    ControlTypeID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ControlTypeName: {
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