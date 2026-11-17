import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CourseAssignment = sequelize.define(
  'course_assignments',
  {
    AssignmentID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    GroupID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    SubjectID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    TeacherID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    AcademicYear: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    CourseYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 6
      }
    },
    Semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isIn: [[1, 2]]
      }
    },
    Subgroup: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Вся група'
    },
    RoleType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Лекції та практика'
    }
  }
);
