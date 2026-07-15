const SessionModel = require('../models/session.model');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { withTransaction } = require('../db/transaction');
const VoskClient = require('./vosk-client.service');
const { ASR_ENGINES, getCapabilities } = require('./asr-contract');
const crypto = require('crypto');

async function requireWritableSession(sessionId, userId, expectedEngine, executor = null) {
  const session = executor
    ? await SessionModel.findByIdForUpdate(sessionId, executor)
    : await SessionModel.findById(sessionId);
  if (!session) throw new AppError('Сессия не найдена', 404);
  if (session.user_id !== userId) throw new AppError('Доступ запрещен', 403);
  if (session.status !== 'in_progress') throw new AppError('Сессия уже завершена', 400);
  if (session.speech_engine !== expectedEngine) {
    throw new AppError(
      `Сессия использует движок ${session.speech_engine}; ожидался ${expectedEngine}`,
      409
    );
  }
  return session;
}

async function claimChunk(sessionId, chunkId, file, offsetMs, executor) {
  const input = {
    sessionId,
    chunkId,
    offsetMs,
    mimeType: file.mimetype,
    byteSize: file.size,
    contentSha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
  };
  const created = await SessionModel.createAsrChunk(input, executor);
  if (created) return { chunk: created, duplicate: false };

  const existing = await SessionModel.findAsrChunk(sessionId, chunkId, executor);
  if (!existing) throw new AppError('Не удалось зарегистрировать аудиочанк', 500);
  if (
    existing.offset_ms !== offsetMs ||
    existing.mime_type !== file.mimetype ||
    existing.byte_size !== file.size ||
    existing.content_sha256 !== input.contentSha256
  ) {
    throw new AppError('chunk_id уже использован для другого аудиочанка', 409);
  }
  if (existing.status === 'completed') {
    const segments = await SessionModel.getTranscriptSegmentsByChunk(existing.id, executor);
    return { chunk: existing, duplicate: true, segments };
  }

  const reclaimed = await SessionModel.reclaimAsrChunk(existing.id, input, executor);
  if (reclaimed) return { chunk: reclaimed, duplicate: false };
  throw new AppError('Аудиочанк с таким chunk_id уже обрабатывается', 409);
}

const SpeechRecognitionService = {
  async getCapabilities() {
    // Vosk пока в разработке.
    return getCapabilities(false);
  },

  isVoskConfigured() {
    return VoskClient.isConfigured();
  },

  async isVoskAvailable() {
    return false;
  },

  async listChunks(sessionId, userId) {
    const session = await SessionModel.findById(sessionId);
    if (!session) throw new AppError('Сессия не найдена', 404);
    if (session.user_id !== userId) throw new AppError('Доступ запрещен', 403);
    return SessionModel.listAsrChunks(sessionId);
  },

  async transcribeVoskChunk({ sessionId, userId, file, chunkId, offsetMs }) {
    if (!file?.buffer?.length) throw new AppError('Аудиочанк обязателен', 400);

    const claim = await withTransaction(async client => {
      await requireWritableSession(sessionId, userId, ASR_ENGINES.VOSK, client);
      return claimChunk(sessionId, chunkId, file, offsetMs, client);
    });
    if (claim.duplicate) {
      return { chunk: claim.chunk, segments: claim.segments, duplicate: true };
    }

    try {
      const recognition = await VoskClient.transcribe(file);
      const canonicalSegments = recognition.segments.map((segment, index) => {
        const startMs = offsetMs + segment.start_ms;
        const endMs = offsetMs + segment.end_ms;
        if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) || endMs > 2147483647) {
          throw new AppError('Временная метка Vosk выходит за допустимый диапазон', 502);
        }
        return {
          ...segment,
          start_ms: startMs,
          end_ms: endMs,
          source: ASR_ENGINES.VOSK,
          externalId: `${chunkId}:${index}`,
          asrChunkId: claim.chunk.id,
        };
      });

      const saved = await withTransaction(async client => {
        const lockedSession = await SessionModel.findByIdForUpdate(sessionId, client);
        if (!lockedSession || lockedSession.status !== 'in_progress') {
          throw new AppError('Сессия завершена до окончания распознавания', 409);
        }
        const segments = await SessionModel.addTranscriptSegments(
          sessionId,
          canonicalSegments,
          client
        );
        const completedChunk = await SessionModel.completeAsrChunk(claim.chunk.id, client);
        if (!completedChunk) throw new Error(`ASR chunk ${claim.chunk.id} is not processing`);
        return { segments, chunk: completedChunk };
      });

      logger.info({
        sessionId,
        chunkId,
        segmentCount: saved.segments.length,
      }, 'Vosk audio chunk transcribed');

      return {
        ...saved,
        duplicate: false,
        language: recognition.language,
        duration_ms: recognition.durationMs,
      };
    } catch (error) {
      try {
        await SessionModel.failAsrChunk(claim.chunk.id, error.message);
      } catch (statusError) {
        logger.error({ error: statusError.message, chunkId }, 'Failed to mark ASR chunk as failed');
      }
      throw error;
    }
  },
};

module.exports = SpeechRecognitionService;
