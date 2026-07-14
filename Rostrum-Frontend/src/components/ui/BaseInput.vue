<template>
  <div class="base-input-wrapper">
    <label v-if="label" :for="inputId" class="base-input__label">{{ label }}</label>
    <div class="base-input__container" :class="{ 'base-input__container--error': error }">
      <i v-if="icon" :class="icon" class="base-input__icon"></i>
      <input
        :id="inputId"
        :type="computedType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        class="base-input__field"
        @input="$emit('update:modelValue', $event.target.value)"
      />
      <button
        v-if="type === 'password'"
        type="button"
        class="base-input__toggle"
        @click="showPassword = !showPassword"
      >
        <i :class="showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'"></i>
      </button>
    </div>
    <p v-if="error" class="base-input__error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  icon: { type: String, default: '' },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  autocomplete: { type: String, default: undefined }
});

defineEmits(['update:modelValue']);

const showPassword = ref(false);
const inputId = `input-${Math.random().toString(36).slice(2, 9)}`;
const computedType = computed(() => {
  if (props.type === 'password' && showPassword.value) return 'text';
  return props.type;
});
</script>

<style scoped>
.base-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.base-input__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}
.base-input__container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.base-input__container:focus-within {
  border-color: var(--color-input-focus);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}
.base-input__container--error {
  border-color: var(--color-error);
}
.base-input__icon {
  color: var(--color-text-muted);
  font-size: var(--text-base);
  width: 16px;
  text-align: center;
}
.base-input__field {
  flex: 1;
  padding: 12px 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--text-base);
}
.base-input__field::placeholder {
  color: var(--color-text-muted);
}
.base-input__toggle {
  padding: 4px;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}
.base-input__toggle:hover {
  color: var(--color-text);
}
.base-input__error {
  font-size: var(--text-xs);
  color: var(--color-error);
}
</style>
