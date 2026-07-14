const multer = require('multer');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const crypto = require('crypto');

function normalizeOriginalName(originalName) {
  const name = path.basename(String(originalName || '')).normalize('NFC');

  // Browsers send UTF-8 filenames, while Busboy exposes the multipart value
  // as latin1. Decode only strings that have the characteristic mojibake form.
  if (/^[\u0000-\u00ff]+$/.test(name) && /[\u0080-\u00ff]/.test(name)) {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD')) return decoded.normalize('NFC');
  }

  return name;
}

// Создаем директорию для загрузок, если не существует
if (!fs.existsSync(env.upload.dir)) {
  fs.mkdirSync(env.upload.dir, { recursive: true, mode: 0o700 });
}
try {
  fs.chmodSync(env.upload.dir, 0o700);
} catch {
  // Windows and some mounted filesystems do not implement POSIX modes.
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
    'application/octet-stream', // sometimes pptx is detected as octet-stream
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
