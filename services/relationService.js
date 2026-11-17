import { 
  Teacher, 
  Student, 
  Group, 
  CourseAssignment, 
  SuccessRate, 
  User 
} from '../models/index.js';

export const checkEntityRelations = async (tableName, id) => {
  const numId = Number(id);
  const details = [];

  switch (tableName) {
    case 'departments': {
      const teachersCount = await Teacher.count({ where: { DepartmentID: numId } });
      const studentsCount = await Student.count({ where: { DepartmentID: numId } });
      if (teachersCount > 0) details.push(`Закріплених викладачів: ${teachersCount} чол.`);
      if (studentsCount > 0) details.push(`Студентів на факультеті: ${studentsCount} чол.`);
      break;
    }
    case 'specializations': {
      const groupsCount = await Group.count({ where: { SpecID: numId } });
      if (groupsCount > 0) details.push(`Академічних груп за спеціальністю: ${groupsCount}`);
      break;
    }
    case 'education_forms': {
      const studentsCount = await Student.count({ where: { FormID: numId } });
      if (studentsCount > 0) details.push(`Студентів з цією формою навчання: ${studentsCount} чол.`);
      break;
    }
    case 'control_types': {
      const gradesCount = await SuccessRate.count({ where: { ControlTypeID: numId } });
      if (gradesCount > 0) details.push(`Виставлених оцінок у відомостях: ${gradesCount}`);
      break;
    }
    case 'subjects': {
      const coursesCount = await CourseAssignment.count({ where: { SubjectID: numId } });
      const gradesCount = await SuccessRate.count({ where: { SubjectID: numId } });
      if (coursesCount > 0) details.push(`Закріплень у розкладі груп: ${coursesCount}`);
      if (gradesCount > 0) details.push(`Оцінок у відомостях успішності: ${gradesCount}`);
      break;
    }
    case 'groups': {
      const studentsCount = await Student.count({ where: { GroupID: numId } });
      const coursesCount = await CourseAssignment.count({ where: { GroupID: numId } });
      if (studentsCount > 0) details.push(`Студентів у цій групі: ${studentsCount} чол.`);
      if (coursesCount > 0) details.push(`Призначених навчальних дисциплін: ${coursesCount}`);
      break;
    }
    case 'teachers': {
      const coursesCount = await CourseAssignment.count({ where: { TeacherID: numId } });
      const gradesCount = await SuccessRate.count({ where: { TeacherID: numId } });
      const userCount = await User.count({ where: { teacherId: numId } });
      if (coursesCount > 0) details.push(`Закріплених дисциплін у розкладі: ${coursesCount}`);
      if (gradesCount > 0) details.push(`Виставлених оцінок студентам: ${gradesCount}`);
      if (userCount > 0) details.push(`Обліковий запис для входу в систему`);
      break;
    }
    case 'students': {
      const gradesCount = await SuccessRate.count({ where: { StudentID: numId } });
      const userCount = await User.count({ where: { studentId: numId } });
      if (gradesCount > 0) details.push(`Оцінок у відомості успішності: ${gradesCount}`);
      if (userCount > 0) details.push(`Обліковий запис для входу в систему`);
      break;
    }
    case 'course_assignments': {
      const gradesCount = await SuccessRate.count({ where: { AssignmentID: numId } });
      if (gradesCount > 0) details.push(`Виставлених оцінок за цим курсом: ${gradesCount}`);
      break;
    }
    case 'users':
    case 'success_rate':
    default:
      break;
  }

  return {
    hasRelations: details.length > 0,
    details
  };
};
