<template>
  <div class="session-setup">
    <div class="session-setup__header">
      <button class="session-setup__back" type="button" @click="router.back()">
        <i class="fa-solid fa-arrow-left"></i>
        Назад
      </button>
      <div>
        <h1>Новая репетиция</h1>
        <p>Выберите презентацию, регламент и способ распознавания речи.</p>
      </div>
    </div>

    <BaseSpinner
      v-if="initialLoading"
      text="Подготовка параметров репетиции..."
    />

    <BaseCard v-else-if="presentationStore.error && presentations.length === 0">
      <div class="session-setup__state session-setup__state--error" role="alert">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h2>Не удалось загрузить презентации</h2>
        <p>{{ presentationStore.error }}</p>
        <BaseButton variant="secondary" @click="loadInitialData">Повторить</BaseButton>
      </div>
    </BaseCard>

    <BaseCard v-else-if="presentations.length === 0">
      <div class="session-setup__state">
        <i class="fa-solid fa-file-circle-plus"></i>
        <h2>Сначала загрузите презентацию</h2>
        <p>Для репетиции требуется PPTX или PDF с подготовленными слайдами.</p>
        <BaseButton
          variant="primary"
          icon="fa-solid fa-upload"
          @click="router.push('/presentations/upload')"
        >
          Загрузить презентацию
        </BaseButton>
      </div>
    </BaseCard>

    <form v-else class="session-setup__form" @submit.prevent="handleSubmit">
      <BaseCard>
        <section class="session-setup__section">
          <div class="session-setup__section-heading">
            <span class="session-setup__step">1</span>
            <div>
              <h2>Презентация</h2>
              <p>Тезисы выбранных слайдов будут использоваться при анализе.</p>
            </div>
          </div>

          <label class="session-setup__label" for="session-presentation">Выберите презентацию</label>
          <select
            id="session-presentation"
            v-model="selectedPresentationId"
            class="session-setup__select"
            :class="{ 'session-setup__select--error': errors.presentation }"
          >
            <option value="" disabled>Не выбрана</option>
            <option v-for="presentation in presentations" :key="presentation.id" :value="String(presentation.id)">
              {{ presentation.title }} — {{ presentation.slide_count }} слайдов
            </option>
          </select>
          <p v-if="errors.presentation" class="session-setup__field-error">{{ errors.presentation }}</p>

          <div v-if="selectedPresentation" class="session-setup__presentation-preview">
            <i class="fa-solid fa-file-powerpoint"></i>
            <div>
              <strong>{{ selectedPresentation.title }}</strong>
              <span>{{ selectedPresentation.slide_count }} слайдов</span>
            </div>
          </div>
        </section>
      </BaseCard>

      <BaseCard>
        <section class="session-setup__section">
          <div class="session-setup__section-heading">
            <span class="session-setup__step">2</span>
            <div>
              <h2>Регламент</h2>
              <p>Допустимое значение — от 1 до 30 минут.</p>
            </div>
          </div>

          <div class="session-setup__time-row">
            <label v-for="minutes in quickTimes" :key="minutes" class="session-setup__time-option">
              <input v-model.number="timeLimitMinutes" type="radio" :value="minutes" />
              <span>{{ minutes }} мин</span>
            </label>
            <label class="session-setup__custom-time">
              <span>Своё значение</span>
              <input v-model.number="timeLimitMinutes" type="number" min="1" max="30" step="1" />
              <span>мин</span>
            </label>
          </div>
          <p v-if="errors.time" class="session-setup__field-error">{{ errors.time }}</p>
        </section>
      </BaseCard>

      <BaseCard>
        <section class="session-setup__section">
          <div class="session-setup__section-heading">
            <span class="session-setup__step">3</span>
            <div>
              <h2>Распознавание речи</h2>
              <p>Движок нельзя изменить после создания сессии.</p>
            </div>
          </div>

          <div class="session-setup__engines">
            <label class="session-setup__engine" :class="{ 'session-setup__engine--active': speechEngine === 'web' }">
              <input v-model="speechEngine" type="radio" value="web" />
              <i class="fa-solid fa-globe"></i>
              <div>
                <strong>Web Speech</strong>
                <span>Распознавание средствами поддерживаемого браузера.</span>
              </div>
              <span class="session-setup__availability session-setup__availability--ok">Доступно</span>
            </label>

            <label
              class="session-setup__engine"
              :class="{
                'session-setup__engine--active': speechEngine === 'vosk',
                'session-setup__engine--disabled': !voskAvailable,
              }"
            >
              <input v-model="speechEngine" type="radio" value="vosk" :disabled="!voskAvailable" />
              <i class="fa-solid fa-server"></i>
              <div>
                <strong>Vosk</strong>
                <span>Офлайн-модель на отдельном сервере распознавания.</span>
              </div>
              <span class="session-setup__availability" :class="{ 'session-setup__availability--ok': voskAvailable }">
                {{ voskInDevelopment ? 'В разработке' : (voskAvailable ? 'Доступно' : 'Недоступно') }}
              </span>
            </label>
          </div>
        </section>
      </BaseCard>

      <div v-if="submitError" class="session-setup__submit-error" role="alert">
        <i class="fa-solid fa-circle-exclamation"></i>
        {{ submitError }}
      </div>

      <div class="session-setup__actions">
        <p>
          После нажатия начнётся отсчёт времени сессии.
        </p>
        <BaseButton
          type="submit"
          variant="primary"
          icon="fa-solid fa-play"
          :loading="sessionStore.creating"
          :disabled="!canSubmit"
        >
          Создать и начать
        </BaseButton>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { usePresentationStore } from '@/stores/presentation.store';
