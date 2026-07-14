import { defineStore } from 'pinia';
import { ref } from 'vue';
import { presentationsAPI } from '@/api/presentations.api';

export const usePresentationStore = defineStore('presentation', () => {
  const presentations = ref([]);
  const currentPresentation = ref(null);
  const loading = ref(false);
  const error = ref(null);

  async function fetchPresentations() {
    loading.value = true;
    error.value = null;
    try {
      const res = await presentationsAPI.getAll();
      presentations.value = Array.isArray(res.data.presentations) ? res.data.presentations : [];
      return presentations.value;
    } catch (e) {
      error.value = e.response?.data?.error?.message || 'Не удалось загрузить презентации';
      return [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchPresentation(id) {
    loading.value = true;
    error.value = null;
    try {
      // Backend returns presentation metadata and slides from one protected endpoint.
      const { data } = await presentationsAPI.getSlides(id);
      const presentation = data.presentation;
      const slides = data.slides;
      if (!presentation || !Array.isArray(slides)) {
        throw new Error('Некорректный ответ Backend');
      }
      currentPresentation.value = {
        ...presentation,
        slides
      };
      return currentPresentation.value;
    } catch (e) {
      error.value = e.response?.data?.error?.message || e.message || 'Презентация не найдена';
      currentPresentation.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function uploadPresentation(formData, onProgress) {
    loading.value = true;
    error.value = null;
    try {
      const res = await presentationsAPI.upload(formData, onProgress);
      const newPresentation = res.data;
      if (!newPresentation?.id) throw new Error('Некорректный ответ Backend');
      presentations.value.unshift(newPresentation);
      return { success: true, data: newPresentation };
    } catch (e) {
      const message = e.response?.data?.error?.message || e.message || 'Не удалось загрузить презентацию';
      error.value = message;
      return { success: false, message };
    } finally {
      loading.value = false;
    }
  }

  async function updateKeyPhrases(presentationId, slideIndex, keyPhrases) {
    try {
      await presentationsAPI.updateKeyPhrases(presentationId, slideIndex, keyPhrases);

      if (currentPresentation.value?.id === presentationId) {
        const slides = currentPresentation.value.slides;
        if (slides) {
          const slide = slides.find(s => s.slide_index === slideIndex);
          if (slide) {
            slide.key_phrases = keyPhrases;
          }
        }
      }
      return { success: true };
    } catch (e) {
      return {
        success: false,
        message: e.response?.data?.error?.message || 'Не удалось обновить ключевые фразы'
      };
    }
  }

  async function deletePresentation(id) {
    try {
      await presentationsAPI.delete(id);
      presentations.value = presentations.value.filter(p => p.id !== id);
      if (currentPresentation.value?.id === id) {
        currentPresentation.value = null;
      }
      return { success: true };
    } catch (e) {
      return {
        success: false,
        message: e.response?.data?.error?.message || 'Не удалось удалить презентацию'
      };
    }
  }

  return {
    presentations,
    currentPresentation,
    loading,
    error,
    fetchPresentations,
    fetchPresentation,
    uploadPresentation,
    updateKeyPhrases,
    deletePresentation
  };
});
