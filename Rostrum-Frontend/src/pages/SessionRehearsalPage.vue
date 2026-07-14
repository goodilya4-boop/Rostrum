<template>
  <div ref="rehearsalRoot" class="rehearsal-page" :class="{ 'rehearsal-page--fullscreen': isFullscreen }">
    <div v-if="loading" class="rehearsal-page__loading">
      <BaseSpinner text="Подготовка экрана репетиции..." />
    </div>

    <BaseCard v-else-if="loadError" class="rehearsal-page__error-card">
      <div class="rehearsal-page__state" role="alert">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h1>Не удалось открыть репетицию</h1>
        <p>{{ loadError }}</p>
        <BaseButton variant="secondary" @click="leaveToDashboard">На Dashboard</BaseButton>
      </div>
    </BaseCard>

    <template v-else-if="session && activeSlide">
      <header class="rehearsal-page__header">
        <div class="rehearsal-page__identity">
          <span class="rehearsal-page__live" :class="{ 'rehearsal-page__live--active': microphoneActive }">
            <i class="fa-solid fa-circle"></i>
            {{ microphoneActive ? 'Микрофон включён' : 'Репетиция' }}
          </span>
          <div>
            <h1>{{ presentation.title }}</h1>
            <p>{{ engineLabel }} · сессия №{{ session.id }}</p>
          </div>
        </div>

        <div class="rehearsal-page__time" :class="{ 'rehearsal-page__time--warning': timeWarning, 'rehearsal-page__time--overtime': isOvertime }">
          <span>{{ isOvertime ? 'Сверх регламента' : 'Осталось' }}</span>
          <strong>{{ displayedTime }}</strong>
        </div>

        <div class="rehearsal-page__header-actions">
          <button type="button" class="rehearsal-page__icon-button" :title="isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран (F)'" @click="toggleFullscreen">
            <i :class="isFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand'"></i>
          </button>
          <BaseButton variant="danger" icon="fa-solid fa-stop" :loading="sessionStore.completing" @click="finishSession">
            Завершить
          </BaseButton>
        </div>
      </header>

      <div class="rehearsal-page__progress" :title="`${Math.round(progressPercent)}% регламента`">
        <span :style="{ width: `${progressPercent}%` }" :class="{ 'rehearsal-page__progress-fill--overtime': isOvertime }"></span>
      </div>

      <main class="rehearsal-page__workspace">
        <aside class="rehearsal-page__slides" aria-label="Слайды презентации">
          <button
            v-for="(slide, index) in slides"
            :key="slide.id || slide.slide_index"
            type="button"
            class="rehearsal-page__thumbnail"
            :class="{ 'rehearsal-page__thumbnail--active': slide.slide_index === activeSlide.slide_index }"
            :aria-current="slide.slide_index === activeSlide.slide_index ? 'true' : undefined"
            @click="goToPosition(index)"
          >
            <span>{{ slide.slide_index }}</span>
            <p>{{ slide.extracted_text || 'Без текста' }}</p>
          </button>
        </aside>

        <section class="rehearsal-page__stage" aria-label="Текущий слайд">
          <RehearsalSlide :slide="activeSlide" />

          <div class="rehearsal-page__controls">
            <BaseButton variant="secondary" icon="fa-solid fa-chevron-left" :disabled="activePosition === 0" @click="previousSlide">
              Назад
            </BaseButton>

            <div class="rehearsal-page__counter">
              <strong>{{ activePosition + 1 }}</strong>
              <span>/ {{ slides.length }}</span>
            </div>

            <BaseButton variant="primary" :disabled="activePosition === slides.length - 1" @click="nextSlide">
              Далее
              <i class="fa-solid fa-chevron-right"></i>
            </BaseButton>
          </div>
        </section>

        <aside class="rehearsal-page__status-panel">
          <div class="rehearsal-page__status-block">
            <span class="rehearsal-page__status-label">Текущий слайд</span>
            <strong>{{ activePosition + 1 }} из {{ slides.length }}</strong>
            <p>{{ truncate(activeSlide.extracted_text, 100) || 'Слайд без извлечённого текста' }}</p>
          </div>

          <div class="rehearsal-page__status-block">
            <span class="rehearsal-page__status-label">Синхронизация</span>
            <div class="rehearsal-page__sync" :class="{ 'rehearsal-page__sync--busy': sessionStore.savingSlideChanges, 'rehearsal-page__sync--error': syncError }">
              <i :class="syncIcon"></i>
              <span>{{ syncText }}</span>
            </div>
          </div>

          <div class="rehearsal-page__status-block">
            <span class="rehearsal-page__status-label">Распознавание</span>
            <strong>{{ engineLabel }}</strong>
            <template v-if="session.speech_engine === 'web'">
              <div class="rehearsal-page__speech-state" :class="`rehearsal-page__speech-state--${speechStatus}`">
                <i :class="speechStatusIcon"></i>
                <span>{{ speechStatusText }}</span>
              </div>
              <button
                type="button"
                class="rehearsal-page__microphone"
                :class="{ 'rehearsal-page__microphone--active': speechListening }"
                :disabled="!speechSupported || speechPermissionDenied"
                @click="toggleSpeech"
              >
                <i :class="speechListening ? 'fa-solid fa-microphone-slash' : 'fa-solid fa-microphone'"></i>
                {{ speechListening ? 'Остановить' : 'Включить микрофон' }}
              </button>
              <p v-if="speechInterimText" class="rehearsal-page__interim">«{{ speechInterimText }}»</p>
              <p v-else-if="speechLastFinalText" class="rehearsal-page__last-final">Последняя фраза: «{{ truncate(speechLastFinalText, 80) }}»</p>
              <p v-if="speechError" class="rehearsal-page__speech-error">{{ speechError }}</p>
              <p>{{ speechSyncText }}</p>
            </template>
            <template v-else>
              <div class="rehearsal-page__speech-state" :class="`rehearsal-page__speech-state--${voskStatus}`">
                <i :class="voskStatusIcon"></i>
                <span>{{ voskStatusText }}</span>
              </div>
              <button
                type="button"
                class="rehearsal-page__microphone"
                :class="{ 'rehearsal-page__microphone--active': voskRecording }"
                :disabled="!voskSupported || voskPermissionDenied || voskStarting || !sessionStore.capabilities?.engines?.vosk?.available"
                @click="toggleVosk"
              >
                <i :class="voskRecording ? 'fa-solid fa-microphone-slash' : 'fa-solid fa-microphone'"></i>
                {{ voskRecording ? 'Остановить запись' : 'Включить микрофон' }}
              </button>
              <p v-if="voskError" class="rehearsal-page__speech-error">{{ voskError }}</p>
              <p :class="{ 'rehearsal-page__speech-error': voskSyncError }">{{ voskSyncText }}</p>
              <p v-if="voskMimeType">Формат: {{ voskMimeType }}</p>
            </template>
          </div>

          <div class="rehearsal-page__shortcuts">
            <span><kbd>←</kbd><kbd>→</kbd> слайды</span>
            <span><kbd>F</kbd> полный экран</span>
          </div>
        </aside>
      </main>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { usePresentationStore } from '@/stores/presentation.store';