import { useSessionStore } from '@/stores/session.store';
import { useToastStore } from '@/stores/toast.store';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const presentationStore = usePresentationStore();
const sessionStore = useSessionStore();
const toastStore = useToastStore();

const selectedPresentationId = ref('');
const timeLimitMinutes = ref(7);
const speechEngine = ref('web');
const initialLoading = ref(true);
const submitError = ref('');
const errors = reactive({ presentation: '', time: '' });
const quickTimes = [5, 7, 10, 15];

const presentations = computed(() => presentationStore.presentations);
const selectedPresentation = computed(() => presentations.value.find(
  presentation => String(presentation.id) === selectedPresentationId.value
));
const voskAvailable = computed(() => Boolean(sessionStore.capabilities?.engines?.vosk?.available));
const voskInDevelopment = computed(() => sessionStore.capabilities?.engines?.vosk?.status === 'development');
const canSubmit = computed(() => Boolean(
  selectedPresentation.value &&
  Number.isInteger(Number(timeLimitMinutes.value)) &&
  Number(timeLimitMinutes.value) >= 1 &&
  Number(timeLimitMinutes.value) <= 30 &&
  (speechEngine.value === 'web' || voskAvailable.value)
));

async function loadInitialData() {
  initialLoading.value = true;
  await Promise.all([
    presentationStore.fetchPresentations(),
    sessionStore.fetchCapabilities(),
  ]);

  const requestedId = String(route.query.presentationId || '');
  if (requestedId && presentations.value.some(item => String(item.id) === requestedId)) {
    selectedPresentationId.value = requestedId;
  } else if (presentations.value.length === 1) {
    selectedPresentationId.value = String(presentations.value[0].id);
  }

  const defaultSeconds = Number(authStore.user?.default_time_limit);
  if (Number.isInteger(defaultSeconds) && defaultSeconds >= 60 && defaultSeconds <= 1800) {
    timeLimitMinutes.value = Math.round(defaultSeconds / 60);
  }
  if (authStore.user?.prefer_offline_asr && voskAvailable.value) {
    speechEngine.value = 'vosk';
  }
  initialLoading.value = false;
}

function validate() {
  errors.presentation = selectedPresentation.value ? '' : 'Выберите презентацию';
  const minutes = Number(timeLimitMinutes.value);
  errors.time = Number.isInteger(minutes) && minutes >= 1 && minutes <= 30
    ? ''
    : 'Укажите целое количество минут от 1 до 30';
  return !errors.presentation && !errors.time;
}

async function handleSubmit() {
  submitError.value = '';
  if (!validate() || !canSubmit.value) return;

  const presentation = await presentationStore.fetchPresentation(selectedPresentation.value.id);
  if (!presentation) {
    submitError.value = presentationStore.error || 'Не удалось подготовить презентацию';
    return;
  }

  const result = await sessionStore.createSession({
    presentationId: presentation.id,
    presentation,
    timeLimitSec: Number(timeLimitMinutes.value) * 60,
    speechEngine: speechEngine.value,
  });

  if (!result.success) {
    submitError.value = result.message;
    return;
  }

  toastStore.notify('Сессия создана. Таймер запущен.', 'success');
  router.replace({ name: 'SessionRehearsal', params: { id: result.session.id } });
}

onMounted(loadInitialData);
</script>

