const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProduction } = require('../src/config/env');

function productionConfig(overrides = {}) {
  return {
    nodeEnv: 'production',
    jwt: { secret: 'a'.repeat(64) },
    db: { password: 'strong-database-password' },
    cors: { origins: ['https://rostrum.example.com'] },
    asr: { voskServiceUrl: '', voskServiceToken: '' },
    ...overrides,
  };
}

test('валидная production-конфигурация принимается', () => {
  assert.doesNotThrow(() => validateProduction(productionConfig()));
});

test('production запрещает демонстрационные секреты и wildcard CORS', () => {
  const config = productionConfig({
    jwt: { secret: 'change-me' },
    db: { password: 'replace-with-strong-password' },
    cors: { origins: ['*'] },
  });

  assert.throws(
    () => validateProduction(config),
    error => /JWT_SECRET/.test(error.message)
      && /DB_PASSWORD/.test(error.message)
      && /CORS_ORIGIN/.test(error.message)
  );
});

test('production требует токен для настроенного Vosk', () => {
  const config = productionConfig({
    asr: { voskServiceUrl: 'http://vosk:2700', voskServiceToken: 'short' },
  });

  assert.throws(() => validateProduction(config), /VOSK_SERVICE_TOKEN/);
});

test('строгая проверка не применяется в development', () => {
  const config = productionConfig({
    nodeEnv: 'development',
    jwt: { secret: 'change-me' },
    db: { password: 'change-me' },
    cors: { origins: ['*'] },
  });
  assert.doesNotThrow(() => validateProduction(config));
});
