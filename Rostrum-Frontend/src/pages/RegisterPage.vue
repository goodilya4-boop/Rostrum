<template>
  <AuthLayout>
    <form class="auth-form" @submit.prevent="handleRegister">
      <h2 class="auth-form__title">Регистрация</h2>

      <BaseInput v-model="lastName" label="Фамилия" placeholder="Иванов" icon="fa-solid fa-user" :error="errors.lastName" />
      <BaseInput v-model="firstName" label="Имя" placeholder="Иван" icon="fa-solid fa-user" :error="errors.firstName" />
      <BaseInput v-model="middleName" label="Отчество (необязательно)" placeholder="Иванович" icon="fa-solid fa-user" />
      <BaseInput v-model="email" label="Email" type="email" placeholder="ivan@university.ru" icon="fa-solid fa-envelope" :error="errors.email" />
      <BaseInput v-model="password" label="Пароль" type="password" placeholder="Минимум 6 символов" icon="fa-solid fa-lock" :error="errors.password" />

      <p v-if="errors.general" class="auth-form__general-error">{{ errors.general }}</p>

      <BaseButton type="submit" variant="primary" :loading="authStore.loading" class="auth-form__submit">
        Зарегистрироваться
      </BaseButton>

      <p class="auth-form__switch">
        Уже есть аккаунт?
        <router-link to="/login">Войти</router-link>
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

const lastName = ref('');
const firstName = ref('');
const middleName = ref('');
const email = ref('');
const password = ref('');
const errors = reactive({ lastName: '', firstName: '', email: '', password: '', general: '' });

async function handleRegister() {
  errors.lastName = ''; errors.firstName = ''; errors.email = ''; errors.password = ''; errors.general = '';

  if (!lastName.value) { errors.lastName = 'Введите фамилию'; return; }
  if (!firstName.value) { errors.firstName = 'Введите имя'; return; }
  if (!email.value) { errors.email = 'Введите email'; return; }
  if (!password.value || password.value.length < 6) { errors.password = 'Минимум 6 символов'; return; }

  const result = await authStore.register({
    email: email.value,
    password: password.value,
    last_name: lastName.value,
    first_name: firstName.value,
    middle_name: middleName.value || undefined
  });

  if (result.success) {
    router.push('/dashboard');
  } else {
    errors.general = result.message;
  }
}
</script>

<style scoped>
.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-form__title { font-family: var(--font-heading); font-size: var(--text-xl); font-weight: 400; text-align: center; margin-bottom: 4px; }
.auth-form__general-error { font-size: var(--text-sm); color: var(--color-error); text-align: center; padding: 8px; background: rgba(194,106,106,0.08); border-radius: var(--radius-sm); }
.auth-form__submit { width: 100%; margin-top: 8px; }
.auth-form__switch { text-align: center; font-size: var(--text-sm); color: var(--color-text-muted); }
</style>