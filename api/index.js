import app, { ensureReady } from '../app.js';

// Vercel викликає цю функцію на кожен запит. Ініціалізація БД виконується один раз
// на інстанс (ensureReady кешує проміс), а далі запит передається у Express.
export default async function handler(req, res) {
  await ensureReady();
  return app(req, res);
}
