const path = require('path');
const fs = require('fs').promises;
const decompress = require('decompress');
const { DOMParser } = require('@xmldom/xmldom');
const pdfParse = require('pdf-parse');
const AppError = require('../utils/AppError');

const MAX_SLIDES = 500;
const MAX_PPTX_XML_BYTES = 50 * 1024 * 1024;

function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPptxSlideText(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const parserErrors = document.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) {
    throw new Error('Invalid slide XML');
  }

  const paragraphs = Array.from(document.getElementsByTagName('a:p'));
  const lines = paragraphs.map(paragraph => {
    const textNodes = Array.from(paragraph.getElementsByTagName('a:t'));
    return textNodes
      .map(node => node.textContent || '')
      .join('')
      .trim();
  }).filter(Boolean);

  return normalizeExtractedText(lines.join('\n'));
}

function extractPdfPageText(textContent) {
  const lines = [];
  let currentLine = '';
  let currentY = null;

  for (const item of textContent.items || []) {
    const value = String(item.str || '').trim();
    if (!value) continue;

    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    const startsNewLine = currentY !== null && y !== null && Math.abs(y - currentY) > 2;

    if (startsNewLine && currentLine) {
      lines.push(currentLine.trim());
      currentLine = '';
    }

    currentLine += `${currentLine ? ' ' : ''}${value}`;
    if (item.hasEOL) {
      lines.push(currentLine.trim());
      currentLine = '';
      currentY = null;
    } else if (y !== null) {
      currentY = y;
    }
  }

  if (currentLine) lines.push(currentLine.trim());
  return normalizeExtractedText(lines.join('\n'));
}

function orderPptxSlideEntries(entries, slideEntries) {
  const normalizedEntries = new Map(
    entries.map(entry => [entry.path.replace(/\\/g, '/'), entry])
  );
  const presentationEntry = normalizedEntries.get('ppt/presentation.xml');
  const relationshipsEntry = normalizedEntries.get('ppt/_rels/presentation.xml.rels');
  if (!presentationEntry || !relationshipsEntry) return slideEntries;

  try {
    const presentation = new DOMParser().parseFromString(
      presentationEntry.data.toString('utf8'),
      'application/xml'
    );
    const relationships = new DOMParser().parseFromString(
      relationshipsEntry.data.toString('utf8'),
      'application/xml'
    );
    const targetsById = new Map(
      Array.from(relationships.getElementsByTagName('Relationship')).map(relationship => [
        relationship.getAttribute('Id'),
        relationship.getAttribute('Target'),
      ])
    );
    const slideEntryPaths = new Set(slideEntries.map(item => item.entry.path.replace(/\\/g, '/')));
    const ordered = [];

    for (const slideId of Array.from(presentation.getElementsByTagName('p:sldId'))) {
      const relationshipId = slideId.getAttribute('r:id');
      const target = targetsById.get(relationshipId);
      if (!target) continue;
      const normalizedTarget = target.startsWith('/')
        ? target.slice(1)
        : path.posix.normalize(path.posix.join('ppt', target));
      if (slideEntryPaths.has(normalizedTarget)) {
        const entry = normalizedEntries.get(normalizedTarget);
        ordered.push({ entry, match: normalizedTarget.match(/slide(\d+)\.xml$/i) });
      }
    }

    return ordered.length === slideEntries.length ? ordered : slideEntries;
  } catch {
    return slideEntries;
  }
}

async function parsePptx(filePath) {
  const entries = await decompress(filePath);
  const slidePattern = /^ppt\/slides\/slide(\d+)\.xml$/i;
  let slideEntries = entries
    .map(entry => ({ entry, match: entry.path.replace(/\\/g, '/').match(slidePattern) }))
    .filter(item => item.match)
    .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));

  slideEntries = orderPptxSlideEntries(entries, slideEntries);

  if (slideEntries.length === 0) {
    throw new AppError('PPTX не содержит слайдов или повреждён', 422);
  }
  if (slideEntries.length > MAX_SLIDES) {
    throw new AppError(`Презентация содержит больше ${MAX_SLIDES} слайдов`, 422);
  }

  const totalXmlBytes = slideEntries.reduce((sum, item) => sum + item.entry.data.length, 0);
  if (totalXmlBytes > MAX_PPTX_XML_BYTES) {
    throw new AppError('Распакованные данные PPTX превышают допустимый размер', 422);
  }

  return slideEntries.map(({ entry }) => ({
    text: extractPptxSlideText(entry.data.toString('utf8')),
  }));
}

async function parsePdf(filePath) {
  const buffer = await fs.readFile(filePath);
  const pages = [];

  const result = await pdfParse(buffer, {
    max: MAX_SLIDES,
    pagerender: async page => {
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });
      pages.push({ text: extractPdfPageText(textContent) });
      return '';
    },
  });

  if (!result.numpages) {
    throw new AppError('PDF не содержит страниц или повреждён', 422);
  }
  if (result.numpages > MAX_SLIDES) {
    throw new AppError(`PDF содержит больше ${MAX_SLIDES} страниц`, 422);
  }
  if (pages.length !== result.numpages) {
    throw new AppError('Не удалось обработать все страницы PDF', 422);
  }

  return pages;
}

async function parsePresentation(file) {
  const extension = path.extname(file.originalname || file.path).toLowerCase();

  try {
    if (extension === '.pptx') return await parsePptx(file.path);
    if (extension === '.pdf') return await parsePdf(file.path);
    throw new AppError('Поддерживаются только файлы PPTX и PDF', 415);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const wrapped = new AppError(`Не удалось разобрать файл ${extension || 'неизвестного формата'}`, 422);
    wrapped.cause = error;
    throw wrapped;
  }
}

module.exports = {
  extractPdfPageText,
  extractPptxSlideText,
  normalizeExtractedText,
  orderPptxSlideEntries,
  parsePdf,
  parsePptx,
  parsePresentation,
};
