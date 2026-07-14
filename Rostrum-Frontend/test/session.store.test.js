import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { sessionsAPI } from '@/api/sessions.api';
import { useSessionStore } from '@/stores/session.store';

vi.mock('@/api/sessions.api', () => ({
  sessionsAPI: {
    getHistory: vi.fn(),
    getById: vi.fn(),
    getAsrCapabilities: vi.fn(),
    getAsrChunks: vi.fn(),
    create: vi.fn(),
    addSlideChanges: vi.fn(),
    addWebTranscripts: vi.fn(),
    transcribeVoskChunk: vi.fn(),
    complete: vi.fn(),
    reanalyze: vi.fn(),
  },
}));

function session(overrides = {}) {
  return {
    id: 7,
    presentation_id: 3,
    status: 'in_progress',
    speech_engine: 'web',
    start_time: new Date(Date.now() - 5000).toISOString(),
    time_limit_sec: 420,
    ...overrides,
  };
}

describe('session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.resetAllMocks();
  });

  it('восстанавливает последний слайд и готовый отчёт', async () => {
    sessionsAPI.getById.mockResolvedValue({ data: {
      session: session({ status: 'completed' }),
      slide_changes: [
        { slide_index: 3, timestamp_offset_ms: 4000 },
        { slide_index: 1, timestamp_offset_ms: 0 },
        { slide_index: 2, timestamp_offset_ms: 2000 },
      ],
      summary: { analysis_status: 'completed', overall_coverage: 0.8 },
      feedback: [{ slide_index: 1 }],
      report: [{ presentation_title: 'Защита' }],
    } });

    const store = useSessionStore();
    const result = await store.fetchSession(7);

    expect(result.success).toBe(true);
    expect(store.currentSlideIndex).toBe(3);
    expect(store.savedSlideChanges.map(change => change.slide_index)).toEqual([1, 2, 3]);
    expect(store.analysisStatus).toBe('completed');
    expect(store.report[0].presentation_title).toBe('Защита');
  });

  it('не теряет переключение, добавленное во время активного flush', async () => {
    sessionsAPI.getById.mockResolvedValue({ data: { session: session(), slide_changes: [] } });
    let resolveFirstRequest;
    sessionsAPI.addSlideChanges
      .mockImplementationOnce(() => new Promise(resolve => { resolveFirstRequest = resolve; }))
      .mockResolvedValueOnce({ data: {
        changes: [{ slide_index: 2, timestamp_offset_ms: 1500 }],
      } });

    const store = useSessionStore();
    await store.fetchSession(7);
    store.recordSlideChange(1, 0);
    const flush = store.flushSlideChanges();
    await Promise.resolve();
    store.recordSlideChange(2, 1500);
    resolveFirstRequest({ data: { changes: [{ slide_index: 1, timestamp_offset_ms: 0 }] } });

    const result = await flush;
    expect(result.success).toBe(true);
    expect(sessionsAPI.addSlideChanges).toHaveBeenCalledTimes(2);
    expect(sessionsAPI.addSlideChanges.mock.calls[0][1]).toEqual([
      { slide_index: 1, timestamp_offset_ms: 0 },
    ]);
    expect(sessionsAPI.addSlideChanges.mock.calls[1][1]).toEqual([
      { slide_index: 2, timestamp_offset_ms: 1500 },
    ]);
    expect(store.pendingSlideChanges).toHaveLength(0);
  });

  it('объединяет повторные Web Speech сегменты по segment_id', async () => {
    sessionsAPI.getById.mockResolvedValue({ data: { session: session(), slide_changes: [] } });
    sessionsAPI.addWebTranscripts
      .mockResolvedValueOnce({ data: { segments: [
        { segment_id: 'a', spoken_text: 'первая версия' },
      ] } })
      .mockResolvedValueOnce({ data: { segments: [
        { segment_id: 'a', spoken_text: 'обновлено' },
        { segment_id: 'b', spoken_text: 'новый сегмент' },
      ] } });

    const store = useSessionStore();
    await store.fetchSession(7);
    await store.sendWebTranscripts([{ segment_id: 'a' }]);
    await store.sendWebTranscripts([{ segment_id: 'a' }, { segment_id: 'b' }]);

    expect(store.transcriptSegments).toHaveLength(2);
    expect(store.transcriptSegments.find(item => item.segment_id === 'a').spoken_text).toBe('обновлено');
  });

  it('отслеживает активную Vosk-загрузку и сохраняет результат', async () => {
    sessionsAPI.getById.mockResolvedValue({ data: {
      session: session({ speech_engine: 'vosk' }),
      slide_changes: [],
    } });
    let resolveUpload;
    sessionsAPI.transcribeVoskChunk.mockImplementation(() => new Promise(resolve => {
      resolveUpload = resolve;
    }));

    const store = useSessionStore();
    await store.fetchSession(7);
    const upload = store.uploadVoskChunk({ chunkId: 'chunk-1', audio: new Blob(['audio']), offsetMs: 0 });
    expect(store.hasActiveAsrUploads).toBe(true);
    resolveUpload({ data: {
      chunk: { chunk_id: 'chunk-1', status: 'completed' },
      segments: [{ segment_id: 'chunk-1:0', spoken_text: 'текст' }],
    } });

    const result = await upload;
    expect(result.success).toBe(true);
    expect(store.hasActiveAsrUploads).toBe(false);
    expect(store.asrChunks[0].status).toBe('completed');
    expect(store.transcriptSegments[0].spoken_text).toBe('текст');
  });

  it('сначала сохраняет слайды и только затем завершает сессию', async () => {
    sessionsAPI.getById.mockResolvedValue({ data: { session: session(), slide_changes: [] } });
    const order = [];
    sessionsAPI.addSlideChanges.mockImplementation(async () => {
      order.push('slides');
      return { data: { changes: [{ slide_index: 1, timestamp_offset_ms: 0 }] } };
    });
    sessionsAPI.complete.mockImplementation(async () => {
      order.push('complete');
      return { data: { session: session({ status: 'completed' }), summary: {} } };
    });

    const store = useSessionStore();
    await store.fetchSession(7);
    store.recordSlideChange(1, 0);
    const result = await store.completeSession();

    expect(result.success).toBe(true);
    expect(order).toEqual(['slides', 'complete']);
    expect(store.currentSession.status).toBe('completed');
  });
});
