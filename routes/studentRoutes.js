import { Router } from 'express';
import { getStudentProfile } from '../controllers/studentController.js';
import { ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

router.use(ensureAuthenticated);

// Власний профіль студента
router.get('/profile', getStudentProfile);

// Перегляд профілю студента за ID (для викладачів або адміна)
router.get('/profile/:id', (req, res, next) => {
  if (req.user.role === 'visitor' && Number(req.params.id) !== req.user.studentId) {
    return res.status(403).render('common/403.njk', {
      title: 'Доступ заборонено',
      message: 'Студент може переглядати лише власний навчальний профіль.'
    });
  }
  return getStudentProfile(req, res, next);
});

export default router;
