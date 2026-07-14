<template>
  <div class="rehearsal-slide" :aria-busy="loading">
    <div v-if="loading" class="rehearsal-slide__state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span>Загрузка слайда...</span>
    </div>

    <img
      v-else-if="resolvedImageUrl"
      :src="resolvedImageUrl"
      :alt="`Слайд ${slide.slide_index}`"
      draggable="false"
    />

    <div v-else class="rehearsal-slide__fallback">
      <span>Слайд {{ slide.slide_index }}</span>
      <p v-if="slide.extracted_text">{{ slide.extracted_text }}</p>
      <p v-else>Изображение и текст слайда недоступны.</p>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { presentationsAPI } from '@/api/presentations.api';

const props = defineProps({
  slide: { type: Object, required: true },
});

const resolvedImageUrl = ref('');
const loading = ref(false);
let objectUrl = '';
let requestVersion = 0;

function revokeObjectUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = '';
  resolvedImageUrl.value = '';
}

watch(() => props.slide.image_url, async imageUrl => {
  const version = ++requestVersion;
  revokeObjectUrl();
  if (!imageUrl) return;

  loading.value = true;
  try {
    const response = await presentationsAPI.getSlideImage(imageUrl);
    const nextUrl = URL.createObjectURL(response.data);
    if (version !== requestVersion) {
      URL.revokeObjectURL(nextUrl);
      return;
    }
    objectUrl = nextUrl;
    resolvedImageUrl.value = nextUrl;
  } catch {
    if (version === requestVersion) resolvedImageUrl.value = '';
  } finally {
    if (version === requestVersion) loading.value = false;
  }
}, { immediate: true });

onBeforeUnmount(() => {
  requestVersion += 1;
  revokeObjectUrl();
});
</script>

<style scoped>
.rehearsal-slide {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  color: #252525;
  background: #fff;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  user-select: none;
}
.rehearsal-slide img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.rehearsal-slide__state,
.rehearsal-slide__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  height: 100%;
  padding: 8%;
  text-align: center;
}
.rehearsal-slide__state { color: #6b6b6b; }
.rehearsal-slide__state i { color: #1e3a5f; font-size: 2rem; }
.rehearsal-slide__fallback > span { color: #1e3a5f; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.rehearsal-slide__fallback p { max-width: 85%; font-size: clamp(1rem, 2vw, 1.75rem); line-height: 1.55; white-space: pre-wrap; }
</style>
