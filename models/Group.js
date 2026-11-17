import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const Group = sequelize.define(
  'groups',
  {
    GroupID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    GroupName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    SpecID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    StartYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2000,
        max: 2100
      }
    },
    ReleaseYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2000,
        max: 2100
      }
    }
  }
);
