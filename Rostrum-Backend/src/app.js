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

// Сначала ждём, пока подготовится обработка русских слов.
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

// Основные настройки приложения
app.disable('x-powered-by');
if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);
app.use(helmet());
app.use(cors({ origin: env.cors.origins, credentials: true }));
app.use(requestIdMiddleware);
app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.requestBodyLimit }));

// Записываем запросы в журнал
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) },
}));

// Ограничиваем слишком частые запросы
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

// Ответ для неизвестного адреса
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Маршрут не найден', status: 404 } });
});

// Общая обработка ошибок
app.use(errorHandler);

// Запускаем сервер, если файл вызван напрямую
if (require.main === module) {
  morphologyReady.then(() => {
    const PORT = env.port;
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${env.nodeEnv} mode`);
      logger.info(`API: http://localhost:${PORT}/api`);
      logger.info(`Health: http://localhost:${PORT}/api/health`);
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
