const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const crypto = require('crypto');

function normalizeOriginalName(originalName) {
  const name = path.basename(String(originalName || '')).normalize('NFC');

  // Исправляем русское имя файла, если оно пришло в другой кодировке.
  if (/^[\u0000-\u00ff]+$/.test(name) && /[\u0080-\u00ff]/.test(name)) {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD')) return decoded.normalize('NFC');
  }

  return name;
}

// Создаём папку для загруженных файлов.
if (!fs.existsSync(env.upload.dir)) {
  fs.mkdirSync(env.upload.dir, { recursive: true, mode: 0o700 });
}
try {
  fs.chmodSync(env.upload.dir, 0o700);
} catch {
  // В Windows такие права доступа могут не поддерживаться.
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, env.upload.dir);
  },
  filename: (req, file, cb) => {
    file.originalname = normalizeOriginalName(file.originalname);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  file.originalname = normalizeOriginalName(file.originalname);
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/pdf', // .pdf
    'application/octet-stream', // Иногда PPTX определяется как обычный файл.
  ];

  const allowedExtensions = ['.pptx', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new AppError('Неподдерживаемый формат файла. Разрешены: .pptx, .pdf', 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.upload.maxFileSizeMB * 1024 * 1024,
  }
});

module.exports = upload;
module.exports.normalizeOriginalName = normalizeOriginalName;
