<template>
  <div class="base-progress">
    <div class="base-progress__header" v-if="label || showPercent">
      <span v-if="label" class="base-progress__label">{{ label }}</span>
      <span v-if="showPercent" class="base-progress__percent">{{ Math.round(percent) }}%</span>
    </div>
    <div class="base-progress__track">
      <div
        class="base-progress__fill"
        :class="`base-progress__fill--${color}`"
        :style="{ width: `${Math.min(100, Math.max(0, percent))}%` }"
      ></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  percent: { type: Number, default: 0 },
  label: { type: String, default: '' },
  showPercent: { type: Boolean, default: true },
  color: { type: String, default: 'accent' }
});
</script>

<style scoped>
.base-progress { display: flex; flex-direction: column; gap: 6px; }
.base-progress__header { display: flex; justify-content: space-between; font-size: var(--text-sm); }
.base-progress__label { color: var(--color-text); }
.base-progress__percent { color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
.base-progress__track { height: 6px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.base-progress__fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
.base-progress__fill--accent { background: var(--color-accent); }
.base-progress__fill--success { background: var(--color-success); }
.base-progress__fill--warning { background: var(--color-warning); }
.base-progress__fill--error { background: var(--color-error); }
</style>