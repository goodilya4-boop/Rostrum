<template>
  <div class="results-page">
    <div v-if="sessionStore.loading && !session" class="results-page__loading">
      <BaseSpinner text="Загрузка результатов..." />
    </div>

    <BaseCard v-else-if="loadError" class="results-page__state-card">
      <div class="results-page__state" role="alert">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h1>Не удалось загрузить результаты</h1>
        <p>{{ loadError }}</p>
        <div class="results-page__state-actions">
          <BaseButton icon="fa-solid fa-rotate-right" @click="loadResults">Повторить</BaseButton>
          <BaseButton variant="ghost" @click="router.push('/dashboard')">На дашборд</BaseButton>
        </div>
      </div>
    </BaseCard>

    <BaseCard v-else-if="session?.status !== 'completed'" class="results-page__state-card">
      <div class="results-page__state">
        <i class="fa-solid fa-hourglass-half"></i>
        <h1>Репетиция ещё не завершена</h1>
        <p>Отчёт появится после завершения сессии и анализа речи.</p>
        <BaseButton icon="fa-solid fa-play" @click="router.push(`/session/${sessionId}/rehearsal`)">
          Вернуться к репетиции
        </BaseButton>
      </div>
    </BaseCard>

    <template v-else>
      <header class="results-page__header">
        <div>
          <button class="results-page__back" type="button" @click="router.push('/dashboard')">
            <i class="fa-solid fa-arrow-left"></i>
            Дашборд
          </button>
          <p class="results-page__eyebrow">Результаты репетиции</p>
          <h1>{{ presentationTitle }}</h1>
          <p class="results-page__meta">
            {{ formatDate(session.start_time) }}
            <span aria-hidden="true">•</span>
            {{ speechEngineLabel }}
            <span v-if="summary?.analysis_version" aria-hidden="true">•</span>
            <span v-if="summary?.analysis_version">анализ {{ summary.analysis_version }}</span>
          </p>
        </div>
        <div class="results-page__actions">
          <BaseButton
            variant="secondary"
            icon="fa-solid fa-rotate"
            :loading="sessionStore.reanalyzing"
            @click="reanalyze"
          >
            Повторить анализ
          </BaseButton>
          <BaseButton icon="fa-solid fa-microphone" @click="startNewSession">
            Новая репетиция
          </BaseButton>
        </div>
      </header>

      <div v-if="isAnalysisPending" class="results-page__notice results-page__notice--warning">
        <i class="fa-solid fa-clock"></i>
        <div>
          <strong>Анализ ещё не выполнен</strong>
          <p>Повторите анализ, чтобы получить метрики и рекомендации.</p>
        </div>
      </div>

      <div v-else-if="isInsufficient" class="results-page__notice">
        <i class="fa-solid fa-circle-info"></i>
        <div>
          <strong>Недостаточно данных для полного анализа</strong>
          <p>{{ suggestions[0] || 'Во время репетиции не удалось получить распознанную речь.' }}</p>
        </div>
      </div>

      <section class="results-page__metrics" aria-label="Основные показатели">
        <article class="metric-card">
          <div class="metric-card__icon metric-card__icon--coverage"><i class="fa-solid fa-bullseye"></i></div>
          <div>
            <p>Покрытие тезисов</p>
            <strong>{{ formatPercent(summary?.overall_coverage) }}</strong>
            <span>{{ coverageHint }}</span>
          </div>
        </article>
        <article class="metric-card">
          <div class="metric-card__icon metric-card__icon--time"><i class="fa-solid fa-stopwatch"></i></div>
          <div>
            <p>Время</p>
            <strong>{{ formatDuration(session.duration_sec) }}</strong>
            <span>{{ timingHint }}</span>
          </div>
        </article>
        <article class="metric-card">
          <div class="metric-card__icon metric-card__icon--pace"><i class="fa-solid fa-gauge-high"></i></div>
          <div>
            <p>Темп речи</p>
            <strong>{{ formatNumber(summary?.speech_rate_wpm) }}</strong>
            <span>слов в минуту</span>
          </div>
        </article>
        <article class="metric-card">
          <div class="metric-card__icon metric-card__icon--filler"><i class="fa-solid fa-comment-slash"></i></div>
          <div>
            <p>Слова-паразиты</p>
            <strong>{{ formatNumber(summary?.filler_word_count) }}</strong>
            <span>{{ fillerHint }}</span>
          </div>
        </article>
      </section>

      <div class="results-page__overview">
        <BaseCard>
          <template #header>
            <h2 class="results-page__section-title"><i class="fa-solid fa-lightbulb"></i> Рекомендации</h2>
          </template>
          <ol v-if="suggestions.length" class="results-page__suggestions">
            <li v-for="(suggestion, index) in suggestions" :key="`${index}-${suggestion}`">
              <span>{{ index + 1 }}</span>
              <p>{{ suggestion }}</p>
            </li>
          </ol>
          <p v-else class="results-page__empty">Рекомендации пока не сформированы.</p>
        </BaseCard>

        <BaseCard>
          <template #header>
            <h2 class="results-page__section-title"><i class="fa-solid fa-chart-simple"></i> Профиль выступления</h2>
          </template>
          <div class="results-page__radar">
            <BaseProgress
              v-for="metric in profileMetrics"
              :key="metric.key"
              :label="metric.label"
              :percent="metric.percent"
              :color="metric.color"
            />
          </div>
        </BaseCard>
      </div>

      <section class="results-page__slides">
        <div class="results-page__section-heading">
          <div>
            <h2>Разбор по слайдам</h2>
            <p>{{ feedback.length ? `Проанализировано слайдов: ${feedback.length}` : 'Постраничный анализ отсутствует' }}</p>
          </div>
        </div>

        <div v-if="feedback.length" class="results-page__slide-list">
          <details
            v-for="item in feedback"
            :key="item.slide_index"
            class="slide-result"
            :open="item.slide_index === feedback[0]?.slide_index"
          >
            <summary>
              <span class="slide-result__number">{{ item.slide_index }}</span>
              <div class="slide-result__summary">
                <strong>Слайд {{ item.slide_index }}</strong>
                <span>{{ slideSummary(item) }}</span>
              </div>
              <div class="slide-result__score" :class="scoreClass(item.coverage_score)">
                {{ formatPercent(item.coverage_score) }}
              </div>
              <i class="fa-solid fa-chevron-down slide-result__chevron"></i>
            </summary>
            <div class="slide-result__body">
              <div class="slide-result__phrases">
                <h3><i class="fa-solid fa-circle-check"></i> Озвученные тезисы</h3>
                <ul v-if="asList(item.matched_phrases).length">
                  <li v-for="phrase in asList(item.matched_phrases)" :key="phrase">{{ phrase }}</li>
                </ul>
                <p v-else>Совпадений не найдено.</p>
              </div>
              <div class="slide-result__phrases slide-result__phrases--missed">
                <h3><i class="fa-solid fa-circle-exclamation"></i> Пропущенные тезисы</h3>
                <ul v-if="asList(item.missed_phrases).length">
                  <li v-for="phrase in asList(item.missed_phrases)" :key="phrase">{{ phrase }}</li>
                </ul>
                <p v-else>Все заданные тезисы озвучены.</p>
              </div>
              <div v-if="asList(item.spoken_keywords).length" class="slide-result__keywords">
                <h3>Ключевые слова речи</h3>
                <div>
                  <span v-for="keyword in asList(item.spoken_keywords).slice(0, 20)" :key="keyword">{{ keyword }}</span>
                </div>
              </div>
            </div>
          </details>
        </div>
        <BaseCard v-else>
          <p class="results-page__empty">Нет данных для разбора слайдов. Проверьте распознавание речи и ключевые тезисы презентации.</p>
        </BaseCard>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session.store';
