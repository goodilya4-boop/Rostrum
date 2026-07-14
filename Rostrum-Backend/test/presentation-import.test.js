const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeOriginalName } = require('../src/middleware/upload');
const { isRehearsalRequest } = require('../src/middleware/rateLimitPolicy');

test('имя загруженного файла декодируется из multipart latin1', () => {
  const mojibake = Buffer.from('Тёмная тема.pptx', 'utf8').toString('latin1');
  assert.equal(normalizeOriginalName(mojibake), 'Тёмная тема.pptx');
  assert.equal(normalizeOriginalName('normal.pdf'), 'normal.pdf');
});

test('частые запросы репетиции отделены от общего лимита API', () => {
  assert.equal(isRehearsalRequest({
    method: 'GET',
    originalUrl: '/api/presentations/2/slides/21/image',
  }), true);
  assert.equal(isRehearsalRequest({
    method: 'POST',
    originalUrl: '/api/sessions/2/slide-changes',
  }), true);
  assert.equal(isRehearsalRequest({
    method: 'POST',
    originalUrl: '/api/auth/login',
  }), false);
});
