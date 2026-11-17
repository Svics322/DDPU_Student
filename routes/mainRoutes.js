import { Router } from 'express';
import { renderSuccessRatePage } from '../controllers/successRateController.js';
import { ensureAuthenticated, ensureRole } from '../middleware/auth.js';

const router = Router();

router.use(ensureAuthenticated);

// Головна сторінка: перенаправляє на відповідний робочий простір за роллю
router.get('/', (req, res) => {
  if (req.user.role === 'admin') {
    return res.redirect('/admin/tables');
  } else if (req.user.role === 'teacher') {
    return res.redirect('/teacher/courses');
  } else {
    return res.redirect('/student/profile');
  }
});

// Загальна відомість успішності (доступна всім авторизованим ролям)
router.get('/success-rates', renderSuccessRatePage);

// Сумісність зі старими посиланнями /crud/:tableName (лише для адміна)
router.get('/crud/:tableName', ensureRole(['admin']), (req, res) => {
  res.redirect(`/admin/tables/${req.params.tableName}`);
});
router.get('/crud/:tableName/create', ensureRole(['admin']), (req, res) => {
  res.redirect(`/admin/tables/${req.params.tableName}/create`);
});
router.get('/crud/:tableName/edit/:id', ensureRole(['admin']), (req, res) => {
  res.redirect(`/admin/tables/${req.params.tableName}/edit/${req.params.id}`);
});

export default router;