import { useSessionStore } from '@/stores/session.store';
import { useToastStore } from '@/stores/toast.store';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';
import RehearsalSlide from '@/components/session/RehearsalSlide.vue';
import { useWebSpeechRecognition } from '@/composables/useWebSpeechRecognition';
import { useVoskRecorder } from '@/composables/useVoskRecorder';

const route = useRoute();
const router = useRouter();
const presentationStore = usePresentationStore();
const sessionStore = useSessionStore();
const toastStore = useToastStore();

const rehearsalRoot = ref(null);
const loading = ref(true);
const loadError = ref('');
const elapsedSeconds = ref(0);
const isFullscreen = ref(false);
const syncError = ref('');
const pendingSpeechSegments = ref([]);
const speechSyncError = ref('');
const pendingVoskChunks = ref([]);
const voskSyncError = ref('');
let timerInterval = null;
let flushInterval = null;
let flushTimeout = null;
let speechFlushTimeout = null;
let speechRetryTimeout = null;
let speechFlushPromise = null;
let voskRetryTimeout = null;
let voskFlushPromise = null;
let voskRetryAttempts = 0;
let nextVoskRetryAt = 0;
let allowLeave = false;

const {
  supported: speechSupported,
  listening: speechListening,
  restarting: speechRestarting,
  interimText: speechInterimText,
  lastFinalText: speechLastFinalText,
  error: speechError,
  permissionDenied: speechPermissionDenied,
  status: speechStatus,
  start: startSpeechRecognition,
  stop: stopSpeechRecognition,
  abort: abortSpeechRecognition,
} = useWebSpeechRecognition({
  getElapsedMs: () => sessionStore.getElapsedMs(),
  onFinalSegments: queueSpeechSegments,
  language: 'ru-RU',
  idPrefix: `web-${route.params.id}`,
});

