import { fetchCurrentDateStr, getCurrentDateStrSync, getTimeSyncInfo } from '../../services/timeService.js';
import { apiSuccess, apiError } from './apiHelpers.js';

/**
 * Отримання авторитетного системного часу та дати (з зовнішнього Time API)
 * GET /api/time/current
 */
export const apiGetCurrentTime = async (req, res) => {
  try {
    const dateStr = await fetchCurrentDateStr();
    const info = getTimeSyncInfo();
    return apiSuccess(res, {
      currentDate: dateStr,
      timeZone: 'Europe/Kyiv',
      syncInfo: info
    });
  } catch (error) {
    return apiError(res, error.message, 500);
  }
};

/**
 * Примусова синхронізація часу з Time API
 * POST /api/time/sync
 */
export const apiSyncTime = async (req, res) => {
  try {
    const dateStr = await fetchCurrentDateStr();
    const info = getTimeSyncInfo();
    return apiSuccess(res, {
      message: 'Час успішно синхронізовано із зовнішнім Time API',
      currentDate: dateStr,
      syncInfo: info
    });
  } catch (error) {
    return apiError(res, `Помилка синхронізації часу: ${error.message}`, 500);
  }
};
