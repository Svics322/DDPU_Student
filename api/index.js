import app, { ensureReady } from '../app.js';

// Vercel викликає цю функцію на кожен запит. Ініціалізація БД виконується один раз
// на інстанс (ensureReady кешує проміс), а далі запит передається у Express.
export default async function handler(req, res) {
  try {
    await ensureReady();
  } catch (error) {
    // Без цього платформа віддає порожній 500 і причину видно лише у Function Logs.
    console.error('Не вдалося ініціалізувати застосунок:', error);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: 'init_failed',
        message: error?.message ?? String(error),
        hint: 'Перевірте налаштування бази даних і логи функції'
      })
    );
    return;
  }
  return app(req, res);
}
