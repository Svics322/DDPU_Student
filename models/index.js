import { sequelize } from '../config/database.js';
import { ControlType } from './ControlType.js';
import { Department } from './Department.js';
import { EducationForm } from './EducationForm.js';
import { Specialization } from './Specialization.js';
import { Subject } from './Subject.js';
import { Group } from './Group.js';
import { Teacher } from './Teacher.js';
import { Student } from './Student.js';
import { CourseAssignment } from './CourseAssignment.js';
import { SuccessRate } from './SuccessRate.js';
import { User } from './User.js';
import { Semester } from './Semester.js';
import { SubjectRequest } from './SubjectRequest.js';
import { CourseInvitation } from './CourseInvitation.js';

// Асоціації спеціальностей та груп
Specialization.hasMany(Group, { foreignKey: 'SpecID', as: 'groups' });
Group.belongsTo(Specialization, { foreignKey: 'SpecID', as: 'specialization' });

// Кафедри -> викладачі та студенти
Department.hasMany(Teacher, { foreignKey: 'DepartmentID', as: 'teachers' });
Teacher.belongsTo(Department, { foreignKey: 'DepartmentID', as: 'department' });

Department.hasMany(Student, { foreignKey: 'DepartmentID', as: 'students' });
Student.belongsTo(Department, { foreignKey: 'DepartmentID', as: 'department' });

// Групи -> студенти
Group.hasMany(Student, { foreignKey: 'GroupID', as: 'students' });
Student.belongsTo(Group, { foreignKey: 'GroupID', as: 'group' });

// Форма навчання -> студенти
EducationForm.hasMany(Student, { foreignKey: 'FormID', as: 'students' });
Student.belongsTo(EducationForm, { foreignKey: 'FormID', as: 'educationForm' });

// Призначення предметів (CourseAssignment)
Group.hasMany(CourseAssignment, { foreignKey: 'GroupID', as: 'assignments' });
CourseAssignment.belongsTo(Group, { foreignKey: 'GroupID', as: 'group' });

Subject.hasMany(CourseAssignment, { foreignKey: 'SubjectID', as: 'assignments' });
CourseAssignment.belongsTo(Subject, { foreignKey: 'SubjectID', as: 'subject' });

Teacher.hasMany(CourseAssignment, { foreignKey: 'TeacherID', as: 'assignments' });
CourseAssignment.belongsTo(Teacher, { foreignKey: 'TeacherID', as: 'teacher' });

// Семестри
Teacher.hasMany(Semester, { foreignKey: 'CreatedByTeacherID', as: 'createdSemesters' });
Semester.belongsTo(Teacher, { foreignKey: 'CreatedByTeacherID', as: 'creator' });

// Заявки викладачів на доступ до предметів
Teacher.hasMany(SubjectRequest, { foreignKey: 'TeacherID', as: 'subjectRequests' });
SubjectRequest.belongsTo(Teacher, { foreignKey: 'TeacherID', as: 'teacher' });

Subject.hasMany(SubjectRequest, { foreignKey: 'SubjectID', as: 'requests' });
SubjectRequest.belongsTo(Subject, { foreignKey: 'SubjectID', as: 'subject' });

// Запрошення до спільного ведення курсів
CourseAssignment.hasMany(CourseInvitation, { foreignKey: 'AssignmentID', as: 'invitations' });
CourseInvitation.belongsTo(CourseAssignment, { foreignKey: 'AssignmentID', as: 'assignment' });

Teacher.hasMany(CourseInvitation, { foreignKey: 'SenderTeacherID', as: 'sentInvitations' });
CourseInvitation.belongsTo(Teacher, { foreignKey: 'SenderTeacherID', as: 'senderTeacher' });

Teacher.hasMany(CourseInvitation, { foreignKey: 'ReceiverTeacherID', as: 'receivedInvitations' });
CourseInvitation.belongsTo(Teacher, { foreignKey: 'ReceiverTeacherID', as: 'receiverTeacher' });

// Відомість успішності (SuccessRate)
Teacher.hasMany(SuccessRate, { foreignKey: 'TeacherID', as: 'successRates' });
SuccessRate.belongsTo(Teacher, { foreignKey: 'TeacherID', as: 'teacher' });

Student.hasMany(SuccessRate, { foreignKey: 'StudentID', as: 'successRates' });
SuccessRate.belongsTo(Student, { foreignKey: 'StudentID', as: 'student' });

Subject.hasMany(SuccessRate, { foreignKey: 'SubjectID', as: 'successRates' });
SuccessRate.belongsTo(Subject, { foreignKey: 'SubjectID', as: 'subject' });

ControlType.hasMany(SuccessRate, { foreignKey: 'ControlTypeID', as: 'successRates' });
SuccessRate.belongsTo(ControlType, { foreignKey: 'ControlTypeID', as: 'controlType' });

CourseAssignment.hasMany(SuccessRate, { foreignKey: 'AssignmentID', as: 'successRates' });
SuccessRate.belongsTo(CourseAssignment, { foreignKey: 'AssignmentID', as: 'assignment' });

// Користувачі (Users)
User.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
User.belongsTo(Teacher, { foreignKey: 'teacherId', as: 'teacher' });

export {
  sequelize,
  ControlType,
  Department,
  EducationForm,
  Specialization,
  Subject,
  Group,
  Teacher,
  Student,
  CourseAssignment,
  SuccessRate,
  User,
  Semester,
  SubjectRequest,
  CourseInvitation
};
