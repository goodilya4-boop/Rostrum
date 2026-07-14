<template>
  <div class="detail-page">
    <BaseSpinner v-if="store.loading && !store.currentPresentation" text="Загрузка презентации..." />

    <BaseCard v-else-if="store.error && !store.currentPresentation">
      <div class="detail-page__error">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h2>Презентация не найдена</h2>
        <p>{{ store.error }}</p>
        <BaseButton variant="primary" @click="$router.push('/presentations')">
          Вернуться к списку
        </BaseButton>
      </div>
    </BaseCard>

    <template v-else-if="pres">
      <div class="detail-page__header">
        <button class="detail-page__back" @click="$router.push('/presentations')">
          <i class="fa-solid fa-arrow-left"></i>
          К списку
        </button>
        <div>
          <h1>{{ pres.title }}</h1>
          <p class="detail-page__meta">
            {{ pres.slide_count }} слайдов
            <span v-if="pres.created_at"> • Загружена {{ formatDate(pres.created_at) }}</span>
          </p>
        </div>
        <div class="detail-page__header-actions">
          <BaseButton variant="secondary" icon="fa-solid fa-microphone" @click="startRehearsalSetup">
            Репетировать
          </BaseButton>
          <BaseButton variant="ghost" icon="fa-solid fa-trash-can" @click="handleDelete">
            Удалить
          </BaseButton>
        </div>
      </div>

      <div class="detail-page__layout">
        <div class="detail-page__thumbnails">
          <button
            v-for="slide in slides"
            :key="slide.id || slide.slide_index"
            class="detail-page__thumb"
            :class="{ 'detail-page__thumb--active': activeSlideIndex === slide.slide_index }"
            @click="activeSlideIndex = slide.slide_index"
          >
            <span class="detail-page__thumb-num">{{ slide.slide_index }}</span>
            <span class="detail-page__thumb-text">
              {{ truncateText(slide.extracted_text, 40) || 'Без текста' }}
            </span>
            <i
              v-if="slide.key_phrases && slide.key_phrases.length"
              class="fa-solid fa-circle-check detail-page__thumb-badge"
              title="Есть ключевые тезисы"
            ></i>
          </button>
        </div>

        <div class="detail-page__content">
          <SlideViewer
            v-if="activeSlide"
            :slide-index="activeSlide.slide_index"
            :total-slides="pres.slide_count"
            :image-url="activeSlide.image_url"
            :extracted-text="activeSlide.extracted_text"
            :key-phrases="activeSlide.key_phrases"
          />

          <KeyPhrasesEditor
            v-if="activeSlide"
            :key-phrases="activeSlide.key_phrases || []"
            ref="editorRef"
            @save="handleSavePhrases"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePresentationStore } from '@/stores/presentation.store';
import { useToastStore } from '@/stores/toast.store';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';
import SlideViewer from '@/components/presentation/SlideViewer.vue';
import KeyPhrasesEditor from '@/components/presentation/KeyPhrasesEditor.vue';

const route = useRoute();
const router = useRouter();
const store = usePresentationStore();
const toastStore = useToastStore();

const activeSlideIndex = ref(1);
const editorRef = ref(null);

const pres = computed(() => store.currentPresentation);
const slides = computed(() => pres.value?.slides || []);
const activeSlide = computed(() => slides.value.find(s => s.slide_index === activeSlideIndex.value));

async function loadPresentation(id) {
  await store.fetchPresentation(id);
  if (slides.value.length > 0) {
    activeSlideIndex.value = slides.value[0].slide_index;
  }
}

onMounted(() => loadPresentation(route.params.id));

watch(() => route.params.id, newId => {
  if (newId) loadPresentation(newId);
});

function startRehearsalSetup() {
  if (!pres.value) return;
  router.push({
    name: 'SessionSetup',
    query: { presentationId: pres.value.id },
  });
}

async function handleSavePhrases(phrases) {
  if (!pres.value) return;
  const result = await store.updateKeyPhrases(pres.value.id, activeSlideIndex.value, phrases);

  if (editorRef.value) {
    editorRef.value.setSaveResult(result.success, result.message);
  }
}

async function handleDelete() {
  if (!pres.value) return;
  if (confirm(`Удалить презентацию «${pres.value.title}»? Это действие нельзя отменить.`)) {
    const result = await store.deletePresentation(pres.value.id);
    if (result.success) {
      toastStore.notify('Презентация удалена.', 'success');
      router.push('/presentations');
    } else {
      toastStore.notify(result.message, 'error');
    }
  }
}

function truncateText(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
</script>

<style scoped>
.detail-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.detail-page__error {
  text-align: center;
  padding: 48px 24px;
}
.detail-page__error i { font-size: 3rem; color: var(--color-warning); margin-bottom: 12px; display: block; }
.detail-page__error h2 { font-family: var(--font-body); font-size: var(--text-lg); font-weight: 600; margin-bottom: 8px; }
.detail-page__error p { color: var(--color-text-muted); margin-bottom: 20px; }

.detail-page__header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.detail-page__back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  transition: color var(--transition-fast), background var(--transition-fast);
  margin-top: 4px;
}
.detail-page__back:hover { color: var(--color-text); background: var(--color-surface-hover); }
.detail-page__header h1 { font-size: var(--text-2xl); word-break: break-word; }
.detail-page__meta { font-size: var(--text-sm); color: var(--color-text-muted); margin-top: 4px; }
.detail-page__header-actions { margin-left: auto; display: flex; gap: 8px; }

.detail-page__layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  align-items: start;
}
@media (max-width: 900px) {
  .detail-page__layout { grid-template-columns: 1fr; }
}

.detail-page__thumbnails {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  position: sticky;
  top: 88px;
}
.detail-page__thumb {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
  width: 100%;
}
.detail-page__thumb:hover { border-color: var(--color-accent); background: var(--color-accent-light); }
.detail-page__thumb--active {
  border-color: var(--color-accent);
  background: var(--color-accent-light);
  box-shadow: 0 0 0 2px var(--color-accent-light);
}
.detail-page__thumb-num {
  font-weight: 600;
  font-size: var(--text-xs);
  color: var(--color-accent);
  min-width: 20px;
}
.detail-page__thumb-text {
  flex: 1;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.detail-page__thumb-badge {
  color: var(--color-success);
  font-size: 0.7rem;
}

.detail-page__content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
