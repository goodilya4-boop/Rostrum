const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const app = require('../src/app');
const db = require('../src/config/db');
const UserModel = require('../src/models/user.model');
const { generateToken } = require('../src/utils/jwt');

const userId = 301;
const ownerToken = generateToken({ user_id: userId, email: 'settings@example.test' });
const strangerToken = generateToken({ user_id: 302, email: 'stranger@example.test' });
const originalMethods = {};
let baseUrl;
let server;
let passwordHash;
let storedUser;

function request(path, token, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

test.before(async () => {
  passwordHash = await bcrypt.hash('current-password', 4);
  storedUser = {
    id: userId,
    email: 'settings@example.test',
    last_name: 'Иванов',
    first_name: 'Иван',
    middle_name: null,
    default_time_limit: 420,
    prefer_offline_asr: false,
    settings_json: {},
    created_at: new Date().toISOString(),
  };

  for (const method of ['findById', 'findByIdWithPassword', 'update', 'updatePassword']) {
    originalMethods[method] = UserModel[method];
  }
  UserModel.findById = async id => id === userId ? storedUser : null;
  UserModel.findByIdWithPassword = async id => id === userId
    ? { id: userId, password_hash: passwordHash }
    : null;
  UserModel.update = async (id, fields) => {
    if (id !== userId) return null;
    storedUser = { ...storedUser, ...fields };
    return storedUser;
  };
  UserModel.updatePassword = async (id, hash) => {
    if (id !== userId) return false;
    passwordHash = hash;
    return true;
  };

  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  Object.assign(UserModel, originalMethods);
  await db.end();
});

test('профиль доступен только владельцу', async () => {
  const own = await request(`/api/users/${userId}`, ownerToken);
  const foreign = await request(`/api/users/${userId}`, strangerToken);
  assert.equal(own.status, 200);
  assert.equal(foreign.status, 403);
  assert.equal('password_hash' in (await own.json()).user, false);
});

test('настройки сохраняются, а неизвестные поля отклоняются', async () => {
  const invalid = await request(`/api/users/${userId}`, ownerToken, {
    method: 'PATCH',
    body: JSON.stringify({ role: 'admin' }),
  });
  assert.equal(invalid.status, 400);

  const valid = await request(`/api/users/${userId}`, ownerToken, {
    method: 'PATCH',
    body: JSON.stringify({
      first_name: ' Пётр ',
      default_time_limit: 600,
      prefer_offline_asr: true,
      settings_json: { theme: 'dark' },
    }),
  });
  assert.equal(valid.status, 200);
  const { user } = await valid.json();
  assert.equal(user.first_name, 'Пётр');
  assert.equal(user.default_time_limit, 600);
  assert.equal(user.settings_json.theme, 'dark');
});

test('пароль меняется только при корректном текущем значении', async () => {
  const wrong = await request(`/api/users/${userId}/password`, ownerToken, {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: 'wrong-password',
      new_password: 'new-secure-password',
    }),
  });
  assert.equal(wrong.status, 400);

  const valid = await request(`/api/users/${userId}/password`, ownerToken, {
    method: 'PATCH',
    body: JSON.stringify({
      current_password: 'current-password',
      new_password: 'new-secure-password',
    }),
  });
  assert.equal(valid.status, 200);
  assert.equal(await bcrypt.compare('new-secure-password', passwordHash), true);
});
