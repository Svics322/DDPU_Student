import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const SuccessRate = sequelize.define(
  'success_rate',
  {
    SuccRateID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    TeacherID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    StudentID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    SubjectID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    AssignmentID: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    AcademicYear: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    CourseYear: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    Semester: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ControlTypeID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    AssessmentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    Mark: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 100
      }
    }
  }
);
