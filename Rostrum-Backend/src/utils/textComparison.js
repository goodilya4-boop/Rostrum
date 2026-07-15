const { STOP_WORDS } = require('./stopwords');
const logger = require('./logger');

// Здесь хранится готовый анализатор слов.
let Az = null;
let morphInitialized = false;
const PHRASE_MATCH_THRESHOLD = 0.6;

// Подготавливаем анализатор русских слов.
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

function isMorphReady() {
  return morphInitialized;
}

// Приводим слова к начальной форме.
function lemmatize(text) {
  if (!text) return [];

  if (morphInitialized && Az) {
    try {
      return Az.Morph.lemmatize(text.toLowerCase());
    } catch (error) {
      logger.warn('Lemmatization error, falling back to stemming');
    }
  }

  // Если анализатор не запустился, просто убираем окончания.
  return simpleStem(text);
}

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

// Оставляем только слова, которые пригодятся для сравнения.
function tokenize(text) {
  if (!text) return [];

  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

function normalizeText(text) {
  if (!text) return [];

  const tokens = tokenize(text);
  return lemmatize(tokens.join(' '));
}

// Проверяем, какие важные фразы со слайда были произнесены.
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
