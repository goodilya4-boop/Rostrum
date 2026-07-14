<template>
  <div class="presentations-page">
    <div class="presentations-page__header">
      <h1>Мои презентации</h1>
      <BaseButton variant="primary" icon="fa-solid fa-upload" @click="$router.push('/presentations/upload')">
        Загрузить PPT
      </BaseButton>
    </div>

    <BaseSpinner v-if="store.loading && store.presentations.length === 0" text="Загрузка презентаций..." />

    <BaseCard v-else-if="store.presentations.length === 0">
      <div class="presentations-page__empty">
        <i class="fa-solid fa-file-powerpoint presentations-page__empty-icon"></i>
        <h2>Нет загруженных презентаций</h2>
        <p>Загрузите первую презентацию, чтобы начать репетицию.</p>
        <BaseButton variant="primary" icon="fa-solid fa-upload" @click="$router.push('/presentations/upload')">
          Загрузить PPT
        </BaseButton>
      </div>
    </BaseCard>

    <div v-else class="presentations-page__list">
      <PresentationCard
        v-for="pres in store.presentations"
        :key="pres.id"
        :presentation="pres"
        @click="$router.push(`/presentations/${pres.id}`)"
        @delete="handleDelete(pres)"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { usePresentationStore } from '@/stores/presentation.store';
import { useToastStore } from '@/stores/toast.store';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';
import PresentationCard from '@/components/presentation/PresentationCard.vue';

const store = usePresentationStore();
const toastStore = useToastStore();

onMounted(() => {
  store.fetchPresentations();
});

async function handleDelete(pres) {
  if (confirm(`Удалить презентацию «${pres.title}»? Это действие нельзя отменить.`)) {
    const result = await store.deletePresentation(pres.id);
    toastStore.notify(
      result.success ? 'Презентация удалена.' : result.message,
      result.success ? 'success' : 'error'
    );
  }
}
</script>

<style scoped>
.presentations-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.presentations-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.presentations-page__header h1 { font-size: var(--text-2xl); }
.presentations-page__empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--color-text-muted);
}
.presentations-page__empty-icon {
  font-size: 4rem;
  color: var(--color-accent);
  opacity: 0.3;
  margin-bottom: 16px;
  display: block;
}
.presentations-page__empty h2 {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}
.presentations-page__empty p { margin-bottom: 24px; }
.presentations-page__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
