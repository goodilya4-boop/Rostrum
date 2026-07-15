const SessionModel = require('../models/session.model');
const PresentationModel = require('../models/presentation.model');
const { compareTextWithPhrases, isMorphReady, tokenize } = require('../utils/textComparison');
const { countFillerWords } = require('./fillerWords');
const logger = require('../utils/logger');
const { withTransaction } = require('../db/transaction');
const AppError = require('../utils/AppError');
const {
  calculateCoverage,
  calculateRadarData,
  calculateSpeechMetrics,
  getAnalysisVersion,
  mapTranscriptsToSlides,
} = require('./analysis-metrics');

class AnalysisService {
  async analyzeSession(sessionId) {
    const analysisStart = Date.now();
    const analysisVersion = getAnalysisVersion(isMorphReady());
    logger.info({ sessionId }, 'Starting session analysis');

    try {
      const session = await SessionModel.findById(sessionId);
      if (!session) throw new AppError('Сессия не найдена', 404);

      const slides = await PresentationModel.getSlides(session.presentation_id);
      if (!slides?.length) {
        logger.warn({ sessionId }, 'No slides found');
        return this.createEmptyAnalysis(sessionId, session, 'Презентация не содержит слайдов для анализа.');
      }

      const transcripts = await SessionModel.getTranscriptSegments(sessionId);
      const slideChanges = await SessionModel.getSlideChanges(sessionId);

      // Без распознанной речи анализировать нечего.
      if (!transcripts?.length) {
        logger.warn({ sessionId }, 'No transcripts found');
        return this.createEmptyAnalysis(
          sessionId, session,
          'Речь не была распознана. Проверьте настройки микрофона и повторите попытку.'
        );
      }

      // Распределяем речь по слайдам.
      const slideTexts = mapTranscriptsToSlides(transcripts, slideChanges, slides.length);
      const allSpokenText = transcripts.map(t => t.spoken_text).join(' ');

      // Проверяем каждый слайд.
      const slideFeedbacks = [];

      for (const slide of slides) {
        const spokenText = slideTexts.get(slide.slide_index) || '';
        const keyPhrases = Array.isArray(slide.key_phrases) ? slide.key_phrases : [];
        const comparison = compareTextWithPhrases(spokenText, keyPhrases);

        slideFeedbacks.push({
          slide_index: slide.slide_index,
          ...comparison,
        });
      }

      // Считаем общие показатели.
      const coverage = calculateCoverage(slideFeedbacks);
      const fillerWordCount = countFillerWords(allSpokenText);
      const speech = calculateSpeechMetrics(
        allSpokenText,
        session.duration_sec,
        session.time_limit_sec,
        fillerWordCount
      );

      // Готовим данные для диаграммы.
      const significantWords = this.getSignificantWords(allSpokenText);
      const radarData = calculateRadarData({
        coverage,
        timingAdherence: speech.timingAdherence,
        fillerWordCount,
        totalWords: speech.totalWords,
        significantWords,
      });

      // Собираем советы для пользователя.
      const suggestions = this.generateSuggestions({
        slideFeedbacks,
        coverage,
        timingAdherence: speech.timingAdherence,
        speechRateWpm: speech.speechRateWpm,
        fillerWordCount,
        fillerRatePer100: speech.fillerRatePer100,
        durationSec: speech.durationSec,
        timeLimitSec: session.time_limit_sec,
      });

      const summary = {
        timingAdherence: speech.timingAdherence,
        overallCoverage: coverage.overallCoverage,
        fillerWordCount,
        speechRateWpm: speech.speechRateWpm,
        suggestions,
        radarData,
        analysisVersion,
        analysisStatus: 'completed',
      };

      // Сохраняем весь отчёт одной транзакцией.
      await withTransaction(async client => {
        await SessionModel.deleteSlideFeedback(sessionId, client);
        for (const feedback of slideFeedbacks) {
          await SessionModel.saveSlideFeedback(
            sessionId,
            feedback.slide_index,
            feedback,
            client
          );
        }
        const savedSummary = await SessionModel.saveSummary(sessionId, summary, client);
        if (!savedSummary) {
          throw new Error(`Summary row for session ${sessionId} was not initialized`);
        }
      });

      const durationMs = Date.now() - analysisStart;
      logger.info({
        sessionId, analysisVersion,
        overallCoverage: coverage.overallCoverage.toFixed(2),
        timingAdherence: speech.timingAdherence.toFixed(2), durationMs,
      }, 'Session analysis completed');

      return {
        sessionId,
        analysisVersion,
        analysisStatus: 'completed',
        timingAdherence: speech.timingAdherence,
        overallCoverage: coverage.overallCoverage,
        fillerWordCount,
        speechRateWpm: speech.speechRateWpm,
        fillerRatePer100: speech.fillerRatePer100,
        suggestions,
        radarData,
        slideFeedbacks,
      };
    } catch (error) {
      logger.error({ sessionId, error: error.message }, 'Session analysis failed');
      throw error;
    }
  }

