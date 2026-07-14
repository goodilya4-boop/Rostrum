const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const bcrypt = require('bcrypt');

async function withAuthService(password, callback) {
  const originalLoad = Module._load;
  const passwordHash = await bcrypt.hash(password, 4);
  let savedHash = null;

  Module._load = function load(request, parent, isMain) {
    if (parent?.filename.endsWith('auth.service.js')) {
      if (request === '../models/user.model') return {
        findByIdWithPassword: async () => ({ id: 5, password_hash: passwordHash }),
        updatePassword: async (id, hash) => {
          assert.equal(id, 5);
          savedHash = hash;
          return true;
        },
      };
      if (request === '../utils/logger') return { info() {} };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const servicePath = require.resolve('../src/services/auth.service');
    delete require.cache[servicePath];
    await callback(require(servicePath), () => savedHash);
  } finally {
    Module._load = originalLoad;
  }
}

test('смена пароля проверяет текущий пароль', async () => {
  await withAuthService('current-password', async service => {
    await assert.rejects(
      service.changePassword({
        userId: 5,
        currentPassword: 'wrong-password',
        newPassword: 'new-secure-password',
      }),
      error => error.statusCode === 400 && /Текущий пароль/.test(error.message)
    );
  });
});

test('смена пароля сохраняет bcrypt-хеш нового значения', async () => {
  await withAuthService('current-password', async (service, getSavedHash) => {
    await service.changePassword({
      userId: 5,
      currentPassword: 'current-password',
      newPassword: 'new-secure-password',
    });

    const savedHash = getSavedHash();
    assert.ok(savedHash);
    assert.equal(await bcrypt.compare('new-secure-password', savedHash), true);
    assert.equal(savedHash.includes('new-secure-password'), false);
  });
});

test('новый пароль должен отличаться от текущего', async () => {
  await withAuthService('same-password', async service => {
    await assert.rejects(
      service.changePassword({
        userId: 5,
        currentPassword: 'same-password',
        newPassword: 'same-password',
      }),
      error => error.statusCode === 400 && /отличаться/.test(error.message)
    );
  });
});
