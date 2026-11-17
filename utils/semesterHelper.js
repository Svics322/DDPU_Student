// Утиліти для роботи з навчальними семестрами та перевірки часових рамок
// Дата отримується з надійного зовнішнього Time API для уникнення фальсифікацій локального системного часу
import { fetchCurrentDateStr, getCurrentDateStrSync } from '../services/timeService.js';

/**
 * Отримує поточну синхронізовану дату у форматі YYYY-MM-DD
 */
export function getCurrentDateStr() {
  return getCurrentDateStrSync();
}

/**
 * Отримує авторитетну дату безпосередньо з API (асинхронно з оновленням кешу)
 */
export async function getAuthoritativeDateStr() {
  return await fetchCurrentDateStr();
}

/**
 * Перевіряє чи вичерпано термін семестру за авторитетною датою
 */
export function isSemesterDateExpired(semester, today = getCurrentDateStr()) {
  if (!semester || !semester.EndDate) return false;
  return today > semester.EndDate;
}

/**
 * Перевіряє чи дата початку семестру ще не настала
 */
export function isSemesterDateFuture(semester, today = getCurrentDateStr()) {
  if (!semester || !semester.StartDate) return false;
  return today < semester.StartDate;
}

/**
 * Додає прапорці термінів до об'єкта семестру
 */
export function enrichSemesterDateFlags(semester, today = getCurrentDateStr()) {
  const isDateExpired = isSemesterDateExpired(semester, today);
  const isDateFuture = isSemesterDateFuture(semester, today);
  const isDateActive = !isDateExpired && !isDateFuture;
  return {
    isDateExpired,
    isDateFuture,
    isDateActive,
    today
  };
}

/**
 * Визначає можливість оцінювання та виставлення оцінок викладачем
 * @param {Object} semester - об'єкт або запис семестру
 * @param {string|null} customToday - опціональна передана дата YYYY-MM-DD
 * @returns {Object} { canGrade: boolean, reason: string|null, badge: string|null, badgeClass: string|null }
 */
export function getSemesterGradingState(semester, customToday = null) {
  if (!semester) {
    return {
      canGrade: false,
      reason: 'Навчальний семестр не знайдено в системі.',
      badge: 'Недоступно',
      badgeClass: 'badge-secondary'
    };
  }

  const today = customToday || getCurrentDateStr();

  // 1. Семестр офіційно закрито
  if (semester.Status === 'completed') {
    return {
      canGrade: false,
      reason: 'Навчальний семестр закрито. Внесення та редагування оцінок доступне лише адміністратору в загальному журналі.',
      badge: 'Семестр закрито',
      badgeClass: 'badge-secondary'
    };
  }

  // 2. Семестр має статус запланованого
  if (semester.Status === 'planned') {
    return {
      canGrade: false,
      reason: 'Навчальний семестр має статус «Заплановано» (ще не розпочато). Оцінювання відкривається після офіційного початку періоду.',
      badge: 'Семестр не розпочато',
      badgeClass: 'badge-warning'
    };
  }

  // 3. Дата початку ще не настала
  if (semester.StartDate && today < semester.StartDate) {
    return {
      canGrade: false,
      reason: `Навчальний семестр ще не розпочався за розкладом (термін: з ${semester.StartDate} по ${semester.EndDate || '...'}). Внесення оцінок відкриється з ${semester.StartDate}.`,
      badge: 'Семестр не розпочато',
      badgeClass: 'badge-warning'
    };
  }

  // 4. Термін семестру минув за датою
  if (semester.EndDate && today > semester.EndDate) {
    return {
      canGrade: false,
      reason: `Термін навчального семестру вичерпано (завершився ${semester.EndDate}). Внесення та редагування оцінок викладачем заблоковано — редагування доступне лише адміністратору в загальному журналі.`,
      badge: 'Семестр закрито',
      badgeClass: 'badge-secondary'
    };
  }

  // 5. Семестр активний і поточна дата в межах терміну
  return {
    canGrade: true,
    reason: null,
    badge: null,
    badgeClass: null
  };
}

/**
 * Асинхронний варіант перевірки можливості оцінювання з гарантованим оновленням дати з Time API
 */
export async function getSemesterGradingStateAsync(semester) {
  const authoritativeToday = await fetchCurrentDateStr();
  return getSemesterGradingState(semester, authoritativeToday);
}
