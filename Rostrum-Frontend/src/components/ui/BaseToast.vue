<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="visible"
        class="base-toast"
        :class="`base-toast--${type}`"
        :role="type === 'error' ? 'alert' : 'status'"
        aria-live="polite"
      >
        <i :class="iconClass"></i>
        <span>{{ message }}</span>
        <button class="base-toast__close" aria-label="Закрыть уведомление" @click="hide">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue';

const props = defineProps({
  message: { type: String, default: '' },
  type: { type: String, default: 'info' },    // success | error | warning | info
  duration: { type: Number, default: 4000 },
  show: { type: Boolean, default: false }
});

const emit = defineEmits(['update:show']);
const visible = ref(false);
let timer = null;

const iconClass = computed(() => {
  const icons = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-xmark',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info'
  };
  return icons[props.type] || icons.info;
});

function hide() {
  visible.value = false;
  emit('update:show', false);
  clearTimeout(timer);
}

watch(() => props.show, (val) => {
  if (val) {
    visible.value = true;
    clearTimeout(timer);
    timer = setTimeout(hide, props.duration);
  }
});

onBeforeUnmount(() => clearTimeout(timer));
</script>

<style scoped>
.base-toast {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
  max-width: 420px;
}
.base-toast--success { border-left: 4px solid var(--color-success); }
.base-toast--success i { color: var(--color-success); }
.base-toast--error { border-left: 4px solid var(--color-error); }
.base-toast--error i { color: var(--color-error); }
.base-toast--warning { border-left: 4px solid var(--color-warning); }
.base-toast--warning i { color: var(--color-warning); }
.base-toast--info { border-left: 4px solid var(--color-accent); }
.base-toast--info i { color: var(--color-accent); }
.base-toast__close {
  margin-left: auto;
  padding: 2px;
  color: var(--color-text-muted);
}
.toast-enter-active { transition: all 0.3s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(40px); }
.toast-leave-to { opacity: 0; transform: translateX(40px); }
</style>
