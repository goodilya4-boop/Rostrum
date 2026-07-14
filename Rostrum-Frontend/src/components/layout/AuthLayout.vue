<template>
  <div class="auth-layout">
    <div class="auth-layout__card">
      <div class="auth-layout__logo">
        <i class="fa-solid fa-bullhorn"></i>
        <h1>Трибуна</h1>
        <p>предзащита ВКР</p>
      </div>
      <slot />
      <div v-if="showGuest" class="auth-layout__guest">
        <router-link to="/dashboard">
          <i class="fa-solid fa-users"></i>
          Попробовать без регистрации
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  showGuest: { type: Boolean, default: false }
});
</script>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-bg);
}
.auth-layout__card {
  width: 100%;
  max-width: 440px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 40px 36px;
}
.auth-layout__logo {
  text-align: center;
  margin-bottom: 32px;
}
.auth-layout__logo i {
  font-size: 2.5rem;
  color: var(--color-accent);
  margin-bottom: 12px;
}
.auth-layout__logo h1 {
  font-family: var(--font-heading);
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 4px;
}
.auth-layout__logo p {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.auth-layout__guest {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
  text-align: center;
}
.auth-layout__guest a {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
}
.auth-layout__guest a:hover {
  color: var(--color-accent);
}
</style>