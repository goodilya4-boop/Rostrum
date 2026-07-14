const multer = require('multer');
const AppError = require('../utils/AppError');
const {
  ACCEPTED_AUDIO_MIME_TYPES,
  MAX_AUDIO_CHUNK_BYTES,
} = require('../services/asr-contract');

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_AUDIO_CHUNK_BYTES,
  },
  fileFilter: (req, file, callback) => {
    const mimeType = String(file.mimetype || '').toLowerCase();
    if (!ACCEPTED_AUDIO_MIME_TYPES.includes(mimeType)) {
      callback(new AppError(`Неподдерживаемый аудиоформат: ${mimeType || 'неизвестный'}`, 415));
      return;
    }
    callback(null, true);
  },
});

module.exports = audioUpload;
