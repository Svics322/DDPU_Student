import { Op } from 'sequelize';
import { 
  SuccessRate, 
  Student, 
  Teacher, 
  Subject, 
  ControlType, 
  Group, 
  Specialization, 
  Department 
} from '../models/index.js';

export const renderSuccessRatePage = async (req, res) => {
  try {
    const { search, onlyMy, academicYear, semester } = req.query;
    const currentUser = req.user;

    const whereClause = {};
    const studentWhere = {};

    if (academicYear) {
      whereClause.AcademicYear = academicYear;
    }
    if (semester) {
      whereClause.Semester = Number(semester);
    }

    // Якщо відвідувач (студент) фільтрує свої оцінки
    if (onlyMy === '1' && currentUser?.studentId) {
      whereClause.StudentID = currentUser.studentId;
    } else if (search && search.trim() !== '') {
      const q = `%${search.trim()}%`;
      studentWhere.FullName = { [Op.iLike]: q };
    }

    const records = await SuccessRate.findAll({
      where: whereClause,
      include: [
        {
          model: Student,
          as: 'student',
          where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
          required: Object.keys(studentWhere).length > 0,
          include: [
            {
              model: Group,
              as: 'group',
              include: [{ model: Specialization, as: 'specialization' }]
            },
            { model: Department, as: 'department' }
          ]
        },
        { model: Teacher, as: 'teacher' },
        { model: Subject, as: 'subject' },
        { model: ControlType, as: 'controlType' }
      ],
      order: [
        ['AcademicYear', 'DESC'],
        ['Semester', 'DESC'],
        ['AssessmentDate', 'DESC']
      ]
    });

    res.render('common/success-rates.njk', {
      title: 'Загальна відомість успішності студентів',
      records,
      search: search || '',
      onlyMy: onlyMy === '1',
      academicYear: academicYear || '',
      semester: semester || '',
      currentUser
    });
  } catch (error) {
    console.error('Помилка завантаження відомості:', error);
    res.status(500).render('common/error.njk', { error: error.message });
  }
};
