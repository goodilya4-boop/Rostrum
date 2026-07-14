const AppError = require('../utils/AppError');

const ASR_ENGINES = Object.freeze({ WEB: 'web', VOSK: 'vosk' });
const AUDIO_FIELD_NAME = 'audio';
const MAX_AUDIO_CHUNK_BYTES = 10 * 1024 * 1024;
const ACCEPTED_AUDIO_MIME_TYPES = Object.freeze([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/mpeg',
]);

function normalizeConfidence(value) {
  if (value === undefined || value === null || value === '') return null;
  const confidence = Number(value);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new AppError('confidence должен находиться в диапазоне от 0 до 1', 422);
  }
  return confidence;
}

function normalizeWebSegments(segments) {
  return segments.map(segment => {
    const startMs = Number(segment.start_ms);
    const endMs = Number(segment.end_ms);
    const spokenText = String(segment.spoken_text || '').trim();
    const segmentId = String(segment.segment_id || '').trim();
    if (!Number.isInteger(startMs) || startMs < 0 || !Number.isInteger(endMs) || endMs < startMs) {
      throw new AppError('Некорректные временные границы сегмента', 422);
    }
    if (!spokenText) throw new AppError('Текст сегмента не может быть пустым', 422);
    if (!segmentId) throw new AppError('segment_id обязателен', 422);

    return {
      start_ms: startMs,
      end_ms: endMs,
      spoken_text: spokenText,
      confidence: normalizeConfidence(segment.confidence),
      source: ASR_ENGINES.WEB,
      externalId: segmentId,
      asrChunkId: null,
    };
  });
}

function normalizeVoskResponse(payload) {
  if (!payload || !Array.isArray(payload.segments)) {
    throw new AppError('Vosk вернул ответ неверного формата', 502);
  }

  return payload.segments.map(segment => {
    const startMs = Number(segment.start_ms);
    const endMs = Number(segment.end_ms);
    const text = String(segment.text ?? segment.spoken_text ?? '').trim();
    if (!Number.isInteger(startMs) || startMs < 0 || !Number.isInteger(endMs) || endMs < startMs) {
      throw new AppError('Vosk вернул некорректные временные границы', 502);
    }
    if (!text) throw new AppError('Vosk вернул пустой сегмент', 502);

    return {
      start_ms: startMs,
      end_ms: endMs,
      spoken_text: text,
      confidence: normalizeConfidence(segment.confidence),
    };
  });
}

function getCapabilities(voskServiceReachable) {
  return {
    contract_version: '1.0.0',
    engines: {
      web: {
        available: true,
        input: 'final_transcript_segments',
        endpoint: '/sessions/:id/transcripts',
      },
      vosk: {
        // The transport contract is retained for future work, but the engine is
        // deliberately unavailable until deployment and E2E testing are complete.
        available: false,
        status: 'development',
        service_reachable: Boolean(voskServiceReachable),
        input: 'audio_chunks',
        endpoint: '/sessions/:id/asr/vosk',
        audio_field: AUDIO_FIELD_NAME,
        required_fields: ['chunk_id', 'offset_ms', AUDIO_FIELD_NAME],
        accepted_mime_types: ACCEPTED_AUDIO_MIME_TYPES,
        max_chunk_bytes: MAX_AUDIO_CHUNK_BYTES,
      },
    },
  };
}

function toPublicTranscriptSegment(segment) {
  return {
    id: segment.id,
    segment_id: segment.external_id || segment.externalId || null,
    start_ms: segment.start_ms,
    end_ms: segment.end_ms,
    spoken_text: segment.spoken_text,
    confidence: segment.confidence ?? null,
    source: segment.source,
  };
}

module.exports = {
  ACCEPTED_AUDIO_MIME_TYPES,
  ASR_ENGINES,
  AUDIO_FIELD_NAME,
  MAX_AUDIO_CHUNK_BYTES,
  getCapabilities,
  normalizeConfidence,
  normalizeVoskResponse,
  normalizeWebSegments,
  toPublicTranscriptSegment,
};
