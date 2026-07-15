import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './assets/styles/global.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);

// Загружаем выбранную тему
import { useThemeStore } from '@/stores/theme.store';
useThemeStore();

// Проверяем, вошёл ли пользователь
import { useAuthStore } from '@/stores/auth.store';
const authStore = useAuthStore();
authStore.fetchUser();

app.mount('#app');
