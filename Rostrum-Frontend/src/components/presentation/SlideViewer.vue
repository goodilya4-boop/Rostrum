<template>
  <div class="slide-viewer">
    <div class="slide-viewer__container">
      <div class="slide-viewer__badge">
        Слайд {{ slideIndex }} из {{ totalSlides }}
      </div>

      <div v-if="imageUrl" class="slide-viewer__image">
        <div v-if="imageLoading" class="slide-viewer__image-state">Загрузка изображения…</div>
        <img v-else-if="resolvedImageUrl" :src="resolvedImageUrl" :alt="`Слайд ${slideIndex}`" />
        <div v-else class="slide-viewer__image-state">Изображение недоступно</div>
      </div>

      <div class="slide-viewer__text" v-if="extractedText">
        <h4>Извлечённый текст:</h4>
        <p>{{ extractedText }}</p>
      </div>

      <div class="slide-viewer__phrases" v-if="keyPhrases && keyPhrases.length">
        <h4>
          <i class="fa-solid fa-bullseye"></i>
          Ключевые тезисы:
        </h4>
        <ul>
          <li v-for="(phrase, i) in keyPhrases" :key="i">
            <span class="slide-viewer__phrase-index">{{ i + 1 }}.</span>
            {{ phrase }}
          </li>
        </ul>
      </div>

      <div v-else-if="extractedText" class="slide-viewer__empty-phrases">
        <i class="fa-solid fa-circle-info"></i>
        <p>Ключевые тезисы не выделены. Отредактируйте их вручную.</p>
      </div>

      <div v-else class="slide-viewer__empty">
        <i class="fa-solid fa-file-lines"></i>
        <p>Слайд не содержит текста для анализа.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { presentationsAPI } from '@/api/presentations.api';

const props = defineProps({
  slideIndex: { type: Number, required: true },
  totalSlides: { type: Number, required: true },
  imageUrl: { type: String, default: '' },
  extractedText: { type: String, default: '' },
  keyPhrases: { type: Array, default: () => [] }
});

const resolvedImageUrl = ref('');
const imageLoading = ref(false);
let objectUrl = '';
let requestVersion = 0;

function revokeObjectUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
  resolvedImageUrl.value = '';
}

watch(() => props.imageUrl, async imageUrl => {
  const version = ++requestVersion;
  revokeObjectUrl();
  if (!imageUrl) return;

  if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
    resolvedImageUrl.value = imageUrl;
    return;
  }

  imageLoading.value = true;
  try {
    const response = await presentationsAPI.getSlideImage(imageUrl);
    const nextObjectUrl = URL.createObjectURL(response.data);
    if (version !== requestVersion) {
      URL.revokeObjectURL(nextObjectUrl);
      return;
    }
    objectUrl = nextObjectUrl;
    resolvedImageUrl.value = nextObjectUrl;
  } catch {
    if (version === requestVersion) resolvedImageUrl.value = '';
  } finally {
    if (version === requestVersion) imageLoading.value = false;
  }
}, { immediate: true });

onBeforeUnmount(() => {
  requestVersion++;
  revokeObjectUrl();
});
</script>

<style scoped>
.slide-viewer {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: 32px;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.slide-viewer__container {
  width: 100%;
  max-width: 800px;
}
.slide-viewer__badge {
  display: inline-block;
  padding: 4px 12px;
  background: var(--color-accent);
  color: var(--color-text-inverse);
  border-radius: 20px;
  font-size: var(--text-xs);
  font-weight: 600;
  margin-bottom: 20px;
}
.slide-viewer__image {
  margin-bottom: 20px;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.slide-viewer__image img {
  width: 100%;
  height: auto;
}
.slide-viewer__image-state {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: var(--color-surface);
}
.slide-viewer__text {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
.slide-viewer__text h4 {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}
.slide-viewer__text p {
  font-size: var(--text-sm);
  line-height: 1.7;
  white-space: pre-wrap;
}
.slide-viewer__phrases h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-success);
}
.slide-viewer__phrases h4 i { color: var(--color-success); }
.slide-viewer__phrases ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.slide-viewer__phrases li {
  padding: 10px 14px;
  background: var(--color-surface);
  border-left: 3px solid var(--color-success);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: var(--text-sm);
  line-height: 1.6;
}
.slide-viewer__phrase-index {
  font-weight: 600;
  color: var(--color-accent);
  margin-right: 6px;
}
.slide-viewer__empty-phrases,
.slide-viewer__empty {
  text-align: center;
  padding: 32px;
  color: var(--color-text-muted);
}
.slide-viewer__empty-phrases i,
.slide-viewer__empty i {
  font-size: 2rem;
  margin-bottom: 8px;
  display: block;
}
</style>