<style scoped>
.session-setup {
  width: min(900px, calc(100% - 48px));
  margin: 0 auto;
  padding: 32px 0 56px;
}
.session-setup__header { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
.session-setup__header h1 { font-size: var(--text-2xl); }
.session-setup__header p { margin-top: 5px; color: var(--color-text-muted); }
.session-setup__back { display: flex; align-items: center; gap: 6px; padding: 8px 10px; color: var(--color-text-muted); border-radius: var(--radius-md); margin-top: 2px; }
.session-setup__back:hover { color: var(--color-text); background: var(--color-surface-hover); }
.session-setup__form { display: flex; flex-direction: column; gap: 18px; }
.session-setup__section { display: flex; flex-direction: column; gap: 18px; }
.session-setup__section-heading { display: flex; gap: 14px; align-items: flex-start; }
.session-setup__section-heading h2 { font-family: var(--font-body); font-size: var(--text-lg); font-weight: 600; }
.session-setup__section-heading p { color: var(--color-text-muted); font-size: var(--text-sm); margin-top: 3px; }
.session-setup__step { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 30px; color: var(--color-text-inverse); background: var(--color-accent); border-radius: 50%; font-weight: 700; }
.session-setup__label { font-size: var(--text-sm); font-weight: 600; }
.session-setup__select { width: 100%; padding: 12px 14px; color: var(--color-text); background: var(--color-input-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-base); }
.session-setup__select:focus { outline: none; border-color: var(--color-input-focus); box-shadow: 0 0 0 3px var(--color-accent-light); }
.session-setup__select--error { border-color: var(--color-error); }
.session-setup__field-error { color: var(--color-error); font-size: var(--text-xs); }
.session-setup__presentation-preview { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--color-accent-light); border-radius: var(--radius-md); }
.session-setup__presentation-preview i { color: var(--color-accent); font-size: 1.5rem; }
.session-setup__presentation-preview div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.session-setup__presentation-preview strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-setup__presentation-preview span { color: var(--color-text-muted); font-size: var(--text-sm); }
.session-setup__time-row { display: flex; gap: 10px; flex-wrap: wrap; }
.session-setup__time-option input, .session-setup__engine input { position: absolute; opacity: 0; pointer-events: none; }
.session-setup__time-option span { display: block; padding: 10px 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; }
.session-setup__time-option input:checked + span { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-accent-light); font-weight: 600; }
.session-setup__custom-time { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-muted); font-size: var(--text-sm); }
.session-setup__custom-time input { width: 58px; padding: 4px 6px; color: var(--color-text); background: var(--color-input-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.session-setup__engines { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.session-setup__engine { position: relative; display: grid; grid-template-columns: auto 1fr; gap: 10px 12px; padding: 16px; border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; }
.session-setup__engine > i { grid-row: 1 / 3; color: var(--color-accent); font-size: 1.35rem; margin-top: 2px; }
.session-setup__engine div { display: flex; flex-direction: column; gap: 4px; }
.session-setup__engine div span { color: var(--color-text-muted); font-size: var(--text-sm); line-height: 1.4; }
.session-setup__engine--active { border-color: var(--color-accent); background: var(--color-accent-light); box-shadow: 0 0 0 1px var(--color-accent); }
.session-setup__engine--disabled { opacity: 0.55; cursor: not-allowed; }
.session-setup__availability { grid-column: 2; width: fit-content; padding: 3px 8px; color: var(--color-text-muted); background: var(--color-surface-hover); border-radius: 20px; font-size: var(--text-xs); }
.session-setup__availability--ok { color: var(--color-success); background: rgba(74, 124, 89, 0.1); }
.session-setup__submit-error { display: flex; gap: 9px; align-items: center; padding: 12px 16px; color: var(--color-error); background: rgba(194, 106, 106, 0.08); border-radius: var(--radius-md); }
.session-setup__actions { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
.session-setup__actions p { color: var(--color-text-muted); font-size: var(--text-sm); }
.session-setup__state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 32px; }
.session-setup__state > i { color: var(--color-accent); font-size: 3rem; }
.session-setup__state h2 { font-family: var(--font-body); font-size: var(--text-lg); }
.session-setup__state p { color: var(--color-text-muted); }
.session-setup__state--error > i { color: var(--color-error); }
@media (max-width: 700px) {
  .session-setup { width: min(100% - 32px, 900px); padding-top: 20px; }
  .session-setup__engines { grid-template-columns: 1fr; }
  .session-setup__actions { align-items: stretch; flex-direction: column; }
  .session-setup__actions :deep(.base-button) { width: 100%; }
}
</style>
