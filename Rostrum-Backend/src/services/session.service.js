const SessionModel = require('../models/session.model');
const PresentationModel = require('../models/presentation.model');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { ASR_ENGINES, normalizeWebSegments } = require('./asr-contract');
const { withTransaction } = require('../db/transaction');

const SessionService = {
  async createSession({ userId, presentationId, timeLimitSec, speechEngine }) {
    const selectedEngine = speechEngine || ASR_ENGINES.WEB;
    // Vosk пока в разработке, поэтому для новой сессии его выбрать нельзя.
    if (selectedEngine === ASR_ENGINES.VOSK) {
      throw new AppError('Vosk находится в разработке. Используйте Web Speech', 501);
    }

    const presentation = await PresentationModel.findById(presentationId);
    if (!presentation) {
      throw new AppError('Презентация не найдена', 404);
    }

    if (presentation.user_id !== userId) {
      throw new AppError('Доступ запрещен', 403);
    }

    const session = await SessionModel.create({
      userId,
      presentationId,
      timeLimitSec: timeLimitSec || 420,
      speechEngine: selectedEngine,
    });

    logger.info(`Session created: ${session.id} for user ${userId}`);
    return session;
  },

  async addSlideChanges(sessionId, userId, changes) {
    const session = await SessionModel.findById(sessionId);
    if (!session) {
      throw new AppError('Сессия не найдена', 404);
    }

    if (session.user_id !== userId) {
      throw new AppError('Доступ запрещен', 403);
    }

    if (session.status !== 'in_progress') {
      throw new AppError('Сессия уже завершена', 400);
    }

    const result = await SessionModel.addSlideChanges(sessionId, changes);
    logger.info(`Added ${result.length} slide changes to session ${sessionId}`);
    return result;
  },

  async addTranscripts(sessionId, userId, segments) {
    const normalizedSegments = normalizeWebSegments(segments);
    const savedSegments = await withTransaction(async client => {
      const session = await SessionModel.findByIdForUpdate(sessionId, client);
      if (!session) throw new AppError('Сессия не найдена', 404);
      if (session.user_id !== userId) throw new AppError('Доступ запрещен', 403);
      if (session.status !== 'in_progress') throw new AppError('Сессия уже завершена', 400);
      if (session.speech_engine !== ASR_ENGINES.WEB) {
        throw new AppError(
          `JSON-транскрипты разрешены только для движка ${ASR_ENGINES.WEB}`,
          409
        );
      }
      await SessionModel.addTranscriptSegments(sessionId, normalizedSegments, client);
      return SessionModel.getTranscriptSegmentsByExternalIds(
        sessionId,
        ASR_ENGINES.WEB,
        normalizedSegments.map(segment => segment.externalId),
        client
      );
    });
    logger.info(`Transcripts added to session ${sessionId}: ${savedSegments.length} segments`);
    return savedSegments;
  },

  async completeSession(sessionId, userId) {
    const completedSession = await withTransaction(async client => {
      const session = await SessionModel.findByIdForUpdate(sessionId, client);
      if (!session) throw new AppError('Сессия не найдена', 404);
      if (session.user_id !== userId) throw new AppError('Доступ запрещен', 403);
      if (session.status !== 'in_progress') throw new AppError('Сессия уже завершена', 400);

      if (session.speech_engine === ASR_ENGINES.VOSK) {
        const unresolvedChunks = await SessionModel.countUnresolvedAsrChunks(sessionId, client);
        if (unresolvedChunks > 0) {
          throw new AppError('Повторите или дождитесь обработки аудиочанков Vosk', 409);
        }
      }

      const completed = await SessionModel.complete(sessionId, client);
      if (!completed) throw new AppError('Не удалось завершить сессию', 500);
      return completed;
    });

    logger.info(`Session ${sessionId} completed. Duration: ${completedSession.duration_sec}s`);

    return completedSession;
  },

  async getHistory(userId) {
    return await SessionModel.getHistory(userId);
  },

  async getReport(sessionId) {
    return await SessionModel.getReport(sessionId);
  },

  async getUserSessions(userId, limit, offset) {
  const sessions = await SessionModel.getUserTrainingHistoryPaginated(userId, limit, offset);
  const total = await SessionModel.getUserTrainingHistoryCount(userId);
  return { sessions, total };
},

  async getSessionDetails(sessionId, userId) {
    const session = await SessionModel.findById(sessionId);
    if (!session) {
      throw new AppError('Сессия не найдена', 404);
    }

    if (session.user_id !== userId) {
      throw new AppError('Доступ запрещен', 403);
    }

    const result = {
      session,
      // После обновления страницы возвращаемся к последнему слайду.
      slide_changes: await SessionModel.getSlideChanges(sessionId),
    };

    if (session.status === 'completed') {
      result.report = await this.getReport(sessionId);
      result.summary = await SessionModel.getSummary(sessionId);
      result.feedback = await SessionModel.getSlideFeedback(sessionId);
    }

    return result;
  },
};

module.exports = SessionService;
