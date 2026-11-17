import express from 'express';
import session from 'express-session';
import connectSessionSequelize from 'connect-session-sequelize';
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, Semester, SubjectRequest, CourseInvitation } from './models/index.js';
import passport from './config/passport.js';
import { initAndSeedUsers } from './config/seedUsers.js';
import { initTimeSync } from './services/timeService.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import mainRoutes from './routes/mainRoutes.js';
import apiRoutes from './routes/apiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Конфігурація шаблонізатора Nunjucks
nunjucks.configure([
  path.join(__dirname, 'views'),
  path.join(process.cwd(), 'views'),
  path.join(process.cwd(), 'src', 'views')
], {
  autoescape: true,
  express: app,
  watch: true
});

app.set('view engine', 'njk');

// Парсери тіла запиту
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статичні ресурси (CSS стилі та клієнтські скрипти REST API)
app.use(express.static(path.join(__dirname, 'public')));

// Налаштування сесій.
// Сховище в Postgres, а не в памʼяті: serverless-інстанси не поділяють памʼять,
// тому MemoryStore розлогінював користувача при переході на інший інстанс.
const SequelizeStore = connectSessionSequelize(session.Store);
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions',
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 24 * 60 * 60 * 1000
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'super_secret_lab4_key_2026',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 24 години
  }
}));

// Ініціалізація Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Глобальний middleware для передачі користувача у шаблони
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated ? req.isAuthenticated() : false;
  next();
});

// Favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Маршрутизація
// HTML не кешуємо: інакше браузер показує сторінку з попереднього деплою
// (саме так виглядав «404 на /admin/tables» при живому сервері).
app.use((req, res, next) => {
  res.set('cache-control', 'no-store');
  next();
});

// Самодіагностика: показує, який саме коміт віддає цей інстанс і чи бачить він сесію.
// Корисно, коли браузер показує стару сторінку, а сервер уже оновлений.
app.get('/__health', (req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.json({
    ok: true,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7),
    node: process.version,
    dialect: sequelize.getDialect(),
    authenticated: Boolean(req.isAuthenticated && req.isAuthenticated()),
    role: req.user?.role ?? null
  });
});

// Голий /admin без підшляху не має віддавати 404
app.get('/admin', (req, res) => res.redirect('/admin/tables'));

app.use('/api', apiRoutes);
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/teacher', teacherRoutes);
app.use('/student', studentRoutes);
app.use('/', mainRoutes);

// Обробник 404
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).render('common/error.njk', {
    error: `Сторінку не знайдено (404). Запит: ${req.method} ${req.originalUrl}`
  });
});

// Обробник помилок
app.use((err, req, res, next) => {
  console.error('Помилка сервера:', err);
  res.status(500).render('common/error.njk', { error: err.message });
});

const bootstrap = async () => {
  try {
    await sequelize.authenticate();
    console.log('З\'єднання з базою даних встановлено.');

    // Схема — ПЕРЕД сідами: User має зовнішній ключ на teachers.
    // Повний sync() робить інтроспекцію всіх таблиць і на холодному старті додає
    // помітну затримку, тому на Postgres спершу дешево перевіряємо, чи схема вже є.
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.sync();
    } else {
      const [existing] = await sequelize.query("select to_regclass('public.users') as present");
      if (!existing?.[0]?.present) {
        await sequelize.sync();
      }
    }

    // Синхронізація/посів користувачів
    await initAndSeedUsers();

    // Досинхронізовуємо моделі, які могли зʼявитися пізніше за основний sync
    await Semester.sync();
    await SubjectRequest.sync();
    await CourseInvitation.sync();
    await sessionStore.sync();

    // Синхронізація авторитетного часу з зовнішнім Time API
    // (на serverless інтервали не мають сенсу — процес живе один запит)
    if (!process.env.VERCEL) {
      initTimeSync();
    }
  } catch (error) {
    console.error('Помилка ініціалізації застосунку:', error.message);
    throw error;
  }
};

// Ініціалізація виконується один раз на інстанс, скільки б запитів не прийшло
let bootPromise = null;
export const ensureReady = () => (bootPromise ??= bootstrap());

export default app;

if (!process.env.VERCEL) {
  ensureReady()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Сервер успішно запущено: http://localhost:${PORT}`);
      });
    })
    .catch(() => {
      /* помилка вже залогована */
    });
}