import { useToastStore } from '@/stores/toast.store';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseProgress from '@/components/ui/BaseProgress.vue';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';

const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();
const toastStore = useToastStore();

const sessionId = computed(() => Number(route.params.id));
const session = computed(() => sessionStore.currentSession);
const summary = computed(() => sessionStore.summary);
const feedback = computed(() => sessionStore.feedback);
const report = computed(() => sessionStore.report);
const loadError = computed(() => (
  !session.value || Number(session.value.id) !== sessionId.value
    ? sessionStore.error
    : ''
));
const suggestions = computed(() => asList(summary.value?.suggestions));
const analysisStatus = computed(() => summary.value?.analysis_status || sessionStore.analysisStatus);
const isAnalysisPending = computed(() => !summary.value || analysisStatus.value === 'pending');
const isInsufficient = computed(() => analysisStatus.value === 'insufficient_data');
const presentationTitle = computed(() => report.value[0]?.presentation_title || `Сессия №${sessionId.value}`);
const speechEngineLabel = computed(() => session.value?.speech_engine === 'vosk' ? 'Vosk' : 'Web Speech');

const profileMetrics = computed(() => {
  const radar = summary.value?.radar_data || {};
  return [
    { key: 'coverage', label: 'Содержание', percent: toPercent(radar.coverage), color: progressColor(radar.coverage) },
    { key: 'timing', label: 'Регламент', percent: toPercent(radar.timing), color: progressColor(radar.timing) },
    { key: 'fluency', label: 'Чистота речи', percent: toPercent(radar.fluency), color: progressColor(radar.fluency) },
    { key: 'vocabulary', label: 'Словарное разнообразие', percent: toPercent(radar.vocabulary), color: progressColor(radar.vocabulary) },
    { key: 'structure', label: 'Структура', percent: toPercent(radar.structure), color: progressColor(radar.structure) },
  ];
});

