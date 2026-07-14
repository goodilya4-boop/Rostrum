import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
  const visible = ref(false);
  const message = ref('');
  const type = ref('info');
  const duration = ref(4000);

  function notify(text, notificationType = 'info', notificationDuration = 4000) {
    message.value = text;
    type.value = notificationType;
    duration.value = notificationDuration;
    // Re-trigger the transition and timer when a new notification replaces an active one.
    visible.value = false;
    queueMicrotask(() => {
      visible.value = true;
    });
  }

  function hide() {
    visible.value = false;
  }

  return { visible, message, type, duration, notify, hide };
});
