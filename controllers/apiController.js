/**
 * Фасад для RESTful API контролерів
 * Об'єднує модульні API контролери:
 * - Базові та табличні ресурси (tableApiController)
 * - Реєстрація викладачів (teacherApiController)
 * - Оцінки та відомості (gradeApiController)
 * - Семестри та терміни (semesterApiController)
 * - Заявки на доступ до дисциплін (subjectRequestApiController)
 * - Запрошення співвикладачів (invitationApiController)
 * - Навчальні курси (courseApiController)
 * - Синхронізація часу з Time API (timeApiController)
 */

export {
  apiSuccess,
  apiError,
  formatValidationErrors,
  getSelectOptions,
  getItemDisplayName
} from './api/apiHelpers.js';

export {
  apiListTableRecords,
  apiGetTableRecord,
  apiCreateTableRecord,
  apiUpdateTableRecord,
  apiDeleteTableRecord,
  apiCheckTableRelations
} from './api/tableApiController.js';

export {
  apiRegisterTeacher
} from './api/teacherApiController.js';

export {
  apiGetGrades,
  apiGetGradeById,
  apiSaveGrade,
  apiUpdateGrade,
  apiDeleteGrade
} from './api/gradeApiController.js';

export {
  apiGetSemesters,
  apiGetSemesterById,
  apiCreateSemester,
  apiUpdateSemester,
  apiUpdateSemesterStatus,
  apiDeleteSemester,
  apiGetSemesterGradingState
} from './api/semesterApiController.js';

export {
  apiGetSubjectRequests,
  apiGetSubjectRequestById,
  apiCreateSubjectRequest,
  apiApproveSubjectRequest,
  apiRejectSubjectRequest,
  apiRevokeSubjectAccess
} from './api/subjectRequestApiController.js';

export {
  apiGetInvitations,
  apiGetInvitationById,
  apiCreateInvitation,
  apiAcceptInvitation,
  apiDeclineInvitation
} from './api/invitationApiController.js';

export {
  apiGetCourses,
  apiGetCourseById,
  apiGetCourseStudents,
  apiCreateCourse,
  apiDeleteCourse
} from './api/courseApiController.js';

export {
  apiGetCurrentTime,
  apiSyncTime
} from './api/timeApiController.js';
