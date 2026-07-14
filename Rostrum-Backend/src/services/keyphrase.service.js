const { STOP_WORDS } = require('../utils/stopwords');
const logger = require('../utils/logger');

class KeyPhraseService {
  /**
   * Извлекает ключевые фразы из текста слайда
   * @param {string} text - текст слайда
   * @param {number} maxPhrases - максимальное количество ключевых фраз (по умолчанию 5)
   * @returns {string[]} - массив ключевых фраз
   */
  static extractKeyPhrases(text, maxPhrases = 5) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    try {
      // Шаг 1: Разбиение на предложения
      const sentences = this.splitIntoSentences(text);

      // Отбрасываем короткие предложения
      const validSentences = sentences.filter(s => s.trim().length >= 20);

      if (validSentences.length === 0) {
        return sentences.length > 0 ? [sentences[0]] : [];
      }

      // Если предложений меньше или равно maxPhrases, возвращаем все
      if (validSentences.length <= maxPhrases) {
        return validSentences;
      }

      // Шаг 2: Предобработка предложений
      const preprocessed = validSentences.map(sentence => ({
        original: sentence,
        tokens: this.tokenize(sentence),
      }));

      // Шаг 3: Вычисление TF-IDF для каждого слова
      const tfidfScores = this.calculateTFIDF(preprocessed);

      // Шаг 4: Вычисление веса каждого предложения
      const sentenceWeights = preprocessed.map((item, index) => ({
        original: item.original,
        weight: this.calculateSentenceWeight(item.tokens, tfidfScores),
        index,
      }));

      // Шаг 5: Сортировка по весу и выбор топ-N
      sentenceWeights.sort((a, b) => b.weight - a.weight);

      const topPhrases = sentenceWeights
        .slice(0, maxPhrases)
        .sort((a, b) => a.index - b.index) // Сохраняем порядок появления в тексте
        .map(item => item.original);

      logger.info(`Extracted ${topPhrases.length} key phrases from text (${validSentences.length} sentences)`);

      return topPhrases;
    } catch (error) {
      logger.error('Error extracting key phrases:', error);
      return [];
    }
  }

  /**
   * Разбивает текст на предложения
   */
  static splitIntoSentences(text) {
    return text
      .split(/[.!?;]\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Токенизация и очистка предложения
   */
  static tokenize(sentence) {
    return sentence
      .toLowerCase()
      .replace(/[^а-яёa-z0-9\s]/g, '') // Удаляем знаки препинания
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word)); // Удаляем стоп-слова и короткие слова
  }

  /**
   * Вычисление TF-IDF для всех слов во всех предложениях
   */
  static calculateTFIDF(preprocessedSentences) {
    const totalDocs = preprocessedSentences.length;
    const wordDocCount = new Map(); // Сколько документов содержат слово
    const tfidfScores = new Map();

    // Первый проход: подсчет IDF
    for (const sentence of preprocessedSentences) {
      const uniqueWords = new Set(sentence.tokens);
      for (const word of uniqueWords) {
        wordDocCount.set(word, (wordDocCount.get(word) || 0) + 1);
      }
    }

    // Второй проход: вычисление TF-IDF для каждого слова
    for (const sentence of preprocessedSentences) {
      const wordCount = sentence.tokens.length;
      const wordFreq = new Map();

      // Подсчет частоты слов в предложении
      for (const word of sentence.tokens) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }

      // Вычисление TF-IDF
      for (const [word, freq] of wordFreq) {
        const tf = freq / wordCount;
        const docCount = wordDocCount.get(word) || 1;
        const idf = Math.log(totalDocs / docCount);
        const tfidf = tf * idf;

        // Сохраняем максимальный TF-IDF для каждого слова
        if (!tfidfScores.has(word) || tfidfScores.get(word) < tfidf) {
          tfidfScores.set(word, tfidf);
        }
      }
    }

    return tfidfScores;
  }

  /*
   * Вычисление веса предложения на основе TF-IDF его слов
   */
  static calculateSentenceWeight(tokens, tfidfScores) {
    if (tokens.length === 0) return 0;

    let totalWeight = 0;
    for (const word of tokens) {
      totalWeight += tfidfScores.get(word) || 0;
    }

    return totalWeight / tokens.length; // Нормализация по длине предложения
  }
}

module.exports = KeyPhraseService;