const {
  supported: voskSupported,
  recording: voskRecording,
  starting: voskStarting,
  permissionDenied: voskPermissionDenied,
  error: voskError,
  mimeType: voskMimeType,
  status: voskStatus,
  start: startVoskRecording,
  stop: stopVoskRecording,
  abort: abortVoskRecording,
} = useVoskRecorder({
  getElapsedMs: () => sessionStore.getElapsedMs(),
  getAcceptedMimeTypes: () => sessionStore.capabilities?.engines?.vosk?.accepted_mime_types || [],
  onChunk: queueVoskChunk,
  chunkDurationMs: 10000,
});

const session = computed(() => sessionStore.currentSession);
const presentation = computed(() => sessionStore.selectedPresentation);
const slides = computed(() => presentation.value?.slides || []);
const activePosition = computed(() => {
  const position = slides.value.findIndex(slide => slide.slide_index === sessionStore.currentSlideIndex);
  return position >= 0 ? position : 0;
});
const activeSlide = computed(() => slides.value[activePosition.value] || null);
const timeLimitSeconds = computed(() => Number(session.value?.time_limit_sec) || 0);
const remainingSeconds = computed(() => timeLimitSeconds.value - elapsedSeconds.value);
const isOvertime = computed(() => remainingSeconds.value < 0);
const timeWarning = computed(() => !isOvertime.value && remainingSeconds.value <= 60);
const progressPercent = computed(() => {
  if (timeLimitSeconds.value <= 0) return 0;
  return Math.min(100, (elapsedSeconds.value / timeLimitSeconds.value) * 100);
});
const displayedTime = computed(() => formatDuration(Math.abs(remainingSeconds.value)));
const engineLabel = computed(() => session.value?.speech_engine === 'vosk' ? 'Vosk' : 'Web Speech');
const microphoneActive = computed(() => speechListening.value || voskRecording.value);
const syncText = computed(() => {
  if (syncError.value) return syncError.value;
  if (sessionStore.savingSlideChanges) return 'Сохраняем переключения...';
  if (sessionStore.pendingSlideChanges.length) return `Ожидают отправки: ${sessionStore.pendingSlideChanges.length}`;
  return 'Все переключения сохранены';
});
const syncIcon = computed(() => {
  if (syncError.value) return 'fa-solid fa-circle-exclamation';
  if (sessionStore.savingSlideChanges) return 'fa-solid fa-spinner fa-spin';
  if (sessionStore.pendingSlideChanges.length) return 'fa-solid fa-cloud-arrow-up';
  return 'fa-solid fa-cloud-circle-check';
});
const speechStatusText = computed(() => {
  if (!speechSupported.value) return 'Не поддерживается браузером';
  if (speechPermissionDenied.value) return 'Нет доступа к микрофону';
  if (speechRestarting.value) return 'Перезапуск распознавания...';
  if (speechListening.value) return 'Слушаем речь';
  return 'Микрофон выключен';
});
const speechStatusIcon = computed(() => {
  if (!speechSupported.value || speechPermissionDenied.value) return 'fa-solid fa-circle-exclamation';
  if (speechRestarting.value || sessionStore.sendingTranscripts) return 'fa-solid fa-spinner fa-spin';
  if (speechListening.value) return 'fa-solid fa-wave-square';
  return 'fa-solid fa-microphone-slash';
});
const speechSyncText = computed(() => {
  if (speechSyncError.value) return `Ошибка отправки: ${speechSyncError.value}`;
  if (sessionStore.sendingTranscripts) return 'Сохраняем распознанную речь...';
  if (pendingSpeechSegments.value.length) return `Ожидают отправки: ${pendingSpeechSegments.value.length}`;
  const count = sessionStore.transcriptSegments.length;
  return count ? `Сохранено сегментов: ${count}` : 'Финальные фразы ещё не получены';
});
const voskStatusText = computed(() => {
  if (!voskSupported.value) return 'MediaRecorder не поддерживается';
  if (voskPermissionDenied.value) return 'Нет доступа к микрофону';
  if (voskStarting.value) return 'Запрашиваем доступ к микрофону...';
  if (voskRecording.value) return 'Записываем аудио';
  return 'Микрофон выключен';
});
const voskStatusIcon = computed(() => {
  if (!voskSupported.value || voskPermissionDenied.value) return 'fa-solid fa-circle-exclamation';
  if (voskStarting.value || sessionStore.hasActiveAsrUploads) return 'fa-solid fa-spinner fa-spin';
  if (voskRecording.value) return 'fa-solid fa-wave-square';
  return 'fa-solid fa-microphone-slash';
});
const voskSyncText = computed(() => {
  if (voskSyncError.value) return `Ошибка отправки: ${voskSyncError.value}`;
  if (sessionStore.hasActiveAsrUploads) return 'Vosk распознаёт аудиочанк...';
  if (pendingVoskChunks.value.length) return `Ожидают обработки: ${pendingVoskChunks.value.length}`;
  const completed = sessionStore.asrChunks.filter(chunk => chunk.status === 'completed').length;
  const segments = sessionStore.transcriptSegments.length;
  if (completed) return `Обработано чанков: ${completed}, сегментов: ${segments}`;
  return 'Аудиочанки ещё не записаны';
});

