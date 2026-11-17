import { Router } from 'express';
import { 
  getLoginPage, 
  postLogin, 
  getRegisterPage, 
  postRegister, 
  logout 
} from '../controllers/authController.js';
import { forwardAuthenticated, ensureAuthenticated } from '../middleware/auth.js';

const router = Router();

router.get('/login', forwardAuthenticated, getLoginPage);
router.post('/login', forwardAuthenticated, postLogin);

router.get('/register', forwardAuthenticated, getRegisterPage);
router.post('/register', forwardAuthenticated, postRegister);

router.get('/logout', ensureAuthenticated, logout);
router.post('/logout', ensureAuthenticated, logout);

export default router;
