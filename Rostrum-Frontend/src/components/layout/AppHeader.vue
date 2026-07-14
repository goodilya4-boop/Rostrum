<template>
  <header class="app-header">
    <div class="app-header__container">
      <router-link to="/dashboard" class="app-header__logo">
        <i class="fa-solid fa-bullhorn"></i>
        <span class="app-header__logo-text">Трибуна</span>
        <span class="app-header__logo-sub">предзащита ВКР</span>
      </router-link>

      <nav class="app-header__nav">
        <router-link to="/dashboard" class="app-header__link" active-class="app-header__link--active">
          <i class="fa-solid fa-table-columns"></i>
          <span>Дашборд</span>
        </router-link>
        <router-link to="/presentations" class="app-header__link" active-class="app-header__link--active">
          <i class="fa-solid fa-file-powerpoint"></i>
          <span>Презентации</span>
        </router-link>
      </nav>

      <div class="app-header__actions">
        <button class="app-header__icon-btn" @click="themeStore.toggleTheme()" :title="themeStore.theme === 'light' ? 'Тёмная тема' : 'Светлая тема'">
          <i :class="themeStore.theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun'"></i>
        </button>

        <router-link to="/settings" class="app-header__icon-btn" title="Настройки">
          <i class="fa-solid fa-gear"></i>
        </router-link>

        <div class="app-header__user">
          <i class="fa-solid fa-circle-user"></i>
          <span>{{ authStore.user?.first_name || 'Пользователь' }}</span>
        </div>

        <button class="app-header__icon-btn" @click="handleLogout" title="Выйти">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const themeStore = useThemeStore();
const router = useRouter();

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.app-header {
  background: var(--color-header-bg);
  color: var(--color-header-text);
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
}
.app-header__container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 32px;
}
.app-header__logo {
  display: flex;
  align-items: baseline;
  gap: 8px;
  text-decoration: none;
  color: var(--color-header-text);
  flex-shrink: 0;
}
.app-header__logo i {
  font-size: 1.4rem;
}
.app-header__logo-text {
  font-family: var(--font-heading);
  font-size: var(--text-xl);
  font-weight: 700;
}
.app-header__logo-sub {
  font-size: var(--text-xs);
  opacity: 0.7;
}
.app-header__nav {
  display: flex;
  gap: 4px;
}
.app-header__link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  color: var(--color-header-text);
  opacity: 0.75;
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 500;
  transition: opacity var(--transition-fast), background var(--transition-fast);
}
.app-header__link:hover,
.app-header__link--active {
  opacity: 1;
  background: rgba(255,255,255,0.1);
}
.app-header__actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-header__icon-btn {
  padding: 8px;
  border-radius: var(--radius-md);
  color: var(--color-header-text);
  opacity: 0.75;
  transition: opacity var(--transition-fast), background var(--transition-fast);
  font-size: var(--text-lg);
}
.app-header__icon-btn:hover {
  opacity: 1;
  background: rgba(255,255,255,0.1);
}
.app-header__user {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-sm);
  opacity: 0.9;
}
.app-header__user i {
  font-size: var(--text-lg);
}
</style>