async function loadRehearsal() {
  loading.value = true;
  const id = Number(route.params.id);
  if (!Number.isInteger(id) || id < 1) {
    loadError.value = 'Некорректный идентификатор сессии';
    loading.value = false;
    return;
  }

  const sessionResult = await sessionStore.fetchSession(id);
  if (!sessionResult.success) {
    loadError.value = sessionResult.message;
    loading.value = false;
    return;
  }
  if (session.value.status !== 'in_progress') {
    loadError.value = 'Эта сессия уже завершена';
    loading.value = false;
    return;
  }

  if (session.value.speech_engine === 'vosk') {
    const [capabilitiesResult, chunksResult] = await Promise.all([
      sessionStore.fetchCapabilities(),
      sessionStore.fetchAsrChunks(),
    ]);
    if (!capabilitiesResult.success) voskSyncError.value = capabilitiesResult.message;
    else if (!capabilitiesResult.capabilities?.engines?.vosk?.available) {
      voskSyncError.value = 'Vosk не настроен на Backend';
    }
    if (!chunksResult.success) voskSyncError.value = chunksResult.message;
  }

  if (!presentation.value || presentation.value.id !== session.value.presentation_id) {
    const loadedPresentation = await presentationStore.fetchPresentation(session.value.presentation_id);
    if (!loadedPresentation) {
      loadError.value = presentationStore.error || 'Не удалось загрузить презентацию';
      loading.value = false;
      return;
    }
    sessionStore.setSelectedPresentation(loadedPresentation);
  }
  if (slides.value.length === 0) {
    loadError.value = 'В презентации нет слайдов';
    loading.value = false;
    return;
  }

  const firstSlideIndex = slides.value[0].slide_index;
  const startResult = sessionStore.startRehearsal(firstSlideIndex);
  if (!startResult.success) {
    loadError.value = startResult.message;
    loading.value = false;
    return;
  }
  if (startResult.queued) await flushChanges();

  updateTimer();
  timerInterval = window.setInterval(updateTimer, 250);
  flushInterval = window.setInterval(flushPendingData, 5000);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  loading.value = false;
}

function updateTimer() {
  elapsedSeconds.value = Math.floor(sessionStore.getElapsedMs() / 1000);
}

function goToPosition(position) {
  const slide = slides.value[position];
  if (!slide || slide.slide_index === sessionStore.currentSlideIndex) return;
  const result = sessionStore.recordSlideChange(slide.slide_index);
  if (!result.success) {
    toastStore.notify(result.message, 'error');
    return;
  }
  syncError.value = '';
  scheduleFlush();
}

