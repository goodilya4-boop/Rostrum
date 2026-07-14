import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { sessionsAPI } from '@/api/sessions.api';

function getErrorMessage(error, fallback) {
  return error.response?.data?.error?.message || error.message || fallback;
}

function mergeByKey(current, incoming, key) {
  const merged = new Map(current.map(item => [item[key], item]));
  for (const item of incoming || []) {
    const value = item[key];
    if (value !== undefined && value !== null) merged.set(value, item);
  }
  return [...merged.values()];
}

export const useSessionStore = defineStore('session', () => {
  const currentSession = ref(null);
  const selectedPresentation = ref(null);
  const currentSlideIndex = ref(1);
  const lastRecordedSlideIndex = ref(null);
  const rehearsalStartedAt = ref(null);

  const capabilities = ref(null);
  const history = ref([]);
  const pagination = ref({ page: 1, limit: 20, total: 0, pages: 0 });
  const pendingSlideChanges = ref([]);
  const savedSlideChanges = ref([]);
  const transcriptSegments = ref([]);
  const asrChunks = ref([]);

  const summary = ref(null);
  const feedback = ref([]);
  const report = ref([]);
  const analysis = ref(null);
  const analysisStatus = ref(null);

  const loading = ref(false);
  const loadingHistory = ref(false);
  const creating = ref(false);
  const savingSlideChanges = ref(false);
  const sendingTranscripts = ref(false);
  const asrUploads = ref(0);
  const completing = ref(false);
  const reanalyzing = ref(false);
  const error = ref(null);

  let slideFlushPromise = null;

  const sessionId = computed(() => currentSession.value?.id || null);
  const speechEngine = computed(() => currentSession.value?.speech_engine || null);
  const isInProgress = computed(() => currentSession.value?.status === 'in_progress');
  const hasPendingSlideChanges = computed(() => pendingSlideChanges.value.length > 0);
  const hasActiveAsrUploads = computed(() => asrUploads.value > 0);

  function clearError() {
    error.value = null;
  }

  function setError(requestError, fallback) {
    const message = getErrorMessage(requestError, fallback);
    const status = Number(requestError.response?.status) || null;
    error.value = message;
    return { success: false, message, status };
  }

  function applyDetails(data) {
    if (data.session) currentSession.value = data.session;
    syncRehearsalClock();
    if (Array.isArray(data.slide_changes)) {
      savedSlideChanges.value = [...data.slide_changes].sort(
        (left, right) => left.timestamp_offset_ms - right.timestamp_offset_ms
      );
      const lastChange = savedSlideChanges.value.at(-1);
      if (lastChange) {
        currentSlideIndex.value = lastChange.slide_index;
        lastRecordedSlideIndex.value = lastChange.slide_index;
      }
    }
    summary.value = data.summary || null;
    feedback.value = Array.isArray(data.feedback) ? data.feedback : [];
    report.value = Array.isArray(data.report) ? data.report : [];
    analysis.value = data.analysis || null;
    analysisStatus.value = data.analysis_status || data.summary?.analysis_status || null;
  }

  function setSelectedPresentation(presentation) {
    selectedPresentation.value = presentation || null;
    if (presentation?.slides?.length && lastRecordedSlideIndex.value === null) {
      currentSlideIndex.value = presentation.slides[0].slide_index;
    }
  }

  function syncRehearsalClock() {
    const startTime = Date.parse(currentSession.value?.start_time);
    if (!Number.isFinite(startTime)) {
      rehearsalStartedAt.value = null;
      return;
    }
    const elapsedSinceServerStart = Math.max(0, Date.now() - startTime);
    rehearsalStartedAt.value = performance.now() - elapsedSinceServerStart;
  }

  async function fetchCapabilities() {
    clearError();
    try {
      const { data } = await sessionsAPI.getAsrCapabilities();
      capabilities.value = data;
      return { success: true, capabilities: data };
    } catch (requestError) {
      return setError(requestError, 'Не удалось получить возможности распознавания речи');
    }
  }

  async function fetchHistory(page = 1, limit = 20) {
    loadingHistory.value = true;
    clearError();
    try {
      const { data } = await sessionsAPI.getHistory(page, limit);
      history.value = Array.isArray(data.sessions) ? data.sessions : [];
      pagination.value = data.pagination || { page, limit, total: history.value.length, pages: 1 };
      return { success: true, sessions: history.value, pagination: pagination.value };
    } catch (requestError) {
      history.value = [];
      return setError(requestError, 'Не удалось загрузить историю репетиций');
    } finally {
      loadingHistory.value = false;
    }
  }

  async function createSession({ presentationId, timeLimitSec, speechEngine: engine = 'web', presentation = null }) {
    creating.value = true;
    clearError();
    try {
      const { data } = await sessionsAPI.create({
        presentationId,
        timeLimitSec,
        speechEngine: engine,
      });
      if (!data.session?.id) throw new Error('Backend вернул некорректную сессию');

      resetRehearsalState();
      currentSession.value = data.session;
      syncRehearsalClock();
      setSelectedPresentation(presentation);
      return { success: true, session: data.session };
    } catch (requestError) {
      return setError(requestError, 'Не удалось создать сессию');
    } finally {
      creating.value = false;
    }
  }

  async function fetchSession(id) {
    loading.value = true;
    clearError();
    try {
      const { data } = await sessionsAPI.getById(id);
      if (!data.session?.id) throw new Error('Backend вернул некорректную сессию');
      if (currentSession.value?.id !== data.session.id) {
        resetRehearsalState();
        if (selectedPresentation.value?.id !== data.session.presentation_id) {
          selectedPresentation.value = null;
        }
      }
      applyDetails(data);
      return { success: true, data };
    } catch (requestError) {
      return setError(requestError, 'Не удалось загрузить сессию');
    } finally {
      loading.value = false;
    }
  }

  function startRehearsal(initialSlideIndex = 1) {
    if (!isInProgress.value) {
      return { success: false, message: 'Сессия не находится в процессе выполнения' };
    }
    if (rehearsalStartedAt.value === null) syncRehearsalClock();
    if (lastRecordedSlideIndex.value !== null) {
      return { success: true, queued: false };
    }
    return recordSlideChange(initialSlideIndex, 0);
  }

  function getElapsedMs() {
    if (rehearsalStartedAt.value === null) return 0;
    return Math.max(0, Math.round(performance.now() - rehearsalStartedAt.value));
  }

  function recordSlideChange(slideIndex, offsetMs = getElapsedMs()) {
    if (!isInProgress.value) {
      return { success: false, message: 'Сессия не находится в процессе выполнения' };
    }
    const normalizedSlideIndex = Number(slideIndex);
    const normalizedOffset = Math.round(Number(offsetMs));
    if (!Number.isInteger(normalizedSlideIndex) || normalizedSlideIndex < 1) {
      return { success: false, message: 'Некорректный номер слайда' };
    }
    if (!Number.isSafeInteger(normalizedOffset) || normalizedOffset < 0) {
      return { success: false, message: 'Некорректное время переключения слайда' };
    }

    currentSlideIndex.value = normalizedSlideIndex;
    if (lastRecordedSlideIndex.value === normalizedSlideIndex) {
      return { success: true, queued: false };
    }

    pendingSlideChanges.value.push({
      slide_index: normalizedSlideIndex,
      timestamp_offset_ms: normalizedOffset,
    });
    lastRecordedSlideIndex.value = normalizedSlideIndex;
    return { success: true, queued: true };
  }

  async function flushSlideChanges() {
    if (!sessionId.value) return { success: false, message: 'Сессия не выбрана' };

    if (slideFlushPromise) {
      const activeResult = await slideFlushPromise;
      if (!activeResult.success || pendingSlideChanges.value.length === 0) return activeResult;
      return flushSlideChanges();
    }

    if (pendingSlideChanges.value.length === 0) return { success: true, changes: [] };
    const batch = pendingSlideChanges.value.slice();
    savingSlideChanges.value = true;
    clearError();

    slideFlushPromise = (async () => {
      try {
        const { data } = await sessionsAPI.addSlideChanges(sessionId.value, batch);
        pendingSlideChanges.value.splice(0, batch.length);
        savedSlideChanges.value.push(...(data.changes || []));
        return { success: true, changes: data.changes || [] };
      } catch (requestError) {
        return setError(requestError, 'Не удалось сохранить переключения слайдов');
      }
    })();

    const result = await slideFlushPromise;
    slideFlushPromise = null;
    savingSlideChanges.value = false;

    if (result.success && pendingSlideChanges.value.length > 0) return flushSlideChanges();
    return result;
  }

  async function sendWebTranscripts(segments) {
    if (!sessionId.value) return { success: false, message: 'Сессия не выбрана' };
    if (speechEngine.value !== 'web') {
      return { success: false, message: 'Сессия не использует Web Speech' };
    }
    if (!Array.isArray(segments) || segments.length === 0) {
      return { success: true, segments: [] };
    }

    sendingTranscripts.value = true;
    clearError();
    try {
      const { data } = await sessionsAPI.addWebTranscripts(sessionId.value, segments);
      transcriptSegments.value = mergeByKey(
        transcriptSegments.value,
        data.segments || [],
        'segment_id'
      );
      return { success: true, segments: data.segments || [] };
    } catch (requestError) {
      return setError(requestError, 'Не удалось сохранить транскрипты');
    } finally {
      sendingTranscripts.value = false;
    }
  }

  async function uploadVoskChunk(chunk, onUploadProgress) {
    if (!sessionId.value) return { success: false, message: 'Сессия не выбрана' };
    if (speechEngine.value !== 'vosk') {
      return { success: false, message: 'Сессия не использует Vosk' };
    }
    asrUploads.value += 1;
    clearError();
    try {
      const { data } = await sessionsAPI.transcribeVoskChunk(
        sessionId.value,
        chunk,
        onUploadProgress
      );
      if (data.chunk) {
        asrChunks.value = mergeByKey(asrChunks.value, [data.chunk], 'chunk_id');
      }
      transcriptSegments.value = mergeByKey(
        transcriptSegments.value,
        data.segments || [],
        'segment_id'
      );
      return { success: true, ...data };
    } catch (requestError) {
      return setError(requestError, 'Не удалось распознать аудиочанк');
    } finally {
      asrUploads.value -= 1;
    }
  }

  async function fetchAsrChunks() {
    if (!sessionId.value) return { success: false, message: 'Сессия не выбрана' };
    clearError();
    try {
      const { data } = await sessionsAPI.getAsrChunks(sessionId.value);
      asrChunks.value = Array.isArray(data.chunks) ? data.chunks : [];
      return { success: true, chunks: asrChunks.value };
    } catch (requestError) {
      return setError(requestError, 'Не удалось получить состояние аудиочанков');
    }
  }

  async function completeSession() {
    if (!sessionId.value) return { success: false, message: 'Сессия не выбрана' };
    completing.value = true;
    clearError();
    try {
      const flushResult = await flushSlideChanges();
      if (!flushResult.success) return flushResult;
      if (hasActiveAsrUploads.value) {
        return { success: false, message: 'Дождитесь отправки аудиочанков' };
      }

      const { data } = await sessionsAPI.complete(sessionId.value);
      applyDetails(data);
      return { success: true, data };
    } catch (requestError) {
      return setError(requestError, 'Не удалось завершить сессию');
    } finally {
      completing.value = false;
    }
  }

  async function reanalyzeSession() {
    if (!sessionId.value) return { success: false, message: 'Сессия не выбрана' };
    reanalyzing.value = true;
    clearError();
    try {
      const { data } = await sessionsAPI.reanalyze(sessionId.value);
      applyDetails(data);
      return { success: true, data };
    } catch (requestError) {
      return setError(requestError, 'Не удалось повторить анализ');
    } finally {
      reanalyzing.value = false;
    }
  }

  function resetRehearsalState() {
    currentSlideIndex.value = 1;
    lastRecordedSlideIndex.value = null;
    rehearsalStartedAt.value = null;
    pendingSlideChanges.value = [];
    savedSlideChanges.value = [];
    transcriptSegments.value = [];
    asrChunks.value = [];
    summary.value = null;
    feedback.value = [];
    report.value = [];
    analysis.value = null;
    analysisStatus.value = null;
    error.value = null;
  }

  function resetSession() {
    currentSession.value = null;
    selectedPresentation.value = null;
    resetRehearsalState();
  }

  return {
    currentSession,
    selectedPresentation,
    currentSlideIndex,
    rehearsalStartedAt,
    capabilities,
    history,
    pagination,
    pendingSlideChanges,
    savedSlideChanges,
    transcriptSegments,
    asrChunks,
    summary,
    feedback,
    report,
    analysis,
    analysisStatus,
    loading,
    loadingHistory,
    creating,
    savingSlideChanges,
    sendingTranscripts,
    asrUploads,
    completing,
    reanalyzing,
    error,
    sessionId,
    speechEngine,
    isInProgress,
    hasPendingSlideChanges,
    hasActiveAsrUploads,
    clearError,
    setSelectedPresentation,
    syncRehearsalClock,
    fetchCapabilities,
    fetchHistory,
    createSession,
    fetchSession,
    startRehearsal,
    getElapsedMs,
    recordSlideChange,
    flushSlideChanges,
    sendWebTranscripts,
    uploadVoskChunk,
    fetchAsrChunks,
    completeSession,
    reanalyzeSession,
    resetSession,
  };
});
