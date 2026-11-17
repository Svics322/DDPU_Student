import { CourseInvitation, CourseAssignment, Teacher } from '../models/index.js';

/**
 * Перевіряє чи є викладач запрошеним співвикладачем для конкретного навантаження
 * @param {number} teacherId 
 * @param {Object} assignment 
 * @returns {Promise<boolean>}
 */
export async function isTeacherCoTeacher(teacherId, assignment) {
  if (!teacherId || !assignment) return false;

  const invite = await CourseInvitation.findOne({
    where: {
      ReceiverTeacherID: Number(teacherId),
      Status: 'accepted'
    },
    include: [{
      model: CourseAssignment,
      as: 'assignment',
      where: {
        GroupID: assignment.GroupID,
        SubjectID: assignment.SubjectID,
        AcademicYear: assignment.AcademicYear,
        Semester: assignment.Semester
      }
    }]
  });

  return Boolean(invite);
}

/**
 * Отримує всі прийняті запрошення співвикладачів для конкретного викладача
 * @param {number} teacherId 
 * @returns {Promise<Array>}
 */
export async function getTeacherAcceptedInvitations(teacherId) {
  if (!teacherId) return [];

  return CourseInvitation.findAll({
    where: { ReceiverTeacherID: Number(teacherId), Status: 'accepted' },
    include: [{ model: CourseAssignment, as: 'assignment' }]
  });
}

/**
 * Отримує список співвикладачів для дисципліни викладача
 * @param {number} teacherId 
 * @param {number} subjectId 
 * @returns {Promise<Array>}
 */
export async function getCoTeachersForDiscipline(teacherId, subjectId) {
  const assignments = await CourseAssignment.findAll({
    where: { TeacherID: Number(teacherId), SubjectID: Number(subjectId) }
  });
  const assignmentIds = assignments.map(a => a.AssignmentID);
  if (assignmentIds.length === 0) return [];

  const invitations = await CourseInvitation.findAll({
    where: {
      AssignmentID: assignmentIds,
      Status: 'accepted'
    },
    include: [{ model: Teacher, as: 'receiverTeacher' }]
  });

  const names = [...new Set(invitations.map(i => i.receiverTeacher?.FullName).filter(Boolean))];
  return names;
}
