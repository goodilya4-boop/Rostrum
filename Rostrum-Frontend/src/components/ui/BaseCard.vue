<template>
  <div class="base-card" :class="{ 'base-card--clickable': clickable }" @click="clickable && $emit('click')">
    <div v-if="$slots.header" class="base-card__header">
      <slot name="header" />
    </div>
    <div class="base-card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="base-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  clickable: { type: Boolean, default: false }
});
defineEmits(['click']);
</script>

<style scoped>
.base-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}
.base-card--clickable {
  cursor: pointer;
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
}
.base-card--clickable:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-1px);
}
.base-card__header {
  padding: 20px 24px 0;
}
.base-card__body {
  padding: 24px;
}
.base-card__footer {
  padding: 0 24px 20px;
}
</style>