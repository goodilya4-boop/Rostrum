<template>
  <button
    :class="['base-button', `base-button--${variant}`, { 'base-button--loading': loading }]"
    :disabled="disabled || loading"
    @click="$emit('click')"
  >
    <i v-if="icon && !loading" :class="icon"></i>
    <span v-if="loading" class="base-button__spinner">
      <i class="fa-solid fa-spinner fa-spin"></i>
    </span>
    <slot />
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'primary' },
  icon: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false }
});
defineEmits(['click']);
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: var(--text-base);
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  white-space: nowrap;
  min-height: 44px;
}
.base-button--primary {
  background: var(--color-accent);
  color: var(--color-text-inverse);
}
.base-button--primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}
.base-button--secondary {
  background: transparent;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
}
.base-button--secondary:hover:not(:disabled) {
  background: var(--color-accent-light);
}
.base-button--ghost {
  background: transparent;
  color: var(--color-text-muted);
}
.base-button--ghost:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-surface-hover);
}
.base-button--danger {
  background: var(--color-error);
  color: #fff;
}
.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>