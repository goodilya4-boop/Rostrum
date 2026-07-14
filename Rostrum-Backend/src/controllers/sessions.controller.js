const SessionService = require('../services/session.service');
const SessionModel = require('../models/session.model');
const analysisService = require('../services/analysis.service');
const logger = require('../utils/logger');
const SpeechRecognitionService = require('../services/speech-recognition.service');
const { toPublicTranscriptSegment } = require('../services/asr-contract');

const SessionsController = {
  async getAsrCapabilities(req, res, next) {
    try {
      res.json(await SpeechRecognitionService.getCapabilities());
    } catch (error) {
      next(error);
    }
  },

  async listAsrChunks(req, res, next) {
    try {
      const chunks = await SpeechRecognitionService.listChunks(
        parseInt(req.params.id),
        req.user.user_id
      );
      res.json({ chunks });
    } catch (error) {
      next(error);
    }
  },

  async reanalyze(req, res, next) {
  try {
    const sessionId = parseInt(req.params.id);
    const session = await SessionModel.findById(sessionId);

    if (!session) {
      return res.status(404).json({ error: { message: 'Сессия не найдена', status: 404 } });
    }
    if (session.user_id !== req.user.user_id) {
      return res.status(403).json({ error: { message: 'Доступ запрещен', status: 403 } });
    }
    if (session.status !== 'completed') {
      return res.status(400).json({ error: { message: 'Повторный анализ возможен только для завершённых сессий', status: 400 } });
    }

    await analysisService.analyzeSession(sessionId);

    const report = await SessionService.getReport(sessionId);
    const summary = await SessionModel.getSummary(sessionId);
    const feedback = await SessionModel.getSlideFeedback(sessionId);

    res.json({
      message: 'Анализ перезапущен',
      session,
      summary: summary || {},
      feedback: feedback || [],
      report: report || [],
    });
  } catch (error) {
    next(error);
  }
},

// Обновленный list с пагинацией:
async list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const { sessions, total } = await SessionService.getUserSessions(req.user.user_id, limit, offset);

    res.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
},


  async create(req, res, next) {
    try {
      const { presentation_id, time_limit_sec, speech_engine } = req.body;

      const session = await SessionService.createSession({
        userId: req.user.user_id,
        presentationId: presentation_id,
        timeLimitSec: time_limit_sec,
        speechEngine: speech_engine,
      });

      res.status(201).json({ session });
    } catch (error) {
      next(error);
    }
  },

  async getById(req, res, next) {
    try {
      const sessionId = parseInt(req.params.id);
      const details = await SessionService.getSessionDetails(sessionId, req.user.user_id);

      res.json(details);
    } catch (error) {
      next(error);
    }
  },

  async addSlideChanges(req, res, next) {
    try {
      const sessionId = parseInt(req.params.id);
      const { changes } = req.body;

      if (!changes || !Array.isArray(changes) || changes.length === 0) {
        return res.status(400).json({
          error: { message: 'Массив переключений слайдов обязателен', status: 400 }
        });
      }

      const result = await SessionService.addSlideChanges(sessionId, req.user.user_id, changes);
      res.json({ changes: result });
    } catch (error) {
      next(error);
    }
  },

  async addTranscripts(req, res, next) {
    try {
      const sessionId = parseInt(req.params.id);
      const { segments } = req.body;

      if (!segments || !Array.isArray(segments) || segments.length === 0) {
        return res.status(400).json({
          error: { message: 'Массив сегментов транскрипта обязателен', status: 400 }
        });
      }

      const savedSegments = await SessionService.addTranscripts(
        sessionId,
        req.user.user_id,
        segments
      );
      res.json({
        message: 'Транскрипты сохранены',
        segments_count: savedSegments.length,
        segments: savedSegments.map(toPublicTranscriptSegment),
      });
    } catch (error) {
      next(error);
    }
  },

  async transcribeVoskChunk(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: { message: 'Аудиочанк обязателен', status: 400 }
        });
      }

      const result = await SpeechRecognitionService.transcribeVoskChunk({
        sessionId: parseInt(req.params.id),
        userId: req.user.user_id,
        file: req.file,
        chunkId: req.body.chunk_id,
        offsetMs: parseInt(req.body.offset_ms),
      });

      res.status(result.duplicate ? 200 : 201).json({
        chunk: {
          chunk_id: result.chunk.chunk_id,
          status: result.chunk.status,
          offset_ms: result.chunk.offset_ms,
        },
        duplicate: result.duplicate,
        segments: result.segments.map(toPublicTranscriptSegment),
        language: result.language,
        duration_ms: result.duration_ms,
      });
    } catch (error) {
      next(error);
    }
  },

  async complete(req, res, next) {
    try {
      const sessionId = parseInt(req.params.id);

      logger.info(`Completing session ${sessionId}`);

      // Проверяем существование сессии
      const existingSession = await SessionModel.findById(sessionId);
      if (!existingSession) {
        return res.status(404).json({
          error: { message: 'Сессия не найдена', status: 404 }
        });
      }

      // Проверяем права доступа
      if (existingSession.user_id !== req.user.user_id) {
        return res.status(403).json({
          error: { message: 'Доступ запрещен', status: 403 }
        });
      }

      // Завершаем сессию
      const session = await SessionService.completeSession(sessionId, req.user.user_id);

      // Запускаем анализ (не блокируем ответ, если анализ упадет)
      let analysisResult = null;
      try {
        analysisResult = await analysisService.analyzeSession(sessionId);
        logger.info({ sessionId }, 'Session analysis completed successfully');
      } catch (analysisError) {
        logger.error({ sessionId, error: analysisError.message }, 'Session analysis failed');
        // Сессия уже завершена, анализ можно будет перезапустить
      }

      // Получаем результаты анализа
      const summary = await SessionModel.getSummary(sessionId);
      const feedback = await SessionModel.getSlideFeedback(sessionId);

      res.json({
        message: analysisResult
          ? 'Сессия завершена и проанализирована'
          : 'Сессия завершена, но анализ не выполнен',
        session,
        summary: summary || {},
        feedback: feedback || [],
        analysis: analysisResult,
        analysis_status: summary?.analysis_status || 'pending',
      });
    } catch (error) {
      logger.error(`Error completing session: ${error.message}`);
      next(error);
    }
  },
};

module.exports = SessionsController;
