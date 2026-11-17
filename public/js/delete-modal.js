/**
 * Логіка модального вікна каскадного видалення через RESTful API
 */
let currentDeleteApiUrl = '';

function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function showNormalConfirmState(apiUrl, itemName) {
  currentDeleteApiUrl = apiUrl;
  const titleEl = document.getElementById('deleteModalTitle');
  const nameEl = document.getElementById('deleteModalItemName');
  const submitBtn = document.getElementById('deleteModalSubmitBtn');

  const loadingBody = document.getElementById('deleteModalLoading');
  const normalBody = document.getElementById('deleteModalNormalBody');
  const cascadeBody = document.getElementById('deleteModalCascadeBody');
  const footer = document.getElementById('deleteModalFooter');

  if (titleEl) {
    titleEl.textContent = 'Підтвердження видалення';
    titleEl.style.color = '#0f172a';
  }
  if (nameEl) nameEl.textContent = itemName || 'Обраний запис';
  if (submitBtn) {
    submitBtn.textContent = 'Підтвердити видалення';
    submitBtn.disabled = false;
  }

  if (loadingBody) loadingBody.style.display = 'none';
  if (normalBody) normalBody.style.display = 'block';
  if (cascadeBody) cascadeBody.style.display = 'none';
  if (footer) footer.style.display = 'flex';
}

function showCascadeConfirmState(apiUrl, itemName, details) {
  currentDeleteApiUrl = apiUrl;
  const titleEl = document.getElementById('deleteModalTitle');
  const nameEl = document.getElementById('deleteModalCascadeItemName');
  const listEl = document.getElementById('deleteModalRelationsList');
  const submitBtn = document.getElementById('deleteModalSubmitBtn');

  const loadingBody = document.getElementById('deleteModalLoading');
  const normalBody = document.getElementById('deleteModalNormalBody');
  const cascadeBody = document.getElementById('deleteModalCascadeBody');
  const footer = document.getElementById('deleteModalFooter');

  if (titleEl) {
    titleEl.textContent = 'Каскадне видалення запису';
    titleEl.style.color = '#991b1b';
  }
  if (nameEl) nameEl.textContent = itemName || 'Обраний запис';
  if (submitBtn) {
    submitBtn.textContent = 'Видалити разом із пов\'язаними даними';
    submitBtn.disabled = false;
  }

  if (listEl) {
    listEl.innerHTML = '';
    if (details && details.length > 0) {
      details.forEach(function(item) {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 6px 10px; margin-bottom: 6px; background: #fff; border: 1px solid #fecaca; border-left: 3px solid #dc2626; border-radius: 4px; font-size: 0.85rem; color: #1e293b;';
        li.textContent = item;
        listEl.appendChild(li);
      });
    }
  }

  if (loadingBody) loadingBody.style.display = 'none';
  if (normalBody) normalBody.style.display = 'none';
  if (cascadeBody) cascadeBody.style.display = 'block';
  if (footer) footer.style.display = 'flex';
}

async function openDeleteModalWithCheck(apiUrl, checkUrl, itemName) {
  const modal = document.getElementById('deleteModal');
  if (!modal) return;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (!checkUrl) {
    showNormalConfirmState(apiUrl, itemName);
    return;
  }

  const loadingBody = document.getElementById('deleteModalLoading');
  const normalBody = document.getElementById('deleteModalNormalBody');
  const cascadeBody = document.getElementById('deleteModalCascadeBody');
  const titleEl = document.getElementById('deleteModalTitle');
  const submitBtn = document.getElementById('deleteModalSubmitBtn');

  if (titleEl) {
    titleEl.textContent = 'Перевірка пов\'язаних даних';
    titleEl.style.color = '#0f172a';
  }
  if (loadingBody) loadingBody.style.display = 'block';
  if (normalBody) normalBody.style.display = 'none';
  if (cascadeBody) cascadeBody.style.display = 'none';
  if (submitBtn) submitBtn.disabled = true;

  try {
    const result = await apiFetch(checkUrl, { method: 'GET' });
    if (result.ok && result.data && result.data.hasRelations) {
      showCascadeConfirmState(apiUrl, itemName, result.data.details);
    } else {
      showNormalConfirmState(apiUrl, itemName);
    }
  } catch (err) {
    console.warn('Помилка запиту перевірки, перемикаємо на стандартне підтвердження:', err);
    showNormalConfirmState(apiUrl, itemName);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('deleteModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeDeleteModal();
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeDeleteModal();
  });

  // Делегування відкриття модального вікна
  document.body.addEventListener('click', function(e) {
    const trigger = e.target.closest('[data-delete-url]');
    if (trigger) {
      e.preventDefault();
      const apiUrl = trigger.getAttribute('data-delete-url');
      const checkUrl = trigger.getAttribute('data-check-url');
      const itemName = trigger.getAttribute('data-delete-name');
      openDeleteModalWithCheck(apiUrl, checkUrl, itemName);
    }
  });

  // Обробка форми видалення через REST API DELETE
  const deleteForm = document.getElementById('deleteModalForm');
  if (deleteForm) {
    deleteForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!currentDeleteApiUrl) return;

      const submitBtn = document.getElementById('deleteModalSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Видалення через REST API...';
      }

      try {
        const result = await apiFetch(currentDeleteApiUrl, { method: 'DELETE' });
        if (result.ok && result.data.success) {
          closeDeleteModal();
          window.location.reload();
        } else {
          alert(result.data.error || 'Помилка видалення через REST API.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Спробувати знову';
          }
        }
      } catch (err) {
        alert('Помилка мережі при спробі видалення: ' + err.message);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Спробувати знову';
        }
      }
    });
  }
});
