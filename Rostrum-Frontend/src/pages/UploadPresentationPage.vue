<template>
  <div class="upload-page">
    <div class="upload-page__header">
      <button class="upload-page__back" @click="$router.back()">
        <i class="fa-solid fa-arrow-left"></i>
        Назад
      </button>
      <h1>Загрузка презентации</h1>
    </div>

    <BaseCard>
      <div class="upload-page__zone"
  :class="{ 'upload-page__zone--dragover': isDragover, 'upload-page__zone--uploading': uploading }"
  @dragover.prevent="isDragover = true"
  @dragleave.prevent="isDragover = false"
  @drop.prevent="handleDrop"
  @click="triggerFileInput"
>
  <!-- Начальное состояние -->
  <div v-if="!uploading && !selectedFile">
    <i class="fa-solid fa-cloud-arrow-up upload-page__zone-icon"></i>
    <h2>Перетащите файл сюда</h2>
    <p>или нажмите, чтобы выбрать</p>
    <p class="upload-page__formats">Поддерживаются PPTX и PDF (до 50 МБ)</p>
  </div>

  <!-- Загрузка -->
  <div v-else-if="uploading" @click.stop>
    <i class="fa-solid fa-spinner fa-spin upload-page__zone-icon"></i>
    <h2>Загрузка и разбор презентации...</h2>
    <p>{{ selectedFile?.name }}</p>
    <BaseProgress :percent="uploadProgress" class="upload-page__progress" />
  </div>

  <!-- Файл выбран -->
  <div v-else @click.stop>
    <i class="fa-solid fa-file-powerpoint upload-page__zone-icon" style="color: var(--color-success)"></i>
    <h2>{{ selectedFile.name }}</h2>
    <p>{{ formatFileSize(selectedFile.size) }}</p>
    <BaseButton variant="primary" @click="uploadFile" :loading="uploading">
      <i class="fa-solid fa-upload"></i>
      Загрузить
    </BaseButton>
    <BaseButton variant="ghost" @click="clearFile" style="margin-top: 12px;">
      Выбрать другой
    </BaseButton>
  </div>

  <input
    ref="fileInput"
    type="file"
    accept=".pptx,.pdf"
    class="upload-page__input"
    @change="handleFileSelect"
  />
</div>
    </BaseCard>

    <BaseCard v-if="uploadResult">
      <div class="upload-page__result" :class="`upload-page__result--${uploadResult.success ? 'success' : 'error'}`">
        <i :class="uploadResult.success ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark'"></i>
        <div>
          <p class="upload-page__result-title">
            {{ uploadResult.success ? 'Презентация загружена!' : 'Ошибка загрузки' }}
          </p>
          <p class="upload-page__result-message">
  {{ uploadResult.success
      ? `${uploadResult.data.title || 'Презентация'} • ${uploadResult.data.slide_count || uploadResult.data.slides?.length || 0} слайдов`
      : uploadResult.message }}
</p>
        </div>
        <BaseButton
          v-if="uploadResult.success"
          variant="primary"
          @click="$router.push(`/presentations/${uploadResult.data.id}`)"
        >
          Открыть
        </BaseButton>
      </div>
    </BaseCard>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { usePresentationStore } from '@/stores/presentation.store';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseProgress from '@/components/ui/BaseProgress.vue';

const store = usePresentationStore();

const fileInput = ref(null);
const selectedFile = ref(null);
const isDragover = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadResult = ref(null);

function triggerFileInput() {
  if (!uploading.value) fileInput.value?.click();
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function handleDrop(e) {
  isDragover.value = false;
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  const allowedExt = ['.pptx', '.pdf'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (!allowedExt.includes(ext)) {
    uploadResult.value = { success: false, message: 'Недопустимый формат файла. Разрешены: PPTX и PDF.' };
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    uploadResult.value = { success: false, message: 'Файл слишком большой. Максимальный размер: 50 МБ.' };
    return;
  }

  selectedFile.value = file;
  uploadResult.value = null;
}

function clearFile() {
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = '';
  uploadResult.value = null;
}

async function uploadFile() {
  if (!selectedFile.value) return;

  uploading.value = true;
  uploadProgress.value = 0;
  uploadResult.value = null;

  const formData = new FormData();
  // Имя поля должно совпадать с тем, что ожидает multer
  formData.append('presentation', selectedFile.value);

  const result = await store.uploadPresentation(formData, (progressEvent) => {
    if (progressEvent.total) {
      uploadProgress.value = Math.round((progressEvent.loaded / progressEvent.total) * 50);
    }
  });

  if (result.success) {
    uploadProgress.value = 100;
    uploadResult.value = result;
    selectedFile.value = null;
  } else {
    uploadResult.value = result;
  }

  uploading.value = false;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}
</script>

<style scoped>
.upload-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.upload-page__header {
  display: flex;
  align-items: center;
  gap: 16px;
}
.upload-page__back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  border-radius: var(--radius-md);
  transition: color var(--transition-fast), background var(--transition-fast);
}
.upload-page__back:hover { color: var(--color-text); background: var(--color-surface-hover); }
.upload-page__header h1 { font-size: var(--text-2xl); }

.upload-page__zone {
  padding: 64px 24px;
  text-align: center;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.upload-page__zone:hover,
.upload-page__zone--dragover {
  border-color: var(--color-accent);
  background: var(--color-accent-light);
}
.upload-page__zone--uploading {
  cursor: default;
  border-color: var(--color-accent);
}
.upload-page__zone-icon {
  font-size: 3rem;
  color: var(--color-accent);
  opacity: 0.6;
}
.upload-page__zone h2 {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  font-weight: 600;
}
.upload-page__zone p { color: var(--color-text-muted); font-size: var(--text-sm); }
.upload-page__formats {
  margin-top: 4px;
  font-size: var(--text-xs) !important;
  opacity: 0.7;
}
.upload-page__progress { width: 300px; margin-top: 8px; }
.upload-page__input { display: none; }

.upload-page__result {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}
.upload-page__result i { font-size: 1.5rem; }
.upload-page__result--success i { color: var(--color-success); }
.upload-page__result--error i { color: var(--color-error); }
.upload-page__result-title { font-weight: 600; }
.upload-page__result-message { font-size: var(--text-sm); color: var(--color-text-muted); }
</style>
