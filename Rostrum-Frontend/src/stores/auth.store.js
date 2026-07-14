import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authAPI } from '@/api/auth.api';
import { useThemeStore } from '@/stores/theme.store';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const token = ref(localStorage.getItem('token') || null);
  const loading = ref(false);

  const isAuthenticated = computed(() => !!token.value);

  function updateUser(nextUser) {
    user.value = nextUser || null;
    const preferredTheme = nextUser?.settings_json?.theme;
    if (preferredTheme === 'light' || preferredTheme === 'dark') {
      useThemeStore().setTheme(preferredTheme);
    }
  }

  async function login(email, password) {
    loading.value = true;
    try {
      const res = await authAPI.login({ email, password });
      token.value = res.data.token;
      updateUser(res.data.user);
      localStorage.setItem('token', token.value);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Ошибка входа';
      return { success: false, message };
    } finally {
      loading.value = false;
    }
  }

  async function register(data) {
    loading.value = true;
    try {
      const res = await authAPI.register(data);
      token.value = res.data.token;
      updateUser(res.data.user);
      localStorage.setItem('token', token.value);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Ошибка регистрации';
      return { success: false, message };
    } finally {
      loading.value = false;
    }
  }

  async function fetchUser() {
    if (!token.value) return;
    try {
      const res = await authAPI.getMe();
      updateUser(res.data.user);
      return user.value;
    } catch (error) {
      logout();
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    localStorage.removeItem('token');
  }

  return { user, token, loading, isAuthenticated, login, register, fetchUser, updateUser, logout };
});
