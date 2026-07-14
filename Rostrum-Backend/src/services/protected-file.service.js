const path = require('path');
const fs = require('fs').promises;
const AppError = require('../utils/AppError');

const CONTENT_TYPES = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
});

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function open(filePath, allowedRoots) {
  if (!filePath || !Array.isArray(allowedRoots) || allowedRoots.length === 0) {
    throw new AppError('Файл не найден', 404);
  }

  const candidate = path.resolve(filePath);
  const lexicalRoot = allowedRoots.map(root => path.resolve(root)).find(root => isInside(root, candidate));
  if (!lexicalRoot) throw new AppError('Файл не найден', 404);

  let realRoot;
  let realCandidate;
  try {
    [realRoot, realCandidate] = await Promise.all([
      fs.realpath(lexicalRoot),
      fs.realpath(candidate),
    ]);
  } catch {
    throw new AppError('Файл не найден', 404);
  }

  // realpath also prevents a symlink stored below the asset root from escaping it.
  if (!isInside(realRoot, realCandidate)) throw new AppError('Файл не найден', 404);

  let handle;
  try {
    handle = await fs.open(realCandidate, 'r');
    const stat = await handle.stat();
    if (!stat.isFile()) {
      await handle.close();
      throw new AppError('Файл не найден', 404);
    }
    const contentType = CONTENT_TYPES[path.extname(realCandidate).toLowerCase()];
    if (!contentType) {
      await handle.close();
      throw new AppError('Файл не найден', 404);
    }
    return {
      handle,
      size: stat.size,
      contentType,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (handle) await handle.close().catch(() => {});
    throw new AppError('Файл не найден', 404);
  }
}

module.exports = { isInside, open };
