<template>
  <div class="base-spinner" :class="`base-spinner--${size}`">
    <i class="fa-solid fa-spinner fa-spin"></i>
    <p v-if="text">{{ text }}</p>
  </div>
</template>

<script setup>
defineProps({
  size: { type: String, default: 'md' },
  text: { type: String, default: '' }
});
</script>

<style scoped>
.base-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-accent);
  padding: 40px;
}
.base-spinner--sm i { font-size: 1rem; }
.base-spinner--md i { font-size: 2rem; }
.base-spinner--lg i { font-size: 3rem; }
.base-spinner p {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>