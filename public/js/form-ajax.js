/**
 * Обробка відправки форм через асинхронний RESTful API
 * з динамічним відображенням помилок валідації
 */
function displayFormErrors(form, resultData, alertEl) {
  if (resultData && resultData.fieldErrors) {
    Object.keys(resultData.fieldErrors).forEach(fieldName => {
      const inputEl = document.getElementById(fieldName) || form.elements[fieldName];
      if (inputEl) {
        inputEl.classList.add('input-error');
        const span = document.createElement('span');
        span.className = 'error-text';
        span.textContent = resultData.fieldErrors[fieldName];
        inputEl.parentElement.appendChild(span);
      }
    });
  }
  if (resultData && resultData.error && alertEl) {
    alertEl.textContent = resultData.error;
    alertEl.style.display = 'block';
  }
}

function clearFormErrors(form, alertEl) {
  form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  form.querySelectorAll('.error-text').forEach(el => el.remove());
  if (alertEl) alertEl.style.display = 'none';
}

function initFormHandler(config) {
  const form = document.getElementById(config.formId);
  if (!form) return;

  const alertEl = document.getElementById(config.alertId);
  const submitBtn = document.getElementById(config.btnId);

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    clearFormErrors(form, alertEl);

    const originalText = submitBtn ? submitBtn.textContent : 'Зберегти';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = config.loadingText || 'Збереження...';
    }

    const payload = {};
    new FormData(form).forEach((val, key) => { payload[key] = val; });

    const requestInfo = config.getRequestInfo(form, payload);

    try {
      const result = await apiFetch(requestInfo.url, {
        method: requestInfo.method,
        body: payload
      });

      if (result.ok && result.data.success) {
        const redirectUrl = config.getSuccessUrl(form, payload, result.data);
        window.location.href = redirectUrl;
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
        displayFormErrors(form, result.data, alertEl);
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
      if (alertEl) {
        alertEl.textContent = 'Помилка мережі при зверненні до REST API: ' + err.message;
        alertEl.style.display = 'block';
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // 1. Універсальна форма адміна (створення / редагування)
  initFormHandler({
    formId: 'entityForm',
    alertId: 'globalAlert',
    btnId: 'submitFormBtn',
    loadingText: 'Збереження через REST API...',
    getRequestInfo: (form) => ({
      url: form.getAttribute('data-api-url'),
      method: form.getAttribute('data-method') || 'POST'
    }),
    getSuccessUrl: (form) =>
      form.getAttribute('data-redirect-url') || window.location.pathname.replace(/\/create|\/edit\/.*$/, '')
  });

  // 2. Форма реєстрації викладача
  initFormHandler({
    formId: 'teacherRegisterForm',
    alertId: 'teacherGlobalAlert',
    btnId: 'teacherSubmitBtn',
    loadingText: 'Реєстрація через REST API...',
    getRequestInfo: () => ({ url: '/api/teachers/register', method: 'POST' }),
    getSuccessUrl: () => '/admin/tables/teachers'
  });

  // 3. Форма оцінювання викладача
  initFormHandler({
    formId: 'gradeForm',
    alertId: 'gradeGlobalAlert',
    btnId: 'gradeSubmitBtn',
    loadingText: 'Збереження через REST API...',
    getRequestInfo: (form, payload) => ({
      url: payload.gradeId ? `/api/grades/${payload.gradeId}` : '/api/grades',
      method: payload.gradeId ? 'PUT' : 'POST'
    }),
    getSuccessUrl: (form, payload) =>
      `/teacher/courses/${payload.assignmentId || 1}/students`
  });
});
