const { STOP_WORDS } = require('../utils/stopwords');
const logger = require('../utils/logger');

class KeyPhraseService {
  // Выбираем из текста несколько самых важных предложений.
  static extractKeyPhrases(text, maxPhrases = 5) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    try {
      const sentences = this.splitIntoSentences(text);

      // Очень короткие предложения обычно мало что объясняют.
      const validSentences = sentences.filter(s => s.trim().length >= 20);

      if (validSentences.length === 0) {
        return sentences.length > 0 ? [sentences[0]] : [];
      }

      if (validSentences.length <= maxPhrases) {
        return validSentences;
      }

      const preprocessed = validSentences.map(sentence => ({
        original: sentence,
        tokens: this.tokenize(sentence),
      }));

      const tfidfScores = this.calculateTFIDF(preprocessed);

      const sentenceWeights = preprocessed.map((item, index) => ({
        original: item.original,
        weight: this.calculateSentenceWeight(item.tokens, tfidfScores),
        index,
      }));

      sentenceWeights.sort((a, b) => b.weight - a.weight);

      const topPhrases = sentenceWeights
        .slice(0, maxPhrases)
        .sort((a, b) => a.index - b.index) // Оставляем исходный порядок.
        .map(item => item.original);

      logger.info(`Extracted ${topPhrases.length} key phrases from text (${validSentences.length} sentences)`);

      return topPhrases;
    } catch (error) {
      logger.error('Error extracting key phrases:', error);
      return [];
    }
  }

  static splitIntoSentences(text) {
    return text
      .split(/[.!?;]\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  static tokenize(sentence) {
    return sentence
      .toLowerCase()
      .replace(/[^а-яёa-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word));
  }

  // Считаем, какие слова лучше всего описывают текст.
  static calculateTFIDF(preprocessedSentences) {
    const totalDocs = preprocessedSentences.length;
    const wordDocCount = new Map();
    const tfidfScores = new Map();

    for (const sentence of preprocessedSentences) {
      const uniqueWords = new Set(sentence.tokens);
      for (const word of uniqueWords) {
        wordDocCount.set(word, (wordDocCount.get(word) || 0) + 1);
      }
    }

    for (const sentence of preprocessedSentences) {
      const wordCount = sentence.tokens.length;
      const wordFreq = new Map();

      for (const word of sentence.tokens) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }

      for (const [word, freq] of wordFreq) {
        const tf = freq / wordCount;
        const docCount = wordDocCount.get(word) || 1;
        const idf = Math.log(totalDocs / docCount);
        const tfidf = tf * idf;

        if (!tfidfScores.has(word) || tfidfScores.get(word) < tfidf) {
          tfidfScores.set(word, tfidf);
        }
      }
    }

    return tfidfScores;
  }

  // Чем больше важных слов, тем полезнее предложение.
  static calculateSentenceWeight(tokens, tfidfScores) {
    if (tokens.length === 0) return 0;

    let totalWeight = 0;
    for (const word of tokens) {
      totalWeight += tfidfScores.get(word) || 0;
    }

    return totalWeight / tokens.length;
  }
}

module.exports = KeyPhraseService;
