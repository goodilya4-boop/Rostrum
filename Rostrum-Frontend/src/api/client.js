import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import router from '@/router';
import { useToastStore } from '@/stores/toast.store';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const apiClient = axios.create({
  baseURL: configuredBaseUrl || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
});

apiClient.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const toastStore = useToastStore();
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      if (router.currentRoute.value.name !== 'Login') {
        toastStore.notify('Сессия истекла. Войдите снова.', 'warning');
        router.push('/login');
      }
    } else if (!error.response) {
      toastStore.notify('Backend недоступен. Проверьте подключение к серверу.', 'error');
    } else if (error.response.status === 403) {
      toastStore.notify('Недостаточно прав для выполнения операции.', 'error');
    } else if (error.response.status === 429) {
      toastStore.notify('Слишком много запросов. Повторите позже.', 'warning');
    } else if (error.response.status >= 500) {
      toastStore.notify(
        error.response.data?.error?.message || 'Внутренняя ошибка сервера.',
        'error'
      );
    }
    return Promise.reject(error);
  }
);

export default apiClient;
