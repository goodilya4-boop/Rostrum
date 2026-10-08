const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const LOCK_NAME = 'rostrum_schema_migrations';
const DB_SCHEMA = 'medtrak';

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function loadMigrations() {
  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter(file => /^\d+_[a-z0-9_]+\.js$/i.test(file))
    .sort((a, b) => a.localeCompare(b, 'en'));

  const migrations = [];
  const versions = new Set();

  for (const file of files) {
    const definition = require(path.join(MIGRATIONS_DIR, file));
    if (!definition.version || !definition.name || !definition.sourceFile) {
      throw new Error(`Invalid migration definition: ${file}`);
    }
    if (versions.has(definition.version)) {
      throw new Error(`Duplicate migration version: ${definition.version}`);
    }

    const sql = await fs.readFile(definition.sourceFile, 'utf8');
    const sourceChecksum = checksum(sql);
    if (definition.sourceChecksum && definition.sourceChecksum !== sourceChecksum) {
      throw new Error(`Migration source changed unexpectedly: ${file}`);
    }
    versions.add(definition.version);
    migrations.push({
      version: String(definition.version),
      name: definition.name,
      sql,
      checksum: definition.checksum || sourceChecksum,
    });
  }

  return migrations;
}

function readBaselineVersion(argv) {
  const inline = argv.find(arg => arg.startsWith('--baseline='));
  if (inline) return inline.slice('--baseline='.length);

  const index = argv.indexOf('--baseline');
  return index >= 0 ? argv[index + 1] : null;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function migrate({ baselineVersion = null } = {}) {
  const migrations = await loadMigrations();
  if (baselineVersion && !migrations.some(migration => migration.version === baselineVersion)) {
    throw new Error(`Unknown baseline migration version: ${baselineVersion}`);
  }
  const client = await db.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${DB_SCHEMA}`);
    const schemaMigrations = await client.query(
      "SELECT to_regclass('public.schema_migrations') AS public_table, to_regclass('medtrak.schema_migrations') AS medtrak_table"
    );
    const existingPublicMigrations = schemaMigrations.rows[0]?.public_table;
    const existingMedtrakMigrations = schemaMigrations.rows[0]?.medtrak_table;
    if (existingPublicMigrations && !existingMedtrakMigrations) {
      await client.query('ALTER TABLE public.schema_migrations SET SCHEMA medtrak');
    }
    await client.query(`SET search_path TO ${DB_SCHEMA}, public`);
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_NAME]);
    await ensureMigrationsTable(client);

    const { rows } = await client.query(
      'SELECT version, name, checksum FROM schema_migrations ORDER BY version'
    );
    const applied = new Map(rows.map(row => [row.version, row]));

    for (const migration of migrations) {
      const existing = applied.get(migration.version);
      if (existing) {
        if (existing.checksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.version}_${migration.name} was changed after it was applied`
          );
        }
        console.log(`Already applied ${migration.version}_${migration.name}`);
        continue;
      }

      const baseline = baselineVersion === migration.version;
      await client.query('BEGIN');
      try {
        if (!baseline) await client.query(migration.sql);
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum)
           VALUES ($1, $2, $3)`,
          [migration.version, migration.name, migration.checksum]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }

      console.log(`${baseline ? 'Baselined' : 'Applied'} ${migration.version}_${migration.name}`);
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]);
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  const baselineVersion = readBaselineVersion(process.argv.slice(2));
  migrate({ baselineVersion })
    .then(() => db.end())
    .catch(async error => {
      console.error('Migration failed:', error.message);
      await db.end();
      process.exitCode = 1;
    });
}

module.exports = { checksum, loadMigrations, migrate, readBaselineVersion };
