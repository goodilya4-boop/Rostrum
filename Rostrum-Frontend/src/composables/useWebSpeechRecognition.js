import { computed, onBeforeUnmount, ref } from 'vue';

const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

const ERROR_MESSAGES = Object.freeze({
  'not-allowed': 'Доступ к микрофону запрещён. Разрешите его в настройках браузера.',
  'service-not-allowed': 'Браузер запретил сервис распознавания речи.',
  'audio-capture': 'Микрофон не найден или используется другим приложением.',
  network: 'Сервис Web Speech временно недоступен из-за сетевой ошибки.',
  'language-not-supported': 'Выбранный язык не поддерживается Web Speech.',
});

function createSegmentId(prefix) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
}

function estimateDurationMs(text) {
  const wordCount = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.min(8000, Math.max(500, wordCount * 360));
}

export function useWebSpeechRecognition({
  getElapsedMs,
  onFinalSegments,
  language = 'ru-RU',
  idPrefix = 'web',
} = {}) {
  const Recognition = typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

  const supported = ref(Boolean(Recognition));
  const listening = ref(false);
  const restarting = ref(false);
  const interimText = ref('');
  const lastFinalText = ref('');
  const error = ref('');
  const permissionDenied = ref(false);

  let recognition = null;
  let recognitionActive = false;
  let shouldListen = false;
  let restartTimer = null;
  let utteranceStartedAt = null;
  let lastSegmentEnd = 0;
  let stopResolvers = [];

  const status = computed(() => {
    if (!supported.value) return 'unsupported';
    if (permissionDenied.value) return 'denied';
    if (restarting.value) return 'restarting';
    if (listening.value) return 'listening';
    return 'idle';
  });

  function elapsedMs() {
    const value = Number(getElapsedMs?.());
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  function resolveStopWaiters() {
    const resolvers = stopResolvers;
    stopResolvers = [];
    resolvers.forEach(resolve => resolve());
  }

  function scheduleRestart() {
    if (!shouldListen || permissionDenied.value) return;
    window.clearTimeout(restartTimer);
    restarting.value = true;
    restartTimer = window.setTimeout(() => {
      restarting.value = false;
      startRecognition();
    }, 350);
  }

  function buildRecognition() {
    if (!Recognition || recognition) return;
    recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognitionActive = true;
      listening.value = true;
      restarting.value = false;
      error.value = '';
    };

    recognition.onspeechstart = () => {
      utteranceStartedAt = elapsedMs();
    };

    recognition.onspeechend = () => {
      utteranceStartedAt = null;
    };

    recognition.onresult = event => {
      const finalResults = [];
      const interimParts = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result[0];
        const text = String(alternative?.transcript || '').trim();
        if (!text) continue;
        if (result.isFinal) {
          finalResults.push({ text, confidence: Number(alternative.confidence) });
        } else {
          interimParts.push(text);
        }
      }

      interimText.value = interimParts.join(' ');
      if (finalResults.length === 0) return;

      const endAt = elapsedMs();
      const estimates = finalResults.map(item => estimateDurationMs(item.text));
      const estimatedTotal = estimates.reduce((sum, duration) => sum + duration, 0);
      const preferredStart = utteranceStartedAt ?? Math.max(0, endAt - estimatedTotal);
      let cursor = Math.max(lastSegmentEnd, Math.min(preferredStart, endAt));
      const availableDuration = Math.max(0, endAt - cursor);

      const segments = finalResults.map((item, index) => {
        const isLast = index === finalResults.length - 1;
        const proportionalDuration = estimatedTotal > 0
          ? Math.round(availableDuration * (estimates[index] / estimatedTotal))
          : 0;
        const segmentEnd = isLast ? endAt : Math.min(endAt, cursor + proportionalDuration);
        const confidence = Number.isFinite(item.confidence)
          && item.confidence >= 0
          && item.confidence <= 1
          ? item.confidence
          : undefined;
        const segment = {
          segment_id: createSegmentId(idPrefix),
          start_ms: cursor,
          end_ms: Math.max(cursor, segmentEnd),
          spoken_text: item.text,
          ...(confidence === undefined ? {} : { confidence }),
        };
        cursor = segment.end_ms;
        return segment;
      });

      lastSegmentEnd = segments.at(-1).end_ms;
      lastFinalText.value = segments.map(segment => segment.spoken_text).join(' ');
      interimText.value = '';
      Promise.resolve(onFinalSegments?.(segments)).catch(() => {});
    };

    recognition.onerror = event => {
      const code = event.error || 'unknown';
      if (code === 'no-speech' || code === 'aborted') return;
      error.value = ERROR_MESSAGES[code] || `Ошибка Web Speech: ${code}`;
      if (FATAL_ERRORS.has(code)) {
        shouldListen = false;
        permissionDenied.value = code === 'not-allowed' || code === 'service-not-allowed';
      }
    };

    recognition.onend = () => {
      recognitionActive = false;
      listening.value = false;
      interimText.value = '';
      resolveStopWaiters();
      scheduleRestart();
    };
  }

  function startRecognition() {
    if (!supported.value || !shouldListen || recognitionActive) return;
    buildRecognition();
    recognitionActive = true;
    try {
      recognition.start();
    } catch (startError) {
      recognitionActive = false;
      if (startError.name !== 'InvalidStateError') {
        error.value = startError.message || 'Не удалось запустить Web Speech';
      }
      scheduleRestart();
    }
  }

  function start() {
    if (!supported.value) {
      error.value = 'Web Speech не поддерживается этим браузером.';
      return false;
    }
    permissionDenied.value = false;
    error.value = '';
    shouldListen = true;
    startRecognition();
    return true;
  }

  async function stop() {
    shouldListen = false;
    restarting.value = false;
    window.clearTimeout(restartTimer);
    if (!recognitionActive || !recognition) {
      listening.value = false;
      return;
    }

    const ended = new Promise(resolve => stopResolvers.push(resolve));
    try {
      recognition.stop();
    } catch {
      resolveStopWaiters();
    }
    await Promise.race([
      ended,
      new Promise(resolve => window.setTimeout(resolve, 1500)),
    ]);
  }

  function abort() {
    shouldListen = false;
    window.clearTimeout(restartTimer);
    try {
      recognition?.abort();
    } catch {
      // Распознавание могло остановиться раньше.
    }
    recognitionActive = false;
    listening.value = false;
    restarting.value = false;
    resolveStopWaiters();
  }

  onBeforeUnmount(abort);

  return {
    supported,
    listening,
    restarting,
    interimText,
    lastFinalText,
    error,
    permissionDenied,
    status,
    start,
    stop,
    abort,
  };
}

export { estimateDurationMs };