const coverageHint = computed(() => {
  if (summary.value?.overall_coverage === null || summary.value?.overall_coverage === undefined) return 'нет данных';
  const value = Number(summary.value?.overall_coverage);
  if (!Number.isFinite(value)) return 'нет данных';
  if (value >= 0.8) return 'отличный результат';
  if (value >= 0.5) return 'можно улучшить';
  return 'требует внимания';
});

const timingHint = computed(() => {
  const duration = Number(session.value?.duration_sec) || 0;
  const limit = Number(session.value?.time_limit_sec) || 0;
  if (!limit) return 'без регламента';
  const difference = duration - limit;
  if (difference > 0) return `превышение на ${formatDuration(difference)}`;
  return `запас ${formatDuration(Math.abs(difference))}`;
});

const fillerHint = computed(() => {
  if (summary.value?.filler_word_count === null || summary.value?.filler_word_count === undefined) return 'нет данных';
  const count = Number(summary.value?.filler_word_count);
  if (!Number.isFinite(count)) return 'нет данных';
  return count === 0 ? 'не обнаружены' : 'обнаружено в речи';
});

onMounted(loadResults);
watch(sessionId, (nextId, previousId) => {
  if (nextId !== previousId) loadResults();
});

async function loadResults() {
  if (!Number.isInteger(sessionId.value) || sessionId.value < 1) {
    router.replace('/404');
    return;
  }
  await sessionStore.fetchSession(sessionId.value);
}

async function reanalyze() {
  const result = await sessionStore.reanalyzeSession();
  if (!result.success) {
    toastStore.notify(result.message, 'error');
    return;
  }
  await sessionStore.fetchSession(sessionId.value);
  toastStore.notify('Анализ обновлён.', 'success');
}

