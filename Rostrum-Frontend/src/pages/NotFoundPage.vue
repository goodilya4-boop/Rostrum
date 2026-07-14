<template>
  <div class="placeholder-page">
    <h1>404</h1>
    <p>Страница не найдена.</p>
    <router-link to="/dashboard">Вернуться на дашборд</router-link>
  </div>
</template>

<style scoped>
.placeholder-page {
  max-width: 800px;
  margin: 60px auto;
  padding: 0 24px;
  text-align: center;
}
.placeholder-page h1 {
  font-size: 4rem;
  margin-bottom: 16px;
}
</style>