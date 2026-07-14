// src/services/transcript.service.js

const SessionModel = require('../models/session.model');
const logger = require('../utils/logger');

const TranscriptService = {
  async processTranscripts(sessionId) {
    try {
      // Получаем все транскрипты сессии
      const segments = await SessionModel.getTranscriptSegments(sessionId);

      if (!segments || segments.length === 0) {
        logger.warn(`No transcripts found for session ${sessionId}`);
        return new Map();
      }

      // Получаем переключения слайдов
      const slideChanges = await SessionModel.getSlideChanges(sessionId);

      // Привязываем каждый сегмент к слайду
      const slideTexts = new Map();

      for (const segment of segments) {
        const midpointMs = Math.floor((segment.start_ms + segment.end_ms) / 2);
        let slideIndex = 1;

        // Определяем активный слайд
        if (slideChanges && slideChanges.length > 0) {
          for (const change of slideChanges) {
            if (change.timestamp_offset_ms <= midpointMs) {
              slideIndex = change.slide_index;
            } else {
              break;
            }
          }
        }

        if (!slideTexts.has(slideIndex)) {
          slideTexts.set(slideIndex, []);
        }
        slideTexts.get(slideIndex).push(segment.spoken_text);
      }

      // Объединяем текст для каждого слайда
      const result = new Map();
      for (const [slideIndex, texts] of slideTexts) {
        result.set(slideIndex, texts.join(' '));
      }

      return result;
    } catch (error) {
      logger.error(`Error processing transcripts for session ${sessionId}:`, error);
      return new Map();
    }
  },

  getTotalWords(segments) {
    if (!segments || segments.length === 0) return 0;

    let totalWords = 0;
    for (const segment of segments) {
      if (segment.spoken_text) {
        totalWords += segment.spoken_text.split(/\s+/).filter(w => w.length > 0).length;
      }
    }
    return totalWords;
  },
};

module.exports = TranscriptService;