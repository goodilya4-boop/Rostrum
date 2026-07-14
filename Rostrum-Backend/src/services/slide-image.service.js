const path = require('path');
const fs = require('fs').promises;
const { execFile } = require('child_process');
const { promisify } = require('util');
const env = require('../config/env');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

const execFileAsync = promisify(execFile);

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapPreviewText(text, maxLength = 72, maxLines = 12) {
  const paragraphs = String(text || '').split(/\n+/).map(value => value.trim()).filter(Boolean);
  const lines = [];

  for (const paragraph of paragraphs) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (line && `${line} ${word}`.length > maxLength) {
        lines.push(line);
        line = word;
      } else {
        line += `${line ? ' ' : ''}${word}`;
      }
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length >= maxLines) break;
  }

  if (lines.length === maxLines && paragraphs.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxLength - 1)}…`;
  }
  return lines;
}

function createPreviewSvg(slide, index) {
  const lines = wrapPreviewText(slide.text);
  const textElements = lines.map((line, lineIndex) =>
    `<text x="96" y="${180 + lineIndex * 40}" class="line">${escapeXml(line)}</text>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f7f8fb"/>
  <rect x="0" y="0" width="18" height="720" fill="#5965d8"/>
  <text x="96" y="92" class="number">Слайд ${index + 1}</text>
  ${textElements || '<text x="96" y="180" class="empty">Слайд не содержит извлекаемого текста</text>'}
  <style>
    .number { font: 600 30px Arial, sans-serif; fill: #5965d8; }
    .line { font: 28px Arial, sans-serif; fill: #202334; }
    .empty { font: 28px Arial, sans-serif; fill: #75798c; }
  </style>
</svg>`;
}

async function createSvgPreviews(slides, outputDir) {
  await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });
  const paths = [];
  for (let index = 0; index < slides.length; index++) {
    const imagePath = path.join(outputDir, `slide-${index + 1}.svg`);
    await fs.writeFile(imagePath, createPreviewSvg(slides[index], index), { encoding: 'utf8', mode: 0o600 });
    paths.push(imagePath);
  }
  return paths;
}

async function convertToPdf(file, conversionDir) {
  const extension = path.extname(file.originalname || file.path).toLowerCase();
  if (extension === '.pdf') return path.resolve(file.path);

  await fs.mkdir(conversionDir, { recursive: true });
  await execFileAsync(env.rendering.libreOfficePath, [
    '--headless',
    '--convert-to', 'pdf',
    '--outdir', conversionDir,
    path.resolve(file.path),
  ], {
    timeout: env.rendering.timeoutMs,
    windowsHide: true,
  });

  const convertedName = `${path.basename(file.path, path.extname(file.path))}.pdf`;
  const convertedPath = path.join(conversionDir, convertedName);
  await fs.access(convertedPath);
  return convertedPath;
}

async function renderNative(file, outputDir, expectedCount) {
  const conversionDir = path.join(outputDir, '.conversion');
  const pdfPath = await convertToPdf(file, conversionDir);
  const outputPrefix = path.join(outputDir, 'slide');

  await execFileAsync(env.rendering.pdfToPpmPath, [
    '-png',
    '-r', String(env.rendering.dpi),
    pdfPath,
    outputPrefix,
  ], {
    timeout: env.rendering.timeoutMs,
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });

  const files = (await fs.readdir(outputDir))
    .map(name => ({ name, match: name.match(/^slide-(\d+)\.png$/i) }))
    .filter(item => item.match)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));

  if (files.length !== expectedCount) {
    throw new Error(`Renderer produced ${files.length} images for ${expectedCount} slides`);
  }

  await fs.rm(conversionDir, { recursive: true, force: true });
  return files.map(item => path.join(outputDir, item.name));
}

function getAssetDirectory(file) {
  const storedName = path.basename(file.path, path.extname(file.path));
  return path.resolve(env.upload.slideImageDir, storedName);
}

async function renderSlides(file, slides) {
  const outputDir = getAssetDirectory(file);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });

  try {
    const imagePaths = await renderNative(file, outputDir, slides.length);
    await Promise.all(imagePaths.map(imagePath => fs.chmod(imagePath, 0o600).catch(() => {})));
    logger.info(`Rendered ${imagePaths.length} native slide images for ${file.originalname}`);
    return { imagePaths, outputDir, renderer: 'native' };
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true });
    if (env.rendering.requireNative) {
      const renderError = new AppError('Не удалось создать изображения слайдов', 503);
      renderError.cause = error;
      throw renderError;
    }

    logger.warn({ error: error.message, file: file.originalname },
      'Native renderer unavailable, creating SVG previews');
    const imagePaths = await createSvgPreviews(slides, outputDir);
    return { imagePaths, outputDir, renderer: 'svg-preview' };
  }
}

async function removeSlideImages(imagePaths) {
  const directories = new Set(
    (imagePaths || []).filter(Boolean).map(imagePath => path.dirname(path.resolve(imagePath)))
  );
  const root = path.resolve(env.upload.slideImageDir);

  for (const directory of directories) {
    const relative = path.relative(root, directory);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      logger.error(`Refusing to remove slide image directory outside asset root: ${directory}`);
      continue;
    }
    await fs.rm(directory, { recursive: true, force: true });
  }
}

module.exports = {
  createPreviewSvg,
  createSvgPreviews,
  getAssetDirectory,
  removeSlideImages,
  renderSlides,
  wrapPreviewText,
};
