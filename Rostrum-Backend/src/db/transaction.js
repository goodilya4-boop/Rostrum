const db = require('../config/db');

const ISOLATION_LEVELS = new Set([
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE',
]);

async function withTransaction(work, options = {}) {
  if (typeof work !== 'function') {
    throw new TypeError('Transaction work must be a function');
  }

  const isolationLevel = options.isolationLevel || 'READ COMMITTED';
  if (!ISOLATION_LEVELS.has(isolationLevel)) {
    throw new TypeError(`Unsupported transaction isolation level: ${isolationLevel}`);
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);

    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
