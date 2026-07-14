const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/db');
const { withTransaction } = require('../src/db/transaction');

const originalConnect = db.connect;

test.afterEach(() => {
  db.connect = originalConnect;
});

function fakeClient({ rollbackError = null } = {}) {
  const statements = [];
  let released = 0;
  return {
    statements,
    get released() { return released; },
    async query(sql) {
      statements.push(sql);
      if (sql === 'ROLLBACK' && rollbackError) throw rollbackError;
      return { rows: [] };
    },
    release() { released += 1; },
  };
}

test('транзакция выполняет BEGIN, COMMIT и освобождает соединение', async () => {
  const client = fakeClient();
  db.connect = async () => client;

  const result = await withTransaction(async executor => {
    assert.equal(executor, client);
    await executor.query('SELECT 1');
    return 'done';
  }, { isolationLevel: 'SERIALIZABLE' });

  assert.equal(result, 'done');
  assert.deepEqual(client.statements, [
    'BEGIN',
    'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
    'SELECT 1',
    'COMMIT',
  ]);
  assert.equal(client.released, 1);
});

test('ошибка работы вызывает ROLLBACK и сохраняет исходную ошибку', async () => {
  const client = fakeClient();
  db.connect = async () => client;
  const failure = new Error('operation failed');

  await assert.rejects(
    withTransaction(async () => { throw failure; }),
    error => error === failure
  );
  assert.deepEqual(client.statements, [
    'BEGIN',
    'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
    'ROLLBACK',
  ]);
  assert.equal(client.released, 1);
});

test('ошибка ROLLBACK прикрепляется к основной ошибке', async () => {
  const rollbackFailure = new Error('rollback failed');
  const client = fakeClient({ rollbackError: rollbackFailure });
  db.connect = async () => client;
  const failure = new Error('operation failed');

  await assert.rejects(
    withTransaction(async () => { throw failure; }),
    error => error === failure && error.rollbackError === rollbackFailure
  );
  assert.equal(client.released, 1);
});

test('неподдерживаемый уровень изоляции отклоняется до подключения к БД', async () => {
  let connected = false;
  db.connect = async () => { connected = true; };

  await assert.rejects(
    withTransaction(async () => {}, { isolationLevel: 'INVALID' }),
    /Unsupported transaction isolation level/
  );
  assert.equal(connected, false);
});
