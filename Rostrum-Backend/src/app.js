const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const requestIdMiddleware = require('./middleware/requestId');
const logger = require('./utils/logger');
const db = require('./config/db');
const { initMorph } = require('./utils/textComparison');
const { isRehearsalRequest } = require('./middleware/rateLimitPolicy');

// Сервер начинает принимать запросы только после выбора стабильного режима
// нормализации: морфология az либо детерминированный fallback-стемминг.
const morphologyReady = new Promise(resolve => {
  initMorph(() => {
    logger.info('Morphological analyzer ready');
    resolve();
  });
});

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const presentationsRoutes = require('./routes/presentations.routes');
const sessionsRoutes = require('./routes/sessions.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();

// Базовые middleware
app.disable('x-powered-by');
if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);
app.use(helmet());
app.use(cors({ origin: env.cors.origins, credentials: true }));
app.use(requestIdMiddleware);
app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.requestBodyLimit }));

// Логирование HTTP запросов
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) },
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.apiMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Слишком много запросов', status: 429 } },
  skip: isRehearsalRequest,
});

const rehearsalLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.rehearsalMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Слишком много запросов репетиции', status: 429 } },
  skip: req => !isRehearsalRequest(req),
});

const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Слишком много попыток входа', status: 429 } },
});

app.use('/api/', apiLimiter);
app.use('/api/', rehearsalLimiter);
app.use('/api/auth', authLimiter);

// Маршруты
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/presentations', presentationsRoutes);
app.use('/api/sessions', sessionsRoutes);

// Swagger (если установлен)
try {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./config/swagger');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  logger.info('Swagger docs available at /api/docs');
} catch (e) {
  logger.warn('Swagger not configured');
}

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Маршрут не найден', status: 404 } });
});

// Глобальный обработчик ошибок
app.use(errorHandler);

// Запуск сервера
if (require.main === module) {
  morphologyReady.then(() => {
    const PORT = env.port;
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${env.nodeEnv} mode`);
      logger.info(`API: http://localhost:${PORT}/api`);
      logger.info(`Health: http://localhost:${PORT}/api/health`);
      logger.info(`Docs: http://localhost:${PORT}/api/docs`);
    });

    let shuttingDown = false;
    async function shutdown(signal) {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal }, 'Graceful shutdown started');
      const forcedExit = setTimeout(() => {
        logger.error('Graceful shutdown timeout exceeded');
        process.exit(1);
      }, env.shutdownTimeoutMs);
      forcedExit.unref();

      server.close(async error => {
        try {
          await db.end();
        } catch (dbError) {
          logger.error({ error: dbError.message }, 'Failed to close database pool');
        }
        clearTimeout(forcedExit);
        if (error) {
          logger.error({ error: error.message }, 'HTTP server shutdown failed');
          process.exit(1);
        }
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });
    }

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  });
}

app.locals.morphologyReady = morphologyReady;
module.exports = app;