function startNewSession() {
  const presentationId = session.value?.presentation_id;
  router.push({ path: '/session/new', query: presentationId ? { presentationId } : {} });
}

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(1, Math.max(0, number)) * 100) : 0;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? `${toPercent(number)}%` : '—';
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : '—';
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return 'Дата неизвестна';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function progressColor(value) {
  const number = Number(value);
  if (number >= 0.8) return 'success';
  if (number >= 0.5) return 'warning';
  return number > 0 ? 'error' : 'accent';
}

function scoreClass(value) {
  if (value === null || value === undefined || value === '') return 'slide-result__score--neutral';
  const number = Number(value);
  if (number >= 0.8) return 'slide-result__score--success';
  if (number >= 0.5) return 'slide-result__score--warning';
  return 'slide-result__score--error';
}

function slideSummary(item) {
  const matched = asList(item.matched_phrases).length;
  const missed = asList(item.missed_phrases).length;
  if (!matched && !missed) return 'Ключевые тезисы не заданы';
  return `Озвучено ${matched} из ${matched + missed} тезисов`;
}
</script>

<style scoped>
.results-page { width: 100%; max-width: 1280px; margin: 0 auto; padding: 32px 24px 56px; }
.results-page__loading { display: grid; min-height: 60vh; place-items: center; }
.results-page__state-card { max-width: 680px; margin: 48px auto; }
.results-page__state { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 28px; text-align: center; }
.results-page__state > i { color: var(--color-warning); font-size: 2.8rem; }
.results-page__state h1 { font-size: var(--text-2xl); }
.results-page__state p, .results-page__empty { color: var(--color-text-muted); line-height: 1.6; }
.results-page__state-actions, .results-page__actions { display: flex; flex-wrap: wrap; gap: 10px; }
.results-page__header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 24px; }
.results-page__back { display: inline-flex; gap: 7px; align-items: center; margin-bottom: 18px; color: var(--color-text-muted); font-size: var(--text-sm); }
.results-page__back:hover { color: var(--color-accent); }
.results-page__eyebrow { margin-bottom: 6px; color: var(--color-accent); font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.results-page__header h1 { font-size: var(--text-3xl); }
.results-page__meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; color: var(--color-text-muted); font-size: var(--text-sm); }
.results-page__notice { display: flex; gap: 13px; align-items: flex-start; margin-bottom: 20px; padding: 15px 18px; color: var(--color-accent); background: var(--color-accent-light); border: 1px solid var(--color-accent); border-radius: var(--radius-lg); }
.results-page__notice--warning { color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 10%, transparent); border-color: var(--color-warning); }
.results-page__notice p { margin-top: 3px; color: var(--color-text-muted); font-size: var(--text-sm); }
.results-page__metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
.metric-card { display: flex; gap: 14px; min-width: 0; padding: 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.metric-card__icon { display: grid; flex: 0 0 42px; width: 42px; height: 42px; color: var(--color-accent); background: var(--color-accent-light); border-radius: 50%; place-items: center; }
.metric-card__icon--time { color: var(--color-success); background: color-mix(in srgb, var(--color-success) 12%, transparent); }
.metric-card__icon--pace { color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 12%, transparent); }
.metric-card__icon--filler { color: var(--color-error); background: color-mix(in srgb, var(--color-error) 12%, transparent); }
.metric-card p { color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 600; }
.metric-card strong { display: block; margin: 3px 0; font-family: var(--font-mono); font-size: var(--text-2xl); }
.metric-card span { color: var(--color-text-muted); font-size: var(--text-xs); }
.results-page__overview { display: grid; grid-template-columns: 1.25fr .75fr; gap: 20px; margin-bottom: 32px; }
.results-page__section-title { display: flex; gap: 9px; align-items: center; font-family: var(--font-body); font-size: var(--text-lg); }
.results-page__section-title i { color: var(--color-accent); }
.results-page__suggestions { display: flex; flex-direction: column; gap: 12px; list-style: none; }
.results-page__suggestions li { display: flex; gap: 12px; align-items: flex-start; line-height: 1.55; }
.results-page__suggestions span { display: grid; flex: 0 0 27px; width: 27px; height: 27px; color: var(--color-accent); background: var(--color-accent-light); border-radius: 50%; font-size: var(--text-xs); font-weight: 700; place-items: center; }
.results-page__radar { display: flex; flex-direction: column; gap: 18px; }
.results-page__section-heading { display: flex; justify-content: space-between; align-items: end; margin-bottom: 14px; }
.results-page__section-heading h2 { font-size: var(--text-2xl); }
.results-page__section-heading p { margin-top: 4px; color: var(--color-text-muted); font-size: var(--text-sm); }
.results-page__slide-list { display: flex; flex-direction: column; gap: 10px; }
.slide-result { overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.slide-result[open] { border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border)); }
.slide-result summary { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 14px; align-items: center; padding: 17px 20px; cursor: pointer; list-style: none; }
.slide-result summary::-webkit-details-marker { display: none; }
.slide-result__number { display: grid; width: 38px; height: 38px; color: var(--color-accent); background: var(--color-accent-light); border-radius: var(--radius-md); font-weight: 700; place-items: center; }
.slide-result__summary { display: flex; flex-direction: column; gap: 3px; }
.slide-result__summary span { color: var(--color-text-muted); font-size: var(--text-xs); }
.slide-result__score { min-width: 58px; padding: 6px 9px; border-radius: 20px; font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700; text-align: center; }
.slide-result__score--success { color: var(--color-success); background: color-mix(in srgb, var(--color-success) 12%, transparent); }
.slide-result__score--warning { color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 12%, transparent); }
.slide-result__score--error { color: var(--color-error); background: color-mix(in srgb, var(--color-error) 12%, transparent); }
.slide-result__score--neutral { color: var(--color-text-muted); background: var(--color-surface-hover); }
.slide-result__chevron { color: var(--color-text-muted); transition: transform var(--transition-normal); }
.slide-result[open] .slide-result__chevron { transform: rotate(180deg); }
.slide-result__body { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; padding: 0 20px 20px 72px; border-top: 1px solid var(--color-border); }
.slide-result__phrases { padding-top: 18px; }
.slide-result__phrases h3, .slide-result__keywords h3 { margin-bottom: 10px; font-family: var(--font-body); font-size: var(--text-sm); }
.slide-result__phrases h3 i { margin-right: 5px; color: var(--color-success); }
.slide-result__phrases--missed h3 i { color: var(--color-warning); }
.slide-result__phrases ul { display: flex; flex-direction: column; gap: 7px; padding-left: 20px; color: var(--color-text); font-size: var(--text-sm); line-height: 1.45; }
.slide-result__phrases p { color: var(--color-text-muted); font-size: var(--text-sm); }
.slide-result__keywords { grid-column: 1 / -1; }
.slide-result__keywords > div { display: flex; flex-wrap: wrap; gap: 6px; }
.slide-result__keywords span { padding: 5px 8px; color: var(--color-text-muted); background: var(--color-surface-hover); border-radius: var(--radius-sm); font-size: var(--text-xs); }
@media (max-width: 1000px) {
  .results-page__metrics { grid-template-columns: repeat(2, 1fr); }
  .results-page__overview { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .results-page { padding: 22px 12px 40px; }
  .results-page__header { align-items: stretch; flex-direction: column; }
  .results-page__header h1 { font-size: var(--text-2xl); }
  .results-page__actions :deep(.base-button) { flex: 1; }
  .results-page__metrics { grid-template-columns: 1fr; }
  .slide-result summary { grid-template-columns: auto minmax(0, 1fr) auto; padding: 14px; }
  .slide-result__summary span { display: none; }
  .slide-result__chevron { display: none; }
  .slide-result__body { grid-template-columns: 1fr; padding: 0 14px 16px; }
  .slide-result__keywords { grid-column: auto; }
}
</style>