function previousSlide() {
  if (activePosition.value > 0) goToPosition(activePosition.value - 1);
}

function nextSlide() {
  if (activePosition.value < slides.value.length - 1) goToPosition(activePosition.value + 1);
}

function scheduleFlush() {
  window.clearTimeout(flushTimeout);
  flushTimeout = window.setTimeout(flushChanges, 800);
}

async function flushChanges() {
  if (!sessionStore.pendingSlideChanges.length) return true;
  const result = await sessionStore.flushSlideChanges();
  if (!result.success) {
    syncError.value = result.message;
    return false;
  }
  syncError.value = '';
  return true;
}

function queueSpeechSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0 || session.value?.speech_engine !== 'web') return;
  pendingSpeechSegments.value.push(...segments);
  speechSyncError.value = '';
  window.clearTimeout(speechFlushTimeout);
  speechFlushTimeout = window.setTimeout(flushSpeechSegments, 700);
}

async function flushSpeechSegments() {
  if (session.value?.speech_engine !== 'web' || pendingSpeechSegments.value.length === 0) return true;
  if (speechFlushPromise) {
    const activeResult = await speechFlushPromise;
    if (!activeResult || pendingSpeechSegments.value.length === 0) return activeResult;
    return flushSpeechSegments();
  }

  const batch = pendingSpeechSegments.value.slice(0, 50);
  speechFlushPromise = (async () => {
    const result = await sessionStore.sendWebTranscripts(batch);
    if (!result.success) {
      speechSyncError.value = result.message;
      scheduleSpeechRetry();
      return false;
    }
    pendingSpeechSegments.value.splice(0, batch.length);
    speechSyncError.value = '';
    return true;
  })();

  const success = await speechFlushPromise;
  speechFlushPromise = null;
  if (success && pendingSpeechSegments.value.length > 0) return flushSpeechSegments();
  return success;
}

function scheduleSpeechRetry() {
  window.clearTimeout(speechRetryTimeout);
  if (!sessionStore.isInProgress) return;
  speechRetryTimeout = window.setTimeout(flushSpeechSegments, 3000);
}

function createVoskChunkId(offsetMs, sequence) {
  const random = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
    || Math.random().toString(36).slice(2);
  return `v${session.value?.id || route.params.id}_${offsetMs}_${sequence}_${random}`.slice(0, 80);
}

function queueVoskChunk({ blob, offsetMs, durationMs, sequence }) {
  if (session.value?.speech_engine !== 'vosk' || !blob?.size) return;
  const maxBytes = Number(sessionStore.capabilities?.engines?.vosk?.max_chunk_bytes) || 10 * 1024 * 1024;
  if (blob.size > maxBytes) {
    voskSyncError.value = `Аудиочанк превышает лимит ${Math.round(maxBytes / 1024 / 1024)} МБ`;
    return;
  }
  pendingVoskChunks.value.push({
    audio: blob,
    chunkId: createVoskChunkId(offsetMs, sequence),
    offsetMs: Math.max(0, Math.round(offsetMs)),
    durationMs,
  });
  voskSyncError.value = '';
  void flushVoskChunks();
}

async function flushVoskChunks() {
  if (session.value?.speech_engine !== 'vosk' || pendingVoskChunks.value.length === 0) return true;
  if (Date.now() < nextVoskRetryAt) return false;
  if (voskFlushPromise) {
    const activeResult = await voskFlushPromise;
    if (!activeResult || pendingVoskChunks.value.length === 0) return activeResult;
    return flushVoskChunks();
  }

  const chunk = pendingVoskChunks.value[0];
  voskFlushPromise = (async () => {
    const result = await sessionStore.uploadVoskChunk(chunk);
    if (!result.success) {
      voskSyncError.value = result.message;
      scheduleVoskRetry(result.status);
      return false;
    }
    if (pendingVoskChunks.value[0]?.chunkId === chunk.chunkId) {
      pendingVoskChunks.value.shift();
    }
    voskRetryAttempts = 0;
    nextVoskRetryAt = 0;
    voskSyncError.value = '';
    return true;
  })();

  const success = await voskFlushPromise;
  voskFlushPromise = null;
  if (success && pendingVoskChunks.value.length > 0) return flushVoskChunks();
  return success;
}

