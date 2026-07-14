const { STOP_WORDS } = require('./stopwords');
const logger = require('./logger');

// Кэш для морфологического анализатора
let Az = null;
let morphInitialized = false;
const PHRASE_MATCH_THRESHOLD = 0.6;

/*
 * Инициализация морфологического анализатора
 */
function initMorph(callback) {
  try {
    Az = require('az');
    Az.Morph.init(() => {
      morphInitialized = true;
      logger.info('Morphological analyzer (az) initialized successfully');
      if (callback) callback();
    });
  } catch (error) {
    logger.warn('Az module not available, using simple stemming instead');
    morphInitialized = false;
    if (callback) callback();
  }
}

/*
 * Проверка готовности морфологического анализатора
 */
function isMorphReady() {
  return morphInitialized;
}

/*
 * Лемматизация слова или фразы
 */
function lemmatize(text) {
  if (!text) return [];

  if (morphInitialized && Az) {
    try {
      return Az.Morph.lemmatize(text.toLowerCase());
    } catch (error) {
      logger.warn('Lemmatization error, falling back to stemming');
    }
  }

  // Fallback: простое удаление окончаний
  return simpleStem(text);
}

/*
 * Простое удаление окончаний (стемминг)
 */
function simpleStem(text) {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  return words.map(word => {
    if (word.length < 3) return word;

    const endings = [
      'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими',
      'ая', 'яя', 'ое', 'ее', 'ую', 'юю', 'ой', 'ей', 'ых', 'их',
      'ым', 'им', 'ом', 'ем', 'а', 'я', 'о', 'е', 'у', 'ю', 'ы', 'и',
      'ть', 'ти', 'чь', 'ся', 'сь',
    ];

    for (const ending of endings.sort((a, b) => b.length - a.length)) {
      if (word.endsWith(ending) && word.length - ending.length >= 3) {
        return word.slice(0, -ending.length);
      }
    }
    return word;
  });
}

/*
 * Токенизация текста (удаление стоп-слов и знаков препинания)
 */
function tokenize(text) {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/*
 * Нормализация текста (лемматизация + удаление стоп-слов)
 */
function normalizeText(text) {
  if (!text) return [];

  const tokens = tokenize(text);
  return lemmatize(tokens.join(' '));
}

/*
 * Сравнивает произнесённый текст с ключевыми фразами слайда
 * @param {string} spokenText - объединённый текст всех транскриптов слайда
 * @param {string[]} keyPhrases - массив ключевых фраз слайда
 * @returns {Object} { coverageScore, matchedPhrases, missedPhrases, spokenKeywords }
 */
function compareTextWithPhrases(spokenText, keyPhrases) {
  const validPhrases = Array.isArray(keyPhrases)
    ? keyPhrases.filter(phrase => typeof phrase === 'string' && phrase.trim().length > 0)
    : [];

  if (validPhrases.length === 0) {
    return {
      coverageScore: null,
      isScorable: false,
      matchedPhrases: [],
      missedPhrases: [],
      spokenKeywords: spokenText ? [...new Set(tokenize(spokenText))] : [],
    };
  }

  if (!spokenText || spokenText.trim().length === 0) {
    return {
      coverageScore: 0.0,
      isScorable: true,
      matchedPhrases: [],
      missedPhrases: [...validPhrases],
      spokenKeywords: [],
    };
  }

  const spokenWordsSet = new Set(normalizeText(spokenText));
  const spokenKeywords = [...new Set(tokenize(spokenText))];
  const matchedPhrases = [];
  const missedPhrases = [];

  for (const phrase of validPhrases) {
    const phraseWords = [...new Set(normalizeText(phrase))];
    if (phraseWords.length === 0) {
      missedPhrases.push(phrase);
      continue;
    }

    const matchedWordCount = phraseWords.filter(word => spokenWordsSet.has(word)).length;
    const matchRatio = matchedWordCount / phraseWords.length;
    if (matchRatio >= PHRASE_MATCH_THRESHOLD) matchedPhrases.push(phrase);
    else missedPhrases.push(phrase);
  }

  const coverageScore = matchedPhrases.length / validPhrases.length;
  logger.debug(`Text comparison: ${matchedPhrases.length}/${validPhrases.length} phrases matched (${(coverageScore * 100).toFixed(1)}%)`);

  return {
    coverageScore,
    isScorable: true,
    matchedPhrases,
    missedPhrases,
    spokenKeywords,
  };
}

module.exports = {
  initMorph,
  isMorphReady,
  lemmatize,
  tokenize,
  normalizeText,
  compareTextWithPhrases,
  PHRASE_MATCH_THRESHOLD,
  simpleStem,
};
