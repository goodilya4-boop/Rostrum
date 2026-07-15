import { computed, onBeforeUnmount, ref } from 'vue';

const RECORDER_CANDIDATES = Object.freeze([
  { recorderType: 'audio/webm;codecs=opus', uploadType: 'audio/webm' },
  { recorderType: 'audio/ogg;codecs=opus', uploadType: 'audio/ogg' },
  { recorderType: 'audio/mp4', uploadType: 'audio/mp4' },
  { recorderType: 'audio/webm', uploadType: 'audio/webm' },
  { recorderType: 'audio/ogg', uploadType: 'audio/ogg' },
]);

const PERMISSION_ERRORS = new Set(['NotAllowedError', 'SecurityError']);

function stopTracks(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

export function useVoskRecorder({
  getElapsedMs,
  getAcceptedMimeTypes,
  onChunk,
  chunkDurationMs = 10000,
} = {}) {
  const hasMediaDevices = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
  const hasMediaRecorder = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && typeof window.MediaRecorder.isTypeSupported === 'function';
  const supported = ref(hasMediaDevices && hasMediaRecorder);
  const recording = ref(false);
  const starting = ref(false);
  const permissionDenied = ref(false);
  const error = ref('');
  const mimeType = ref('');

  let stream = null;
  let recorder = null;
  let cycleParts = [];
  let cycleOffsetMs = 0;
  let cycleTimer = null;
  let shouldRecord = false;
  let cycleNumber = 0;
  let stopPromise = null;
  let resolveStop = null;

  const status = computed(() => {
    if (!supported.value) return 'unsupported';
    if (permissionDenied.value) return 'denied';
    if (starting.value) return 'starting';
    if (recording.value) return 'recording';
    return 'idle';
  });

  function elapsedMs() {
    const value = Number(getElapsedMs?.());
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  function chooseFormat() {
    const accepted = new Set((getAcceptedMimeTypes?.() || []).map(value => String(value).toLowerCase()));
    return RECORDER_CANDIDATES.find(candidate => (
      (accepted.size === 0 || accepted.has(candidate.uploadType))
      && window.MediaRecorder.isTypeSupported(candidate.recorderType)
    )) || null;
  }

  function finishStop() {
    recording.value = false;
    starting.value = false;
    stopTracks(stream);
    stream = null;
    recorder = null;
    const resolve = resolveStop;
    resolveStop = null;
    stopPromise = null;
    resolve?.();
  }

  function startCycle(format) {
    if (!shouldRecord || !stream?.active) {
      finishStop();
      return;
    }

    cycleParts = [];
    cycleOffsetMs = elapsedMs();
    const currentCycle = ++cycleNumber;

    try {
      recorder = new window.MediaRecorder(stream, { mimeType: format.recorderType });
    } catch (recorderError) {
      error.value = recorderError.message || 'Браузер не смог создать аудиозапись';
      shouldRecord = false;
      finishStop();
      return;
    }

    recorder.ondataavailable = event => {
      if (event.data?.size) cycleParts.push(event.data);
    };

    recorder.onerror = event => {
      error.value = event.error?.message || 'Ошибка записи аудио';
      shouldRecord = false;
    };

    recorder.onstop = async () => {
      window.clearTimeout(cycleTimer);
      const endOffsetMs = elapsedMs();
      if (cycleParts.length) {
        const rawBlob = new Blob(cycleParts, { type: format.recorderType });
        const uploadBlob = new Blob([rawBlob], { type: format.uploadType });
        try {
          await onChunk?.({
            blob: uploadBlob,
            offsetMs: cycleOffsetMs,
            durationMs: Math.max(0, endOffsetMs - cycleOffsetMs),
            sequence: currentCycle,
            mimeType: format.uploadType,
          });
        } catch (chunkError) {
          error.value = chunkError.message || 'Не удалось подготовить аудиочанк';
        }
      }

      if (shouldRecord) startCycle(format);
      else finishStop();
    };

    try {
      recorder.start();
      recording.value = true;
      starting.value = false;
      cycleTimer = window.setTimeout(() => {
        if (recorder?.state === 'recording') recorder.stop();
      }, chunkDurationMs);
    } catch (startError) {
      error.value = startError.message || 'Не удалось запустить запись аудио';
      shouldRecord = false;
      finishStop();
    }
  }

  async function start() {
    if (!supported.value || recording.value || starting.value) return supported.value;
    const format = chooseFormat();
    if (!format) {
      supported.value = false;
      error.value = 'Браузер не поддерживает аудиоформаты, принимаемые Backend.';
      return false;
    }

    starting.value = true;
    permissionDenied.value = false;
    error.value = '';
    mimeType.value = format.uploadType;
    shouldRecord = true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      startCycle(format);
      return true;
    } catch (mediaError) {
      shouldRecord = false;
      permissionDenied.value = PERMISSION_ERRORS.has(mediaError.name);
      error.value = permissionDenied.value
        ? 'Доступ к микрофону запрещён. Разрешите его в настройках браузера.'
        : (mediaError.message || 'Не удалось получить доступ к микрофону');
      finishStop();
      return false;
    }
  }

  async function stop() {
    shouldRecord = false;
    window.clearTimeout(cycleTimer);
    if (!recorder || recorder.state === 'inactive') {
      finishStop();
      return;
    }
    if (!stopPromise) stopPromise = new Promise(resolve => { resolveStop = resolve; });
    try {
      recorder.stop();
    } catch {
      finishStop();
    }
    await Promise.race([
      stopPromise,
      new Promise(resolve => window.setTimeout(resolve, 3000)),
    ]);
  }

  function abort() {
    shouldRecord = false;
    window.clearTimeout(cycleTimer);
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // Запись могла закрыться раньше.
      }
    }
    finishStop();
  }

  onBeforeUnmount(abort);

  return {
    supported,
    recording,
    starting,
    permissionDenied,
    error,
    mimeType,
    status,
    start,
    stop,
    abort,
  };
}
