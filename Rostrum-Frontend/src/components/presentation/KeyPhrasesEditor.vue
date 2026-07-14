<template>
  <div class="key-phrases-editor">
    <div class="key-phrases-editor__header">
      <h4>
        <i class="fa-solid fa-pen-to-square"></i>
        Редактирование ключевых тезисов
      </h4>
      <BaseButton variant="ghost" icon="fa-solid fa-plus" @click="addPhrase">
        Добавить
      </BaseButton>
    </div>

    <p class="key-phrases-editor__hint">
      Отметьте 3–5 самых важных тезисов, которые нужно обязательно озвучить на этом слайде.
    </p>

    <div v-if="phrases.length === 0" class="key-phrases-editor__empty">
      <p>Нет ключевых тезисов. Добавьте первый.</p>
    </div>

    <div class="key-phrases-editor__list">
      <div v-for="(phrase, i) in phrases" :key="i" class="key-phrases-editor__item">
        <span class="key-phrases-editor__item-index">{{ i + 1 }}.</span>
        <input
          v-model="phrases[i]"
          type="text"
          class="key-phrases-editor__input"
          placeholder="Введите ключевой тезис..."
        />
        <button
          class="key-phrases-editor__remove"
          @click="removePhrase(i)"
          title="Удалить тезис"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>

    <div class="key-phrases-editor__actions" v-if="hasChanges">
      <BaseButton variant="primary" :loading="saving" @click="save">
        <i class="fa-solid fa-floppy-disk"></i>
        Сохранить
      </BaseButton>
      <BaseButton variant="ghost" @click="reset">
        Отменить
      </BaseButton>
    </div>

    <div v-if="saveMessage" class="key-phrases-editor__message" :class="`key-phrases-editor__message--${saveMessage.type}`">
      {{ saveMessage.text }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  keyPhrases: { type: Array, default: () => [] }
});

const emit = defineEmits(['save']);

const phrases = ref([...props.keyPhrases]);
const originalPhrases = ref([...props.keyPhrases]);
const saving = ref(false);
const saveMessage = ref(null);

const hasChanges = ref(false);

watch(phrases, () => {
  hasChanges.value = JSON.stringify(phrases.value) !== JSON.stringify(originalPhrases.value);
}, { deep: true });

watch(() => props.keyPhrases, (val) => {
  phrases.value = [...val];
  originalPhrases.value = [...val];
  hasChanges.value = false;
});

function addPhrase() {
  phrases.value.push('');
}

function removePhrase(i) {
  phrases.value.splice(i, 1);
}

async function save() {
  const validPhrases = phrases.value.filter(p => p.trim().length > 0);
  saving.value = true;
  saveMessage.value = null;

  emit('save', validPhrases);
}

function setSaveResult(success, message) {
  saveMessage.value = {
    type: success ? 'success' : 'error',
    text: message || (success ? 'Сохранено' : 'Ошибка сохранения')
  };

  if (success) {
    originalPhrases.value = [...phrases.value];
    hasChanges.value = false;
  }

  saving.value = false;

  setTimeout(() => {
    saveMessage.value = null;
  }, 3000);
}

function reset() {
  phrases.value = [...originalPhrases.value];
  hasChanges.value = false;
}

defineExpose({ setSaveResult, reset });
</script>

<style scoped>
.key-phrases-editor { display: flex; flex-direction: column; gap: 16px; }
.key-phrases-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.key-phrases-editor__header h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: 600;
}
.key-phrases-editor__hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.key-phrases-editor__empty {
  text-align: center;
  padding: 20px;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
.key-phrases-editor__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.key-phrases-editor__item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.key-phrases-editor__item-index {
  font-weight: 600;
  color: var(--color-accent);
  font-size: var(--text-sm);
  min-width: 20px;
}
.key-phrases-editor__input {
  flex: 1;
  padding: 10px 14px;
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-family: var(--font-body);
  transition: border-color var(--transition-fast);
}
.key-phrases-editor__input:focus {
  outline: none;
  border-color: var(--color-input-focus);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}
.key-phrases-editor__remove {
  padding: 6px;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
  font-size: var(--text-base);
}
.key-phrases-editor__remove:hover { color: var(--color-error); background: rgba(194,106,106,0.1); }
.key-phrases-editor__actions { display: flex; gap: 12px; padding-top: 8px; border-top: 1px solid var(--color-border); }
.key-phrases-editor__message {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}
.key-phrases-editor__message--success {
  background: rgba(74, 124, 89, 0.1);
  color: var(--color-success);
}
.key-phrases-editor__message--error {
  background: rgba(194, 106, 106, 0.1);
  color: var(--color-error);
}
</style>