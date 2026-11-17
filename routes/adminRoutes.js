import { Router } from 'express';
import { 
  getAdminDashboard, 
  getAdminTableRecords, 
  getAdminForm, 
  postAdminSave, 
  postAdminDelete, 
  checkAdminTableRelations, 
  getCreateTeacher, 
  postCreateTeacher,
  checkSuccessRateDuplicate
} from '../controllers/adminController.js';
import { 
  getAdminSubjectRequests, 
  postAdminApproveRequest, 
  postAdminRejectRequest,
  postAdminManageSubjectAccess
} from '../controllers/subjectRequestController.js';
import { 
  getSemesters, 
  getCreateSemester, 
  postCreateSemester, 
  getEditSemester,
  postEditSemester,
  postUpdateSemesterStatus 
} from '../controllers/semesterController.js';
import { ensureAuthenticated, ensureRole } from '../middleware/auth.js';

import { getGroupDetails } from '../controllers/teacherController.js';

const router = Router();

// Лише адміністратор має доступ до панелі керування даними
router.use(ensureAuthenticated);
router.use(ensureRole(['admin']));

// Головний дашборд адміністратора
router.get('/tables', getAdminDashboard);

// Перегляд студентів та дисциплін академічної групи
router.get('/groups/:groupId', getGroupDetails);

// Розгляд заявок викладачів на доступ до дисциплін
router.get('/subject-requests', getAdminSubjectRequests);
router.post('/subject-requests/:requestId/approve', postAdminApproveRequest);
router.post('/subject-requests/:requestId/reject', postAdminRejectRequest);
router.post('/subject-requests/revoke-access', postAdminManageSubjectAccess);

// Семестри для адміністратора
router.get('/semesters', getSemesters);
router.get('/semesters/create', getCreateSemester);
router.post('/semesters/create', postCreateSemester);
router.get('/semesters/:semesterId/edit', getEditSemester);
router.post('/semesters/:semesterId/edit', postEditSemester);
router.post('/semesters/:semesterId/status', postUpdateSemesterStatus);

// Реєстрація нових викладачів
router.get('/teachers/create', getCreateTeacher);
router.post('/teachers/create', postCreateTeacher);

// Перевірка дублікатів оцінок у відомості успішності
router.get('/tables/success_rate/check-duplicate', checkSuccessRateDuplicate);

// Перегляд записів будь-якої таблиці
router.get('/tables/:tableName', getAdminTableRecords);

// Створення записів у будь-якій таблиці
router.get('/tables/:tableName/create', getAdminForm);
router.post('/tables/:tableName/create', postAdminSave);

// Редагування записів у будь-якій таблиці
router.get('/tables/:tableName/edit/:id', getAdminForm);
router.post('/tables/:tableName/edit/:id', postAdminSave);

// Перевірка наявності зв'язаних даних перед видаленням (для динамічного модального вікна)
router.get('/tables/:tableName/check-relations/:id', checkAdminTableRelations);

// Видалення записів
router.post('/tables/:tableName/delete/:id', postAdminDelete);

export default router;
