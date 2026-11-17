import { Router } from 'express';
import { 
  getTeacherCourses, 
  getTeacherCourseStudents,
  getTeacherGradeForm,
  postTeacherSaveGrade,
  postTeacherDeleteGrade,
  getCreateCourseForm,
  postCreateCourse,
  getGroupDetails
} from '../controllers/teacherController.js';
import {
  getSemesters,
  getCreateSemester,
  postCreateSemester,
  getEditSemester,
  postEditSemester,
  postUpdateSemesterStatus
} from '../controllers/semesterController.js';
import {
  getTeacherSubjectRequests,
  postTeacherSubjectRequest
} from '../controllers/subjectRequestController.js';
import {
  getTeacherInvitations,
  getInviteCoTeacherForm,
  postInviteCoTeacher,
  postAcceptInvitation,
  postDeclineInvitation
} from '../controllers/invitationController.js';
import { ensureAuthenticated, ensureRole } from '../middleware/auth.js';

const router = Router();

router.use(ensureAuthenticated);
router.use(ensureRole(['teacher', 'admin']));

// Список закріплених курсів викладача (панель керування)
router.get('/courses', getTeacherCourses);

// Створення нового курсу викладачем
router.get('/courses/create', getCreateCourseForm);
router.post('/courses/create', postCreateCourse);

// Детальний перегляд академічної групи (студенти та дисципліни)
router.get('/groups/:groupId', getGroupDetails);

// Журнал оцінювання конкретної групи курсу
router.get('/courses/:assignmentId/students', getTeacherCourseStudents);

// Запрошення співвикладача до курсу
router.get('/courses/:assignmentId/invite', getInviteCoTeacherForm);
router.post('/courses/:assignmentId/invite', postInviteCoTeacher);

// Вхідні та вихідні запрошення
router.get('/invitations', getTeacherInvitations);
router.post('/invitations/:invitationId/accept', postAcceptInvitation);
router.post('/invitations/:invitationId/decline', postDeclineInvitation);

// Семестри: планування, редагування та статуси
router.get('/semesters', getSemesters);
router.get('/semesters/create', getCreateSemester);
router.post('/semesters/create', postCreateSemester);
router.get('/semesters/:semesterId/edit', getEditSemester);
router.post('/semesters/:semesterId/edit', postEditSemester);
router.post('/semesters/:semesterId/status', postUpdateSemesterStatus);

// Заявки на доступ до предметів
router.get('/subject-requests', getTeacherSubjectRequests);
router.post('/subject-requests', postTeacherSubjectRequest);

// Внесення оцінки студенту
router.get('/courses/:assignmentId/grades/create/:studentId', getTeacherGradeForm);
router.post('/courses/:assignmentId/grades/create/:studentId', postTeacherSaveGrade);

// Редагування оцінки
router.get('/courses/:assignmentId/grades/edit/:gradeId', getTeacherGradeForm);
router.post('/courses/:assignmentId/grades/edit/:gradeId', postTeacherSaveGrade);

// Видалення оцінки
router.post('/grades/delete/:gradeId', postTeacherDeleteGrade);

export default router;
