<template>
  <AuthLayout show-guest>
    <form class="auth-form" @submit.prevent="handleLogin">
      <h2 class="auth-form__title">Вход в систему</h2>

      <BaseInput
        v-model="email"
        label="Email"
        type="email"
        placeholder="ivan@university.ru"
        icon="fa-solid fa-envelope"
        :error="errors.email"
      />

      <BaseInput
        v-model="password"
        label="Пароль"
        type="password"
        placeholder="••••••••"
        icon="fa-solid fa-lock"
        :error="errors.password"
      />

      <p v-if="errors.general" class="auth-form__general-error">{{ errors.general }}</p>

      <BaseButton type="submit" variant="primary" :loading="authStore.loading" class="auth-form__submit">
        Войти
      </BaseButton>

      <p class="auth-form__switch">
        Нет аккаунта?
        <router-link to="/register">Зарегистрироваться</router-link>
      </p>
    </form>
  </AuthLayout>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import AuthLayout from '@/components/layout/AuthLayout.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const errors = reactive({ email: '', password: '', general: '' });

async function handleLogin() {
  errors.email = '';
  errors.password = '';
  errors.general = '';

  if (!email.value) { errors.email = 'Введите email'; return; }
  if (!password.value) { errors.password = 'Введите пароль'; return; }

  const result = await authStore.login(email.value, password.value);

  if (result.success) {
    router.push('/dashboard');
  } else {
    errors.general = result.message;
  }
}
</script>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.auth-form__title {
  font-family: var(--font-heading);
  font-size: var(--text-xl);
  font-weight: 400;
  text-align: center;
  margin-bottom: 8px;
}
.auth-form__general-error {
  font-size: var(--text-sm);
  color: var(--color-error);
  text-align: center;
  padding: 8px;
  background: rgba(194, 106, 106, 0.08);
  border-radius: var(--radius-sm);
}
.auth-form__submit {
  width: 100%;
  margin-top: 8px;
}
.auth-form__switch {
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.auth-form__switch a {
  font-weight: 500;
}
</style>