  mapTranscriptsToSlides(transcripts, slideChanges, totalSlides) {
    return mapTranscriptsToSlides(transcripts, slideChanges, totalSlides);
  }

  getSignificantWords(text) {
    return tokenize(text);
  }

  generateSuggestions({
    slideFeedbacks, coverage, timingAdherence, speechRateWpm,
    fillerWordCount, fillerRatePer100, durationSec, timeLimitSec,
  }) {
    const suggestions = [];

    if (!coverage.hasScorableSlides) {
      suggestions.push('Добавьте ключевые тезисы к слайдам, чтобы оценить содержательное покрытие.');
    }

    for (const fb of slideFeedbacks) {
      if (fb.isScorable && fb.coverageScore < 0.5 && fb.missedPhrases.length > 0) {
        const missed = fb.missedPhrases.slice(0, 2).join('», «');
        suggestions.push(`Уделите больше внимания слайду ${fb.slide_index}: упущены ключевые тезисы («${missed}»).`);
      }
    }

    if (timingAdherence < 1.0 && durationSec > timeLimitSec) {
      const overtime = durationSec - timeLimitSec;
      const min = Math.floor(overtime / 60);
      const sec = overtime % 60;
      const timeStr = min > 0 ? `${min} мин ${sec} сек` : `${sec} сек`;
      suggestions.push(`Вы превысили регламент на ${timeStr}. Попробуйте сократить вступление и заключение.`);
    }

    if (speechRateWpm > 180) {
      suggestions.push(`Темп речи (${speechRateWpm} слов/мин) выше среднего. Попробуйте говорить размереннее, особенно на ключевых слайдах.`);
    }

    if (speechRateWpm < 80 && durationSec > 60) {
      suggestions.push(`Темп речи (${speechRateWpm} слов/мин) ниже среднего. Возможно, стоит говорить увереннее.`);
    }

    if (fillerWordCount >= 3 && fillerRatePer100 >= 2) {
      suggestions.push(`Обнаружено много слов-паразитов (${fillerWordCount}, ${fillerRatePer100} на 100 слов). Попробуйте заменить их паузами — это звучит увереннее.`);
    }

    if (!suggestions.length && coverage.hasScorableSlides) {
      suggestions.push('Отличная работа! Все ключевые тезисы освещены, регламент соблюдён.');
    }

    return suggestions;
  }

  async createEmptyAnalysis(sessionId, session, message) {
    const analysisVersion = getAnalysisVersion(isMorphReady());
    const timingAdherence = calculateSpeechMetrics(
      '', session.duration_sec, session.time_limit_sec, 0
    ).timingAdherence;
    const radarData = { coverage: 0, timing: timingAdherence, fluency: 0, vocabulary: 0, structure: 0 };
    const summary = {
      timingAdherence,
      overallCoverage: 0,
      fillerWordCount: 0,
      speechRateWpm: 0,
      suggestions: [message || 'Нет данных для анализа.'],
      radarData,
      analysisVersion,
      analysisStatus: 'insufficient_data',
    };
    await withTransaction(async client => {
      await SessionModel.deleteSlideFeedback(sessionId, client);
      const savedSummary = await SessionModel.saveSummary(sessionId, summary, client);
      if (!savedSummary) {
        throw new Error(`Summary row for session ${sessionId} was not initialized`);
      }
    });
    return {
      sessionId,
      analysisVersion,
      analysisStatus: 'insufficient_data',
      timingAdherence,
      overallCoverage: 0,
      fillerWordCount: 0,
      speechRateWpm: 0,
      suggestions: [message || 'Нет данных для анализа.'],
      radarData,
      slideFeedbacks: [],
    };
  }
}

module.exports = new AnalysisService();