function scheduleVoskRetry(status) {
  window.clearTimeout(voskRetryTimeout);
  if (!sessionStore.isInProgress) return;
  voskRetryAttempts += 1;
  const retryable = status === null || status === 408 || status === 425 || status === 429 || status >= 500;
  if (!retryable) {
    nextVoskRetryAt = Number.POSITIVE_INFINITY;
    return;
  }

  // A missing/unavailable Vosk service must not generate a request storm.
  const delay = Math.min(60000, 3000 * (2 ** Math.min(voskRetryAttempts - 1, 5)));
  nextVoskRetryAt = Date.now() + delay;
  voskRetryTimeout = window.setTimeout(flushVoskChunks, delay);
}

async function flushPendingData() {
  const [slidesSaved, speechSaved, voskSaved] = await Promise.all([
    flushChanges(),
    flushSpeechSegments(),
    flushVoskChunks(),
  ]);
  return slidesSaved && speechSaved && voskSaved;
}

async function toggleSpeech() {
  if (speechListening.value || speechRestarting.value) {
    await stopSpeechRecognition();
    await flushSpeechSegments();
    return;
  }
  if (!startSpeechRecognition()) {
    toastStore.notify(speechError.value || 'Не удалось включить микрофон.', 'error');
  }
}

async function toggleVosk() {
  if (voskRecording.value || voskStarting.value) {
    await stopVoskRecording();
    await flushVoskChunks();
    return;
  }
  const available = sessionStore.capabilities?.engines?.vosk?.available;
  if (!available) {
    toastStore.notify(voskSyncError.value || 'Vosk не настроен на Backend.', 'error');
    return;
  }
  if (!await startVoskRecording()) {
    toastStore.notify(voskError.value || 'Не удалось включить запись Vosk.', 'error');
  }
}

async function stopActiveRecognition() {
  if (session.value?.speech_engine === 'vosk') await stopVoskRecording();
  else await stopSpeechRecognition();
}

async function finishSession() {
  if (!window.confirm('Завершить репетицию и запустить анализ?')) return;
  await stopActiveRecognition();
  const recognitionSaved = session.value?.speech_engine === 'vosk'
    ? await flushVoskChunks()
    : await flushSpeechSegments();
  if (!recognitionSaved) {
    toastStore.notify('Не удалось сохранить запись речи. Повторите завершение после восстановления сети.', 'error');
    return;
  }
  const result = await sessionStore.completeSession();
  if (!result.success) {
    toastStore.notify(result.message, 'error');
    return;
  }
  allowLeave = true;
  toastStore.notify('Репетиция завершена и отправлена на анализ.', 'success');
  router.replace({ name: 'SessionResults', params: { id: sessionStore.sessionId } });
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await rehearsalRoot.value?.requestFullscreen();
  } catch {
    toastStore.notify('Браузер не разрешил полноэкранный режим.', 'warning');
  }
}

function handleFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === rehearsalRoot.value;
}

function handleKeydown(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    nextSlide();
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    previousSlide();
  } else if (event.key === 'Home') {
    event.preventDefault();
    goToPosition(0);
  } else if (event.key === 'End') {
    event.preventDefault();
    goToPosition(slides.value.length - 1);
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleFullscreen();
  }
}

function handleBeforeUnload(event) {
  if (!sessionStore.isInProgress) return;
  event.preventDefault();
  event.returnValue = '';
}

