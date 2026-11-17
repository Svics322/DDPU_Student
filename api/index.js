// Імпорт застосунку — динамічний, всередині обробника. Якщо модуль падає на етапі
// завантаження (наприклад, немає нативного бінарника sqlite3), платформа віддала б
// порожній 500. Так помилка перетворюється на читабельну відповідь.
export default async function handler(req, res) {
  try {
    const { default: app, ensureReady } = await import('../app.js');
    await ensureReady();
    return app(req, res);
  } catch (error) {
    console.error('Не вдалося запустити застосунок:', error);
    const stack = String(error?.stack ?? '').split('\n').slice(0, 4).join(' | ');
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify(
        {
          error: 'init_failed',
          message: error?.message ?? String(error),
          stack,
          node: process.version
        },
        null,
        1
      )
    );
  }
}
