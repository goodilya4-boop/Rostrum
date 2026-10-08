function integer(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} должен быть целым числом от ${min} до ${max}`);
  }
  return value;
}

function boolean(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} должен быть true или false`);
}

function csv(name, fallback) {
  const values = String(process.env[name] || fallback)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!values.length) throw new Error(`${name} не должен быть пустым`);
  return values;
}

const nodeEnv = process.env.NODE_ENV || 'development';
if (!['development', 'test', 'production'].includes(nodeEnv)) {
  throw new Error('NODE_ENV должен быть development, test или production');
}

const env = {
  port: integer('PORT', 3000, { min: 1, max: 65535 }),
  nodeEnv,
  trustProxy: integer('TRUST_PROXY', 0, { min: 0, max: 10 }),
  shutdownTimeoutMs: integer('SHUTDOWN_TIMEOUT_MS', 10000, { min: 1000, max: 60000 }),

  db: {
    schema: 'medtrak',
    host: process.env.DB_HOST || 'localhost',
    port: integer('DB_PORT', 5432, { min: 1, max: 65535 }),
    database: process.env.DB_NAME || 'Rostrum',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '3211',
    maxConnections: integer('DB_POOL_MAX', 20, { min: 1, max: 100 }),
    idleTimeoutMs: integer('DB_IDLE_TIMEOUT_MS', 30000, { min: 1000, max: 600000 }),
    connectionTimeoutMs: integer('DB_CONNECTION_TIMEOUT_MS', 5000, { min: 500, max: 60000 }),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMB: integer('MAX_FILE_SIZE_MB', 50, { min: 1, max: 500 }),
    slideImageDir: process.env.SLIDE_IMAGE_DIR || './uploads/slides',
  },

  rendering: {
    libreOfficePath: process.env.LIBREOFFICE_PATH || 'soffice',
    pdfToPpmPath: process.env.PDFTOPPM_PATH || 'pdftoppm',
    dpi: integer('SLIDE_IMAGE_DPI', 144, { min: 72, max: 300 }),
    timeoutMs: integer('RENDER_TIMEOUT_MS', 120000, { min: 1000, max: 600000 }),
    requireNative: boolean('REQUIRE_NATIVE_RENDERING', false),
  },

  asr: {
    voskServiceUrl: process.env.VOSK_SERVICE_URL || '',
    voskServiceToken: process.env.VOSK_SERVICE_TOKEN || '',
    language: process.env.ASR_LANGUAGE || 'ru',
    timeoutMs: integer('ASR_TIMEOUT_MS', 120000, { min: 1000, max: 600000 }),
  },

  cors: {
    origins: csv('CORS_ORIGIN', 'http://localhost:5173'),
  },

  rateLimit: {
    windowMs: integer('RATE_LIMIT_WINDOW_MS', 900000, { min: 1000, max: 86400000 }),
    apiMax: integer('RATE_LIMIT_MAX', 300, { min: 1, max: 100000 }),
    rehearsalMax: integer('REHEARSAL_RATE_LIMIT_MAX', 3000, { min: 1, max: 100000 }),
    authMax: integer('AUTH_RATE_LIMIT_MAX', 20, { min: 1, max: 10000 }),
  },

  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '1mb',
};

function validateProduction(config) {
  if (config.nodeEnv !== 'production') return;
  const errors = [];
  const insecureSecrets = new Set([
    'change-me',
    'your-secret-key-change-in-production',
    '3211',
    'replace-with-strong-password',
    'replace-with-64-char-random-secret',
    'replace-with-shared-token',
  ]);

  if (!config.jwt.secret || config.jwt.secret.length < 32 || insecureSecrets.has(config.jwt.secret)) {
    errors.push('JWT_SECRET должен быть случайной строкой длиной не менее 32 символов');
  }
  if (!config.db.password || insecureSecrets.has(config.db.password)) {
    errors.push('DB_PASSWORD должен быть задан безопасным значением');
  }
  if (config.cors.origins.some(origin => origin === '*' || !/^https?:\/\//.test(origin))) {
    errors.push('CORS_ORIGIN должен содержать точные HTTP(S) origin без wildcard');
  }
  if (config.asr.voskServiceUrl && config.asr.voskServiceToken.length < 16) {
    errors.push('При включённом Vosk задайте VOSK_SERVICE_TOKEN длиной не менее 16 символов');
  }
  if (errors.length) {
    throw new Error(`Некорректная production-конфигурация:\n- ${errors.join('\n- ')}`);
  }
}

validateProduction(env);

module.exports = env;
module.exports.validateProduction = validateProduction;
