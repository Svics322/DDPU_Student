import { Router } from 'express';
import { 
  // Універсальні табличні операції
  apiListTableRecords,
  apiGetTableRecord,
  apiCreateTableRecord,
  apiUpdateTableRecord,
  apiDeleteTableRecord,
  apiCheckTableRelations,

  // Викладачі
  apiRegisterTeacher,

  // Оцінки та відомості
  apiGetGrades,
  apiGetGradeById,
  apiSaveGrade,
  apiUpdateGrade,
  apiDeleteGrade,

  // Семестри
  apiGetSemesters,
  apiGetSemesterById,
  apiCreateSemester,
  apiUpdateSemester,
  apiUpdateSemesterStatus,
  apiDeleteSemester,
  apiGetSemesterGradingState,

  // Заявки на предмети та доступ
  apiGetSubjectRequests,
  apiGetSubjectRequestById,
  apiCreateSubjectRequest,
  apiApproveSubjectRequest,
  apiRejectSubjectRequest,
  apiRevokeSubjectAccess,

  // Запрошення співвикладачів
  apiGetInvitations,
  apiGetInvitationById,
  apiCreateInvitation,
  apiAcceptInvitation,
  apiDeclineInvitation,

  // Навчальні курси
  apiGetCourses,
  apiGetCourseById,
  apiGetCourseStudents,
  apiCreateCourse,
  apiDeleteCourse,

  // Синхронізація часу з Time API
  apiGetCurrentTime,
  apiSyncTime
} from '../controllers/apiController.js';
import { ensureApiAuthenticated, ensureApiRole } from '../middleware/apiAuth.js';

const router = Router();

/* =========================================================
   1. Синхронізація часу із зовнішнім Time API
   ========================================================= */
// GET /api/time/current — отримання авторитетної дати і стану синхронізації
router.get('/time/current', apiGetCurrentTime);
// POST /api/time/sync — примусова синхронізація
router.post('/time/sync', ensureApiAuthenticated, ensureApiRole(['admin', 'teacher']), apiSyncTime);

// Усі подальші API ендпоінти вимагають автентифікації
router.use(ensureApiAuthenticated);

/* =========================================================
   2. Оцінки та відомість успішності (/api/grades)
   ========================================================= */
// GET /api/grades — список оцінок із фільтрами
router.get('/grades', apiGetGrades);
// GET /api/grades/:id — деталі оцінки
router.get('/grades/:id', apiGetGradeById);
// POST /api/grades — створення/перезапис оцінки з перевіркою Time API та дублікатів
router.post('/grades', ensureApiRole(['admin', 'teacher']), apiSaveGrade);
// PUT /api/grades/:id — оновлення оцінки
router.put('/grades/:id', ensureApiRole(['admin', 'teacher']), apiUpdateGrade);
// DELETE /api/grades/:id — видалення оцінки
router.delete('/grades/:id', ensureApiRole(['admin', 'teacher']), apiDeleteGrade);

/* =========================================================
   3. Навчальні семестри (/api/semesters)
   ========================================================= */
// GET /api/semesters — перегляд усіх семестрів
router.get('/semesters', apiGetSemesters);
// GET /api/semesters/:id — деталі одного семестру
router.get('/semesters/:id', apiGetSemesterById);
// GET /api/semesters/:id/grading-state — перевірка можливості оцінювання у семестрі
router.get('/semesters/:id/grading-state', apiGetSemesterGradingState);
// POST /api/semesters — створення семестру
router.post('/semesters', ensureApiRole(['admin', 'teacher']), apiCreateSemester);
// PUT /api/semesters/:id — редагування семестру
router.put('/semesters/:id', ensureApiRole(['admin', 'teacher']), apiUpdateSemester);
// PATCH /api/semesters/:id/status — зміна статусу семестру (planned, active, completed)
router.patch('/semesters/:id/status', ensureApiRole(['admin', 'teacher']), apiUpdateSemesterStatus);
// DELETE /api/semesters/:id — видалення семестру
router.delete('/semesters/:id', ensureApiRole(['admin']), apiDeleteSemester);

/* =========================================================
   4. Заявки викладачів на предмети та доступи (/api/subject-requests)
   ========================================================= */
// GET /api/subject-requests — список заявок
router.get('/subject-requests', ensureApiRole(['admin', 'teacher']), apiGetSubjectRequests);
// GET /api/subject-requests/:id — деталі однієї заявки
router.get('/subject-requests/:id', ensureApiRole(['admin', 'teacher']), apiGetSubjectRequestById);
// POST /api/subject-requests — подання заявки викладачем
router.post('/subject-requests', ensureApiRole(['teacher']), apiCreateSubjectRequest);
// POST /api/subject-requests/:id/approve — схвалення адміністратором
router.post('/subject-requests/:id/approve', ensureApiRole(['admin']), apiApproveSubjectRequest);
// POST /api/subject-requests/:id/reject — відхилення адміністратором
router.post('/subject-requests/:id/reject', ensureApiRole(['admin']), apiRejectSubjectRequest);
// POST /api/subject-requests/revoke-access — адміністративне рішення (обмеження / повне відкликання / поновлення)
router.post('/subject-requests/revoke-access', ensureApiRole(['admin']), apiRevokeSubjectAccess);

