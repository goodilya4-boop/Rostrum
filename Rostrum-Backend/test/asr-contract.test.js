const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const {
  getCapabilities,
  normalizeVoskResponse,
  normalizeWebSegments,
  toPublicTranscriptSegment,
} = require('../src/services/asr-contract');

test('Web Speech сегменты приводятся к каноническому формату', () => {
  const [segment] = normalizeWebSegments([{
    segment_id: 'segment-1',
    start_ms: 10,
    end_ms: 500,
    spoken_text: '  Проверка контракта  ',
    confidence: 0.8,
  }]);

  assert.deepEqual(segment, {
    start_ms: 10,
    end_ms: 500,
    spoken_text: 'Проверка контракта',
    confidence: 0.8,
    source: 'web',
    externalId: 'segment-1',
    asrChunkId: null,
  });
});

test('контракт отклоняет инвертированные временные границы', () => {
  assert.throws(
    () => normalizeWebSegments([{ start_ms: 100, end_ms: 10, spoken_text: 'текст' }]),
    error => error.statusCode === 422
  );
});

test('ответ Vosk валидируется и нормализуется', () => {
  assert.deepEqual(normalizeVoskResponse({
    segments: [{ start_ms: 0, end_ms: 900, text: 'результат', confidence: 0.75 }],
  }), [{ start_ms: 0, end_ms: 900, spoken_text: 'результат', confidence: 0.75 }]);
});

test('capabilities отражает доступность Vosk', () => {
  assert.equal(getCapabilities(false).engines.vosk.available, false);
  assert.equal(getCapabilities(true).engines.vosk.available, false);
  assert.equal(getCapabilities(true).engines.vosk.status, 'development');
  assert.equal(getCapabilities(true).engines.vosk.service_reachable, true);
  assert.equal(getCapabilities(true).contract_version, '1.0.0');
});

test('публичный сегмент не раскрывает внутренний ASR chunk id', () => {
  const segment = toPublicTranscriptSegment({
    id: 1,
    external_id: 'chunk-1:0',
    start_ms: 0,
    end_ms: 100,
    spoken_text: 'текст',
    confidence: 0.9,
    source: 'vosk',
    asr_chunk_id: 42,
  });
  assert.equal(segment.segment_id, 'chunk-1:0');
  assert.equal('asr_chunk_id' in segment, false);
});

test('повторный Vosk chunk_id не запускает распознавание повторно', async () => {
  const originalLoad = Module._load;
  let chunk = null;
  let storedSegments = [];
  let transcriptionCalls = 0;

  const sessionModel = {
    findById: async () => ({ id: 7, user_id: 3, status: 'in_progress', speech_engine: 'vosk' }),
    findByIdForUpdate: async () => ({
      id: 7, user_id: 3, status: 'in_progress', speech_engine: 'vosk'
    }),
    createAsrChunk: async input => {
      if (chunk) return null;
      chunk = {
        id: 11,
        status: 'processing',
        chunk_id: input.chunkId,
        offset_ms: input.offsetMs,
        mime_type: input.mimeType,
        byte_size: input.byteSize,
        content_sha256: input.contentSha256,
      };
      return chunk;
    },
    findAsrChunk: async () => chunk,
    reclaimAsrChunk: async () => null,
    getTranscriptSegmentsByChunk: async () => storedSegments,
    addTranscriptSegments: async (sessionId, segments) => {
      storedSegments = segments.map((segment, index) => ({ id: index + 1, ...segment }));
      return storedSegments;
    },
    completeAsrChunk: async () => {
      chunk = { ...chunk, status: 'completed' };
      return chunk;
    },
    failAsrChunk: async () => {},
  };

  Module._load = function load(request, parent, isMain) {
    if (parent?.filename.endsWith('speech-recognition.service.js')) {
      if (request === '../models/session.model') return sessionModel;
      if (request === './vosk-client.service') return {
        isConfigured: () => true,
        transcribe: async () => {
          transcriptionCalls += 1;
          return {
            language: 'ru',
            durationMs: 1000,
            segments: [{ start_ms: 0, end_ms: 900, spoken_text: 'тест', confidence: 0.9 }],
          };
        },
      };
      if (request === '../db/transaction') return { withTransaction: work => work({}) };
      if (request === '../utils/logger') return { info() {}, error() {} };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const servicePath = require.resolve('../src/services/speech-recognition.service');
    delete require.cache[servicePath];
    const service = require(servicePath);
    const input = {
      sessionId: 7,
      userId: 3,
      chunkId: 'chunk-1',
      offsetMs: 5000,
      file: { buffer: Buffer.from('audio'), size: 5, mimetype: 'audio/webm' },
    };

    const first = await service.transcribeVoskChunk(input);
    const duplicate = await service.transcribeVoskChunk(input);
    await assert.rejects(
      service.transcribeVoskChunk({
        ...input,
        file: { buffer: Buffer.from('other'), size: 5, mimetype: 'audio/webm' },
      }),
      error => error.statusCode === 409
    );

    assert.equal(first.duplicate, false);
    assert.equal(first.segments[0].start_ms, 5000);
    assert.equal(first.segments[0].end_ms, 5900);
    assert.equal(duplicate.duplicate, true);
    assert.equal(transcriptionCalls, 1);
  } finally {
    Module._load = originalLoad;
  }
});
