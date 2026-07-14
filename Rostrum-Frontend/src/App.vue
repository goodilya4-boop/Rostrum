<template>
  <div class="app-shell">
    <AppHeader v-if="authStore.isAuthenticated && !isAuthPage" />
    <main class="app-main" :class="{ 'app-main--auth': isAuthPage }">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <BaseToast
      :show="toastStore.visible"
      :message="toastStore.message"
      :type="toastStore.type"
      :duration="toastStore.duration"
      @update:show="value => !value && toastStore.hide()"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import AppHeader from '@/components/layout/AppHeader.vue';
import BaseToast from '@/components/ui/BaseToast.vue';
import { useToastStore } from '@/stores/toast.store';

const route = useRoute();
const authStore = useAuthStore();
const toastStore = useToastStore();

const isAuthPage = computed(() => ['Login', 'Register'].includes(route.name));
</script>

<style>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.app-main--auth {
  /* Страницы входа/регистрации сами управляют фоном */
}
</style>
