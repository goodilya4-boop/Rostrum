const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/config/db');
const { generateToken } = require('../src/utils/jwt');

const token = generateToken({ user_id: 401, email: 'sessions@example.test' });
let baseUrl;
let server;

function post(path, body, authorized = true) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorized ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

test.before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await db.end();
});

test('session endpoints требуют JWT', async () => {
  const response = await post('/api/sessions', {
    presentation_id: 1,
    time_limit_sec: 420,
    speech_engine: 'web',
  }, false);
  assert.equal(response.status, 401);
});

test('создание сессии отклоняет неверный регламент и ASR engine', async () => {
  const invalidTime = await post('/api/sessions', {
    presentation_id: 1,
    time_limit_sec: 30,
    speech_engine: 'web',
  });
  const invalidEngine = await post('/api/sessions', {
    presentation_id: 1,
    time_limit_sec: 420,
    speech_engine: 'unknown',
  });

  assert.equal(invalidTime.status, 400);
  assert.equal(invalidEngine.status, 400);
});

test('транскрипт с обратными временными границами отклоняется', async () => {
  const response = await post('/api/sessions/7/transcripts', {
    segments: [{
      segment_id: 'segment-1',
      start_ms: 2000,
      end_ms: 1000,
      spoken_text: 'некорректный сегмент',
    }],
  });
  assert.equal(response.status, 400);
});

test('переключение с отрицательным временем отклоняется', async () => {
  const response = await post('/api/sessions/7/slide-changes', {
    changes: [{ slide_index: 1, timestamp_offset_ms: -1 }],
  });
  assert.equal(response.status, 400);
});
