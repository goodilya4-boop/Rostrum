<template>
  <BaseCard clickable @click="$emit('click')">
    <div class="pres-card">
      <div class="pres-card__icon">
        <i class="fa-solid fa-file-powerpoint"></i>
      </div>
      <div class="pres-card__info">
        <h3 class="pres-card__title">{{ presentation.title }}</h3>
        <p class="pres-card__meta">
          {{ presentation.slide_count || 0 }} слайдов
          <span v-if="presentation.created_at"> • {{ formatDate(presentation.created_at) }}</span>
        </p>
      </div>
      <div class="pres-card__actions">
        <button
          class="pres-card__action-btn"
          @click.stop="$emit('delete')"
          title="Удалить презентацию"
        >
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  </BaseCard>
</template>

<script setup>
import BaseCard from '@/components/ui/BaseCard.vue';

defineProps({
  presentation: { type: Object, required: true }
});

defineEmits(['click', 'delete']);

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
</script>

<style scoped>
.pres-card {
  display: flex;
  align-items: center;
  gap: 16px;
}
.pres-card__icon {
  font-size: 2rem;
  color: var(--color-accent);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-light);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}
.pres-card__info { flex: 1; min-width: 0; }
.pres-card__title {
  font-family: var(--font-body);
  font-size: var(--text-base);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pres-card__meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: 4px;
}
.pres-card__actions { flex-shrink: 0; }
.pres-card__action-btn {
  padding: 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: color var(--transition-fast), background var(--transition-fast);
}
.pres-card__action-btn:hover {
  color: var(--color-error);
  background: rgba(194,106,106,0.1);
}
</style>