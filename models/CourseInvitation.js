import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

export const CourseInvitation = sequelize.define(
  'course_invitations',
  {
    InvitationID: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    AssignmentID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    SenderTeacherID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ReceiverTeacherID: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    RoleType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Лабораторні заняття'
    },
    Subgroup: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Підгрупа 2'
    },
    Status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'accepted', 'declined']]
      }
    },
    Message: {
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
