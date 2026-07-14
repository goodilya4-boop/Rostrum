const logger = require('../utils/logger');
const multer = require('multer');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let statusCode = err.statusCode || err.status || 500;
  let isOperational = Boolean(err.isOperational || err.statusCode || err.status);

  if (err instanceof multer.MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    isOperational = true;
  }

  const message = isOperational ? err.message : 'Внутренняя ошибка сервера';

  logger.error({
    requestId: req.requestId,
    error: err.message,
    statusCode,
    path: req.path,
    method: req.method,
  }, 'Request error');

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
    },
  });
};

module.exports = errorHandler;