/* =========================================================
   5. Запрошення співвикладачів (/api/invitations)
   ========================================================= */
// GET /api/invitations — вхідні та надіслані запрошення
router.get('/invitations', ensureApiRole(['admin', 'teacher']), apiGetInvitations);
// GET /api/invitations/:id — перегляд запрошення
router.get('/invitations/:id', ensureApiRole(['admin', 'teacher']), apiGetInvitationById);
// POST /api/invitations — надсилання запрошення колезі
router.post('/invitations', ensureApiRole(['admin', 'teacher']), apiCreateInvitation);
// POST /api/invitations/:id/accept — прийняття запрошення
router.post('/invitations/:id/accept', ensureApiRole(['teacher']), apiAcceptInvitation);
// POST /api/invitations/:id/decline — відхилення запрошення
router.post('/invitations/:id/decline', ensureApiRole(['teacher']), apiDeclineInvitation);

/* =========================================================
   6. Навчальні курси (/api/courses)
   ========================================================= */
// GET /api/courses — закріплені курси
router.get('/courses', ensureApiRole(['admin', 'teacher']), apiGetCourses);
// GET /api/courses/:id — деталі курсу
router.get('/courses/:id', ensureApiRole(['admin', 'teacher']), apiGetCourseById);
// GET /api/courses/:id/students — контингент студентів та журнал курсу
router.get('/courses/:id/students', ensureApiRole(['admin', 'teacher']), apiGetCourseStudents);
// POST /api/courses — створення та закріплення курсу
router.post('/courses', ensureApiRole(['admin', 'teacher']), apiCreateCourse);
// DELETE /api/courses/:id — видалення курсу
router.delete('/courses/:id', ensureApiRole(['admin']), apiDeleteCourse);

/* =========================================================
   7. Реєстрація викладачів адміністратором
   ========================================================= */
router.post('/teachers/register', ensureApiRole(['admin']), apiRegisterTeacher);

/* =========================================================
   8. Універсальний CRUD API для всіх сутностей системи
   ========================================================= */
router.get('/tables/:tableName', ensureApiRole(['admin']), apiListTableRecords);
router.get('/tables/:tableName/:id', ensureApiRole(['admin']), apiGetTableRecord);
router.post('/tables/:tableName', ensureApiRole(['admin']), apiCreateTableRecord);
router.put('/tables/:tableName/:id', ensureApiRole(['admin']), apiUpdateTableRecord);
router.patch('/tables/:tableName/:id', ensureApiRole(['admin']), apiUpdateTableRecord);
router.delete('/tables/:tableName/:id', ensureApiRole(['admin']), apiDeleteTableRecord);
router.get('/tables/:tableName/:id/relations', ensureApiRole(['admin']), apiCheckTableRelations);

/* =========================================================
   9. Стандартні іменовані REST ресурси (аліаси)
   ========================================================= */
const standardResources = [
  'students',
  'teachers',
  'groups',
  'subjects',
  'departments',
  'specializations',
  'education_forms',
  'control_types',
  'course_assignments',
  'success_rate',
  'users',
  'course_invitations',
  'subject_requests'
];

standardResources.forEach(resName => {
  router.get(`/${resName}`, ensureApiRole(['admin']), (req, res, next) => {
    req.params.tableName = resName;
    return apiListTableRecords(req, res, next);
  });
  router.get(`/${resName}/:id`, ensureApiRole(['admin']), (req, res, next) => {
    req.params.tableName = resName;
    return apiGetTableRecord(req, res, next);
  });
  router.post(`/${resName}`, ensureApiRole(['admin']), (req, res, next) => {
    req.params.tableName = resName;
    return apiCreateTableRecord(req, res, next);
  });
  router.put(`/${resName}/:id`, ensureApiRole(['admin']), (req, res, next) => {
    req.params.tableName = resName;
    return apiUpdateTableRecord(req, res, next);
  });
  router.delete(`/${resName}/:id`, ensureApiRole(['admin']), (req, res, next) => {
    req.params.tableName = resName;
    return apiDeleteTableRecord(req, res, next);
  });
  router.get(`/${resName}/:id/relations`, ensureApiRole(['admin']), (req, res, next) => {
    req.params.tableName = resName;
    return apiCheckTableRelations(req, res, next);
  });
});

export default router;
