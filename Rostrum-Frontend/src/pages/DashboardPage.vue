<template>
  <div class="dashboard">
    <div class="dashboard__welcome">
      <h1>Добро пожаловать, {{ authStore.user?.first_name || '...' }}!</h1>
    </div>

    <div v-if="loadError" class="dashboard__error" role="alert">
      <i class="fa-solid fa-triangle-exclamation"></i>
      {{ loadError }}
    </div>

    <div class="dashboard__actions">
      <BaseCard>
        <div class="quick-actions">
          <BaseButton variant="primary" icon="fa-solid fa-upload" @click="$router.push('/presentations/upload')">
            Загрузить PPT
          </BaseButton>
          <BaseButton variant="secondary" icon="fa-solid fa-microphone" @click="$router.push('/session/new')">
            Начать репетицию
          </BaseButton>
        </div>
      </BaseCard>
    </div>

    <div class="dashboard__grid">
      <BaseCard>
        <template #header>
          <h2 class="dashboard__section-title">
            <i class="fa-solid fa-file-powerpoint"></i>
            Последние презентации
          </h2>
        </template>
        <div v-if="loadingPres" class="dashboard__loader">
          <BaseSpinner size="sm" text="Загрузка..." />
        </div>
        <div v-else-if="presentations.length === 0" class="dashboard__empty">
          <i class="fa-solid fa-file-powerpoint dashboard__empty-icon"></i>
          <p>У вас пока нет презентаций</p>
          <BaseButton variant="ghost" @click="$router.push('/presentations/upload')">
            Загрузить первую
          </BaseButton>
        </div>
        <div v-else class="dashboard__pres-list">
          <div
            v-for="pres in presentations.slice(0, 3)"
            :key="pres.id"
            class="dashboard__pres-card"
            @click="$router.push(`/presentations/${pres.id}`)"
          >
            <i class="fa-solid fa-file-lines"></i>
            <div>
              <p class="dashboard__pres-title">{{ pres.title }}</p>
              <p class="dashboard__pres-meta">{{ pres.slide_count }} слайдов</p>
            </div>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <template #header>
          <h2 class="dashboard__section-title">
            <i class="fa-solid fa-clock-rotate-left"></i>
            История репетиций
          </h2>
        </template>
        <div v-if="loadingSessions" class="dashboard__loader">
          <BaseSpinner size="sm" text="Загрузка..." />
        </div>
        <div v-else-if="sessions.length === 0" class="dashboard__empty">
          <i class="fa-solid fa-microphone dashboard__empty-icon"></i>
          <p>Вы ещё не проводили репетиций</p>
        </div>
        <div v-else class="dashboard__sessions-table">
          <div class="dashboard__table-header">
            <span>Дата</span>
            <span>Презентация</span>
            <span>Время</span>
            <span>Покрытие</span>
          </div>
          <div
            v-for="s in sessions.slice(0, 5)"
            :key="s.session_id"
            class="dashboard__table-row"
            role="link"
            tabindex="0"
            @click="$router.push(`/session/${s.session_id}/results`)"
            @keydown.enter="$router.push(`/session/${s.session_id}/results`)"
          >
            <span class="dashboard__cell-muted">{{ formatDate(s.start_time) }}</span>
            <span>{{ s.presentation_title }}</span>
            <span :class="{ 'dashboard__cell-error': s.timing_adherence < 1 }">
              {{ formatTime(s.duration_sec) }} / {{ formatTime(s.time_limit_sec) }}
            </span>
            <span>
              <i
                :class="coverageIcon(s.overall_coverage)"
                :style="{ color: coverageColor(s.overall_coverage) }"
              ></i>
              {{ Math.round((s.overall_coverage || 0) * 100) }}%
            </span>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { usePresentationStore } from '@/stores/presentation.store';
import { useSessionStore } from '@/stores/session.store';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';

const authStore = useAuthStore();
const presentationStore = usePresentationStore();
const sessionStore = useSessionStore();
const presentations = computed(() => presentationStore.presentations);
const sessions = computed(() => sessionStore.history);
const loadingPres = computed(() => presentationStore.loading);
const loadingSessions = computed(() => sessionStore.loadingHistory);
const loadError = computed(() => presentationStore.error || sessionStore.error || '');

onMounted(async () => {
  await Promise.all([
    presentationStore.fetchPresentations(),
    sessionStore.fetchHistory(),
  ]);
});

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatTime(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function coverageColor(score) {
  if (!score && score !== 0) return 'var(--color-text-muted)';
  if (score >= 0.8) return 'var(--color-success)';
  if (score >= 0.5) return 'var(--color-warning)';
  return 'var(--color-error)';
}

function coverageIcon(score) {
  if (!score && score !== 0) return 'fa-solid fa-minus';
  if (score >= 0.8) return 'fa-solid fa-circle-check';
  if (score >= 0.5) return 'fa-solid fa-triangle-exclamation';
  return 'fa-solid fa-circle-xmark';
}
</script>

<style scoped>
.dashboard {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.dashboard__welcome h1 {
  font-size: var(--text-2xl);
}
.dashboard__error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  color: var(--color-error);
  background: rgba(194, 106, 106, 0.08);
  border: 1px solid rgba(194, 106, 106, 0.25);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}
.quick-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.dashboard__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
@media (max-width: 900px) {
  .dashboard__grid { grid-template-columns: 1fr; }
}
.dashboard__section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--text-lg);
  font-weight: 600;
  font-family: var(--font-body);
}
.dashboard__section-title i {
  color: var(--color-accent);
  width: 20px;
  text-align: center;
}
.dashboard__loader {
  display: flex;
  justify-content: center;
}
.dashboard__empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--color-text-muted);
}
.dashboard__empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
  display: block;
}
.dashboard__pres-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dashboard__pres-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
  cursor: pointer;
}
.dashboard__pres-card:hover {
  background: var(--color-surface-hover);
}
.dashboard__pres-card i {
  font-size: 1.4rem;
  color: var(--color-accent);
  width: 24px;
  text-align: center;
}
.dashboard__pres-title {
  font-weight: 500;
  font-size: var(--text-sm);
}
.dashboard__pres-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.dashboard__sessions-table {
  font-size: var(--text-sm);
}
.dashboard__table-header {
  display: grid;
  grid-template-columns: 1fr 1.2fr 0.8fr 0.7fr;
  gap: 12px;
  padding: 8px 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}
.dashboard__table-row {
  display: grid;
  grid-template-columns: 1fr 1.2fr 0.8fr 0.7fr;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  align-items: center;
}
.dashboard__table-row:hover {
  background: var(--color-surface-hover);
}
.dashboard__cell-muted {
  color: var(--color-text-muted);
}
.dashboard__cell-error {
  color: var(--color-error);
}
</style>