function leaveToDashboard() {
  allowLeave = true;
  router.push('/dashboard');
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function truncate(text, limit) {
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

onBeforeRouteLeave(async () => {
  if (allowLeave || !sessionStore.isInProgress) return true;
  if (!window.confirm('Репетиция ещё не завершена. Покинуть экран?')) return false;
  await stopActiveRecognition();
  const saved = await flushPendingData();
  if (!saved) {
    toastStore.notify('Выход отменён: не удалось сохранить данные репетиции.', 'error');
    return false;
  }
  return true;
});

onMounted(loadRehearsal);
onBeforeUnmount(() => {
  window.clearInterval(timerInterval);
  window.clearInterval(flushInterval);
  window.clearTimeout(flushTimeout);
  window.clearTimeout(speechFlushTimeout);
  window.clearTimeout(speechRetryTimeout);
  window.clearTimeout(voskRetryTimeout);
  abortSpeechRecognition();
  abortVoskRecording();
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
});
</script>

<style scoped>
.rehearsal-page { min-height: calc(100vh - 64px); padding: 20px 24px 28px; background: var(--color-bg); }
.rehearsal-page--fullscreen { min-height: 100vh; padding: 16px; overflow: auto; }
.rehearsal-page__loading { display: grid; place-items: center; min-height: 60vh; }
.rehearsal-page__error-card { width: min(700px, 100%); margin: 40px auto; }
.rehearsal-page__state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 36px; text-align: center; }
.rehearsal-page__state > i { color: var(--color-error); font-size: 3rem; }
.rehearsal-page__state h1 { font-size: var(--text-xl); }
.rehearsal-page__state p { color: var(--color-text-muted); }
.rehearsal-page__header { display: grid; grid-template-columns: 1fr auto auto; gap: 20px; align-items: center; max-width: 1500px; margin: 0 auto 12px; }
.rehearsal-page__identity { display: flex; align-items: center; gap: 14px; min-width: 0; }
.rehearsal-page__identity h1 { overflow: hidden; font-family: var(--font-body); font-size: var(--text-lg); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.rehearsal-page__identity p { margin-top: 2px; color: var(--color-text-muted); font-size: var(--text-xs); }
.rehearsal-page__live { display: flex; align-items: center; gap: 6px; padding: 7px 10px; color: var(--color-text-muted); background: var(--color-surface-hover); border-radius: 20px; font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; white-space: nowrap; }
.rehearsal-page__live i { font-size: 0.45rem; }
.rehearsal-page__live--active { color: var(--color-error); background: rgba(194, 106, 106, 0.1); }
.rehearsal-page__live--active i { animation: pulse 1.8s infinite; }
.rehearsal-page__time { display: flex; align-items: baseline; gap: 8px; min-width: 180px; padding: 9px 14px; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.rehearsal-page__time span { color: var(--color-text-muted); font-size: var(--text-xs); }
.rehearsal-page__time strong { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-xl); }
.rehearsal-page__time--warning { color: var(--color-warning); border-color: var(--color-warning); }
.rehearsal-page__time--overtime { color: var(--color-error); border-color: var(--color-error); }
.rehearsal-page__header-actions { display: flex; gap: 8px; align-items: center; }
.rehearsal-page__icon-button { display: grid; place-items: center; width: 44px; height: 44px; color: var(--color-text-muted); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.rehearsal-page__icon-button:hover { color: var(--color-accent); border-color: var(--color-accent); }
.rehearsal-page__progress { max-width: 1500px; height: 4px; overflow: hidden; margin: 0 auto 16px; background: var(--color-border); border-radius: 10px; }
.rehearsal-page__progress span { display: block; height: 100%; background: var(--color-accent); transition: width 0.4s linear, background 0.2s; }
.rehearsal-page__progress .rehearsal-page__progress-fill--overtime { background: var(--color-error); }
.rehearsal-page__workspace { display: grid; grid-template-columns: 190px minmax(0, 1fr) 230px; gap: 18px; align-items: start; max-width: 1500px; margin: 0 auto; }
.rehearsal-page__slides { display: flex; flex-direction: column; gap: 7px; max-height: calc(100vh - 170px); padding-right: 4px; overflow-y: auto; }
.rehearsal-page__thumbnail { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 8px; align-items: center; width: 100%; padding: 10px; color: var(--color-text-muted); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); text-align: left; }
.rehearsal-page__thumbnail > span { color: var(--color-accent); font-size: var(--text-xs); font-weight: 700; text-align: center; }
.rehearsal-page__thumbnail p { overflow: hidden; font-size: var(--text-xs); text-overflow: ellipsis; white-space: nowrap; }
.rehearsal-page__thumbnail:hover { border-color: var(--color-accent); }
.rehearsal-page__thumbnail--active { color: var(--color-text); background: var(--color-accent-light); border-color: var(--color-accent); box-shadow: inset 3px 0 var(--color-accent); }
.rehearsal-page__stage { min-width: 0; }
.rehearsal-page__controls { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; margin-top: 14px; }
.rehearsal-page__controls > :last-child { justify-self: end; }
.rehearsal-page__counter { display: flex; align-items: baseline; gap: 4px; color: var(--color-text-muted); font-family: var(--font-mono); }
.rehearsal-page__counter strong { color: var(--color-text); font-size: var(--text-lg); }
.rehearsal-page__status-panel { display: flex; flex-direction: column; gap: 12px; }
.rehearsal-page__status-block, .rehearsal-page__shortcuts { padding: 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.rehearsal-page__status-block { display: flex; flex-direction: column; gap: 7px; }
.rehearsal-page__status-label { color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.rehearsal-page__status-block p { color: var(--color-text-muted); font-size: var(--text-xs); line-height: 1.5; }
.rehearsal-page__sync { display: flex; align-items: flex-start; gap: 7px; color: var(--color-success); font-size: var(--text-xs); line-height: 1.4; }
.rehearsal-page__sync--busy { color: var(--color-accent); }
.rehearsal-page__sync--error { color: var(--color-error); }
.rehearsal-page__speech-state { display: flex; align-items: center; gap: 7px; color: var(--color-text-muted); font-size: var(--text-xs); }
.rehearsal-page__speech-state--listening { color: var(--color-success); }
.rehearsal-page__speech-state--recording { color: var(--color-success); }
.rehearsal-page__speech-state--restarting,
.rehearsal-page__speech-state--starting { color: var(--color-accent); }
.rehearsal-page__speech-state--unsupported,
.rehearsal-page__speech-state--denied { color: var(--color-error); }
.rehearsal-page__microphone { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; padding: 9px 10px; color: var(--color-accent); background: var(--color-accent-light); border: 1px solid var(--color-accent); border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: 600; }
.rehearsal-page__microphone:hover:not(:disabled) { color: var(--color-text-inverse); background: var(--color-accent); }
.rehearsal-page__microphone--active { color: #fff; background: var(--color-error); border-color: var(--color-error); }
.rehearsal-page__microphone--active:hover:not(:disabled) { background: var(--color-error); }
.rehearsal-page__microphone:disabled { cursor: not-allowed; opacity: 0.55; }
.rehearsal-page__interim { padding: 8px; color: var(--color-text) !important; background: var(--color-accent-light); border-radius: var(--radius-sm); font-style: italic; }
.rehearsal-page__last-final { color: var(--color-text) !important; }
.rehearsal-page__speech-error { color: var(--color-error) !important; }
.rehearsal-page__shortcuts { display: flex; flex-direction: column; gap: 8px; color: var(--color-text-muted); font-size: var(--text-xs); }
.rehearsal-page__shortcuts span { display: flex; align-items: center; gap: 4px; }
.rehearsal-page__shortcuts kbd { min-width: 22px; padding: 3px 5px; color: var(--color-text); background: var(--color-surface-hover); border: 1px solid var(--color-border); border-radius: 4px; font-family: var(--font-mono); text-align: center; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@media (max-width: 1100px) {
  .rehearsal-page__workspace { grid-template-columns: 150px minmax(0, 1fr); }
  .rehearsal-page__status-panel { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); }
  .rehearsal-page__shortcuts { display: none; }
}
@media (max-width: 760px) {
  .rehearsal-page { padding: 14px 12px 24px; }
  .rehearsal-page__header { grid-template-columns: 1fr auto; }
  .rehearsal-page__identity { grid-column: 1 / -1; }
  .rehearsal-page__live { display: none; }
  .rehearsal-page__time { min-width: 160px; }
  .rehearsal-page__header-actions :deep(.base-button) { padding-inline: 12px; }
  .rehearsal-page__workspace { grid-template-columns: 1fr; }
  .rehearsal-page__slides { flex-direction: row; max-height: none; padding: 0 0 4px; overflow-x: auto; }
  .rehearsal-page__thumbnail { flex: 0 0 58px; display: block; text-align: center; }
  .rehearsal-page__thumbnail p { display: none; }
  .rehearsal-page__status-panel { grid-column: auto; grid-template-columns: 1fr; }
  .rehearsal-page__controls :deep(.base-button) { min-width: 44px; padding-inline: 12px; font-size: 0; }
  .rehearsal-page__controls :deep(.base-button i) { font-size: var(--text-base); }
}
</style>
