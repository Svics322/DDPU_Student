/**
 * RESTful API Клієнт для асинхронної взаємодії з бекендом
 * Забезпечує логування запитів та відповідей у DevTools консолі браузера
 */
async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  // Інформативне логування у консоль розробника браузера
  console.groupCollapsed(`%c[REST API Request] ${method} ${url}`, 'color: #1e3a8a; font-weight: bold;');
  if (options.body) {
    try {
      console.log('Параметри запиту (Payload):', JSON.parse(options.body));
    } catch {
      console.log('Параметри запиту (Raw):', options.body);
    }
  }
  console.log('Заголовки запиту:', headers);
  console.groupEnd();

  try {
    const response = await fetch(url, { ...options, headers });
    let responseData = null;

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    const logColor = response.ok ? '#15803d' : '#b91c1c';
    console.groupCollapsed(
      `%c[REST API Response] ${response.status} ${response.statusText} ← ${method} ${url}`,
      `color: ${logColor}; font-weight: bold;`
    );
    console.log('HTTP Статус:', response.status);
    console.log('Дані відповіді (JSON):', responseData);
    console.groupEnd();

    return {
      ok: response.ok,
      status: response.status,
      data: responseData
    };
  } catch (error) {
    console.error(`%c[REST API Error] ${method} ${url}`, 'color: #b91c1c; font-weight: bold;', error);
    throw error;
  }
}
