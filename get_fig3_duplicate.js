import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0];
}

async function run() {
  console.log('1. Авторизація під обліковим записом викладача (teacher)...');
  const loginData = new URLSearchParams({
    username: 'teacher',
    password: 'teacher123'
  }).toString();

  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData);

  const cookie = extractCookie(loginRes.headers);
  console.log('Авторизація успішна. Отримано сесійний токен.\n');

  console.log('2. Відправка POST-запиту на /api/grades для створення дубліката оцінки (студент ID: 2, курс ID: 14, вид контролю: 3)...');
  const duplicatePayload = JSON.stringify({
    assignmentId: 14,
    studentId: 2,
    controlTypeId: 3,
    assessmentDate: '2026-10-24',
    mark: 92
  }, null, 2);

  console.log('Тіло запиту:');
  console.log(duplicatePayload);
  console.log('\n--- ОЧІКУВАНА ВІДПОВІДЬ СЕРВЕРА ---');

  const gradeRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/grades',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(duplicatePayload),
      'Cookie': cookie
    }
  }, duplicatePayload);

  console.log(`HTTP Status: ${gradeRes.statusCode} ${gradeRes.statusMessage}`);
  try {
    const formattedJson = JSON.stringify(JSON.parse(gradeRes.data), null, 2);
    console.log(formattedJson);
  } catch {
    console.log(gradeRes.data);
  }
}

run();
