// Сервіс отримання точного часу та дати із зовнішнього API
// Захищає систему від маніпуляцій з локальним системним годинником комп'ютера

let cachedDateStr = null;
let lastSyncTimestamp = 0;
let timeOffsetMs = 0;
let activeSource = 'pending';
const CACHE_TTL_MS = 60 * 1000; // 1 хвилина для кешу запитів

/**
 * Отримує дату та час з офіційного публічного Time API (часовий пояс Київ)
 */
async function fetchFromTimeApi() {
  const res = await fetch('https://timeapi.io/api/time/current/zone?timeZone=Europe/Kyiv', {
    signal: AbortSignal.timeout(3500)
  });
  if (!res.ok) throw new Error(`TimeAPI status: ${res.status}`);
  const data = await res.json();
  const y = String(data.year);
  const m = String(data.month).padStart(2, '0');
  const d = String(data.day).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  if (data.dateTime) {
    const apiTimeMs = new Date(data.dateTime).getTime();
    timeOffsetMs = apiTimeMs - Date.now();
  }
  cachedDateStr = dateStr;
  lastSyncTimestamp = Date.now();
  activeSource = 'timeapi.io (Europe/Kyiv)';
  return dateStr;
}

/**
 * Резервне отримання часу через Date HTTP-заголовок
 */
async function fetchFromHttpHeader() {
  const res = await fetch('https://www.google.com', {
    method: 'HEAD',
    signal: AbortSignal.timeout(3000)
  });
  const dateHeader = res.headers.get('date');
  if (!dateHeader) throw new Error('No HTTP date header');
  const d = new Date(dateHeader);
  // Конвертація в календарний день за часовим поясом Києва
  const kyivStr = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
  timeOffsetMs = d.getTime() - Date.now();
  cachedDateStr = kyivStr;
  lastSyncTimestamp = Date.now();
  activeSource = 'HTTP Date header (Google)';
  return kyivStr;
}

/**
 * Отримує поточну авторитетну дату у форматі YYYY-MM-DD
 * Якщо кеш актуальний, повертає його миттєво.
 * Якщо кеш застарів, оновлює дату з API.
 */
export async function fetchCurrentDateStr() {
  const isCacheFresh = cachedDateStr && (Date.now() - lastSyncTimestamp < CACHE_TTL_MS);
  if (isCacheFresh) {
    return cachedDateStr;
  }

  try {
    return await fetchFromTimeApi();
  } catch (err) {
    try {
      return await fetchFromHttpHeader();
    } catch (fallbackErr) {
      // Якщо з'єднання відсутнє, використовуємо збережений зсув часу
      const corrected = new Date(Date.now() + timeOffsetMs);
      cachedDateStr = corrected.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
      activeSource = 'offline (calculated with offset)';
      return cachedDateStr;
    }
  }
}

/**
 * Синхронне повернення поточної дати (з урахуванням збереженого зсуву відносно зовнішнього API)
 */
export function getCurrentDateStrSync() {
  if (cachedDateStr && (Date.now() - lastSyncTimestamp < CACHE_TTL_MS)) {
    return cachedDateStr;
  }
  const corrected = new Date(Date.now() + timeOffsetMs);
  return corrected.toLocaleDateString('en-CA', { timeZone: 'Europe/Kyiv' });
}

/**
 * Повертає діагностичну інформацію про синхронізацію
 */
export function getTimeSyncInfo() {
  return {
    currentDate: getCurrentDateStrSync(),
    source: activeSource,
    lastSync: lastSyncTimestamp ? new Date(lastSyncTimestamp).toISOString() : null,
    offsetMs: timeOffsetMs
  };
}

/**
 * Ініціалізація первинної синхронізації та періодичного фонового оновлення
 */
export function initTimeSync() {
  fetchCurrentDateStr()
    .then(date => {
      console.log(`[TimeService] Авторитетна дата синхронізована з API (${activeSource}): ${date}`);
    })
    .catch(err => {
      console.warn(`[TimeService] Помилка первинної синхронізації часу: ${err.message}`);
    });

  // Фонове оновлення кожні 5 хвилин
  setInterval(() => {
    fetchCurrentDateStr().catch(() => {});
  }, 5 * 60 * 1000);
}
