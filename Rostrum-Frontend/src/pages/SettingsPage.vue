<template>
  <div class="settings-page">
    <header class="settings-page__header">
      <div>
        <p>Личный кабинет</p>
        <h1>Настройки</h1>
        <span>Профиль и параметры новых репетиций</span>
      </div>
    </header>

    <div v-if="loading" class="settings-page__loading">
      <BaseSpinner text="Загрузка настроек..." />
    </div>

    <BaseCard v-else-if="loadError" class="settings-page__error-card">
      <div class="settings-page__state" role="alert">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <h2>Не удалось загрузить настройки</h2>
        <p>{{ loadError }}</p>
        <BaseButton variant="secondary" icon="fa-solid fa-rotate-right" @click="loadSettings">
          Повторить
        </BaseButton>
      </div>
    </BaseCard>

    <div v-else class="settings-page__layout">
      <aside class="settings-page__summary">
        <div class="settings-page__avatar">{{ initials }}</div>
        <strong>{{ fullName }}</strong>
        <span>{{ profile.email }}</span>
        <div class="settings-page__account-meta">
          <i class="fa-solid fa-calendar-check"></i>
          Зарегистрирован {{ formatDate(profile.created_at) }}
        </div>
      </aside>

      <main class="settings-page__content">
        <form @submit.prevent="saveSettings">
          <BaseCard>
            <template #header>
              <div class="settings-page__section-heading">
                <i class="fa-solid fa-user"></i>
                <div>
                  <h2>Профиль</h2>
                  <p>Email используется для входа и не изменяется здесь.</p>
                </div>
              </div>
            </template>

            <div class="settings-page__fields">
              <BaseInput
                v-model="form.lastName"
                label="Фамилия"
                icon="fa-solid fa-user"
                placeholder="Иванов"
                :error="errors.lastName"
              />
              <BaseInput
                v-model="form.firstName"
                label="Имя"
                icon="fa-solid fa-user"
                placeholder="Иван"
                :error="errors.firstName"
              />
              <BaseInput
                v-model="form.middleName"
                label="Отчество"
                icon="fa-solid fa-user"
                placeholder="Необязательно"
                :error="errors.middleName"
              />
              <BaseInput
                :model-value="profile.email"
                label="Email"
                type="email"
                icon="fa-solid fa-envelope"
                disabled
              />
            </div>
          </BaseCard>

          <BaseCard>
            <template #header>
              <div class="settings-page__section-heading">
                <i class="fa-solid fa-microphone-lines"></i>
                <div>
                  <h2>Новая репетиция</h2>
                  <p>Эти значения автоматически подставляются на экране создания сессии.</p>
                </div>
              </div>
            </template>

            <div class="settings-page__rehearsal">
              <div class="settings-page__field">
                <label for="default-time">Регламент по умолчанию</label>
                <div class="settings-page__number-input" :class="{ 'settings-page__number-input--error': errors.defaultTime }">
                  <input id="default-time" v-model.number="form.defaultTimeMinutes" type="number" min="1" max="30" step="1" />
                  <span>минут</span>
                </div>
                <p v-if="errors.defaultTime" class="settings-page__field-error">{{ errors.defaultTime }}</p>
                <p v-else>Допустимое значение: от 1 до 30 минут.</p>
              </div>

              <fieldset class="settings-page__field">
                <legend>Распознавание речи по умолчанию</legend>
                <div class="settings-page__engine-options">
                  <label :class="{ 'settings-page__choice--active': !form.preferOfflineAsr }">
                    <input v-model="form.preferOfflineAsr" type="radio" :value="false" />
                    <i class="fa-solid fa-cloud"></i>
                    <span><strong>Web Speech</strong><small>Встроенное распознавание браузера</small></span>
                  </label>
                  <label
                    :class="{
                      'settings-page__choice--active': form.preferOfflineAsr,
                      'settings-page__choice--disabled': !voskAvailable,
                    }"
                  >
                    <input v-model="form.preferOfflineAsr" type="radio" :value="true" :disabled="!voskAvailable" />
                    <i class="fa-solid fa-server"></i>
                    <span>
                      <strong>Vosk</strong>
                      <small>{{ voskInDevelopment ? 'В разработке' : (voskAvailable ? 'Локальное распознавание' : 'Недоступен') }}</small>
                    </span>
                  </label>
                </div>
              </fieldset>
            </div>
          </BaseCard>

          <BaseCard>
            <template #header>
              <div class="settings-page__section-heading">
                <i class="fa-solid fa-palette"></i>
                <div>
                  <h2>Оформление</h2>
                  <p>Тема применяется сразу и сохраняется для следующих входов.</p>
                </div>
              </div>
            </template>

            <div class="settings-page__theme-options">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                type="button"
                :class="{ 'settings-page__theme--active': form.theme === option.value }"
                @click="selectTheme(option.value)"
              >
                <span :class="`settings-page__theme-preview--${option.value}`">
                  <i :class="option.icon"></i>
                </span>
                <strong>{{ option.label }}</strong>
                <i v-if="form.theme === option.value" class="fa-solid fa-circle-check"></i>
              </button>
            </div>
          </BaseCard>

          <div v-if="saveError" class="settings-page__form-error" role="alert">
            <i class="fa-solid fa-circle-exclamation"></i>{{ saveError }}
          </div>
          <div class="settings-page__save-row">
            <span v-if="savedAt"><i class="fa-solid fa-check"></i> Сохранено {{ savedAt }}</span>
            <BaseButton type="submit" icon="fa-solid fa-floppy-disk" :loading="saving">
              Сохранить настройки
            </BaseButton>
          </div>
        </form>

        <form @submit.prevent="changePassword">
          <BaseCard>
            <template #header>
              <div class="settings-page__section-heading">
                <i class="fa-solid fa-shield-halved"></i>
                <div>
                  <h2>Безопасность</h2>
                  <p>После смены используйте новый пароль при следующем входе.</p>
                </div>
              </div>
            </template>

            <div class="settings-page__password-fields">
              <BaseInput
                v-model="password.current"
                label="Текущий пароль"
                type="password"
                icon="fa-solid fa-lock"
                autocomplete="current-password"
                :error="passwordErrors.current"
              />
              <BaseInput
                v-model="password.next"
                label="Новый пароль"
                type="password"
                icon="fa-solid fa-key"
                placeholder="Минимум 8 символов"
                autocomplete="new-password"
                :error="passwordErrors.next"
              />
              <BaseInput
                v-model="password.confirmation"
                label="Повторите новый пароль"
                type="password"
                icon="fa-solid fa-key"
                autocomplete="new-password"
                :error="passwordErrors.confirmation"
              />
            </div>
            <div v-if="passwordError" class="settings-page__form-error" role="alert">
              <i class="fa-solid fa-circle-exclamation"></i>{{ passwordError }}
            </div>
            <div class="settings-page__save-row">
              <span></span>
              <BaseButton type="submit" variant="secondary" icon="fa-solid fa-key" :loading="changingPassword">
                Изменить пароль
              </BaseButton>
            </div>
          </BaseCard>
        </form>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { usersAPI } from '@/api/users.api';
import { useAuthStore } from '@/stores/auth.store';
import { useSessionStore } from '@/stores/session.store';
import { useThemeStore } from '@/stores/theme.store';
import { useToastStore } from '@/stores/toast.store';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSpinner from '@/components/ui/BaseSpinner.vue';

const authStore = useAuthStore();
const sessionStore = useSessionStore();
const themeStore = useThemeStore();
const toastStore = useToastStore();

const loading = ref(true);
const saving = ref(false);
const changingPassword = ref(false);
const loadError = ref('');
const saveError = ref('');
const passwordError = ref('');
const savedAt = ref('');
const profile = ref({});

const form = reactive({
  lastName: '',
  firstName: '',
  middleName: '',
  defaultTimeMinutes: 7,
  preferOfflineAsr: false,
  theme: themeStore.theme,
});
const errors = reactive({ lastName: '', firstName: '', middleName: '', defaultTime: '' });
const password = reactive({ current: '', next: '', confirmation: '' });
const passwordErrors = reactive({ current: '', next: '', confirmation: '' });
const themeOptions = [
  { value: 'light', label: 'Светлая', icon: 'fa-solid fa-sun' },
  { value: 'dark', label: 'Тёмная', icon: 'fa-solid fa-moon' },
];

const voskAvailable = computed(() => Boolean(sessionStore.capabilities?.engines?.vosk?.available));
const voskInDevelopment = computed(() => sessionStore.capabilities?.engines?.vosk?.status === 'development');
const fullName = computed(() => [profile.value.last_name, profile.value.first_name, profile.value.middle_name].filter(Boolean).join(' ') || 'Пользователь');
const initials = computed(() => `${profile.value.first_name?.[0] || ''}${profile.value.last_name?.[0] || ''}`.toUpperCase() || 'П');

onMounted(loadSettings);

async function loadSettings() {
  loading.value = true;
  loadError.value = '';
  try {
    if (!authStore.user?.id) await authStore.fetchUser();
    if (!authStore.user?.id) throw new Error('Не удалось определить текущего пользователя');
    const [{ data }] = await Promise.all([
      usersAPI.getProfile(authStore.user.id),
      sessionStore.fetchCapabilities(),
    ]);
    applyProfile(data.user);
  } catch (error) {
    loadError.value = getErrorMessage(error, 'Не удалось загрузить профиль');
  } finally {
    loading.value = false;
  }
}

function applyProfile(user) {
  profile.value = user || {};
  authStore.updateUser(user);
  form.lastName = user?.last_name || '';
  form.firstName = user?.first_name || '';
  form.middleName = user?.middle_name || '';
  form.defaultTimeMinutes = Math.round((Number(user?.default_time_limit) || 420) / 60);
  form.preferOfflineAsr = Boolean(user?.prefer_offline_asr);
  form.theme = ['light', 'dark'].includes(user?.settings_json?.theme)
    ? user.settings_json.theme
    : themeStore.theme;
  themeStore.setTheme(form.theme);
}

function validateSettings() {
  errors.lastName = form.lastName.trim() ? '' : 'Введите фамилию';
  errors.firstName = form.firstName.trim() ? '' : 'Введите имя';
  errors.middleName = form.middleName.trim().length <= 100 ? '' : 'Не более 100 символов';
  const minutes = Number(form.defaultTimeMinutes);
  errors.defaultTime = Number.isInteger(minutes) && minutes >= 1 && minutes <= 30
    ? ''
    : 'Укажите целое число от 1 до 30';
  return !Object.values(errors).some(Boolean);
}

async function saveSettings() {
  saveError.value = '';
  savedAt.value = '';
  if (!validateSettings()) return;
  saving.value = true;
  try {
    const settingsJson = { ...(profile.value.settings_json || {}), theme: form.theme };
    const { data } = await usersAPI.updateProfile(profile.value.id, {
      last_name: form.lastName.trim(),
      first_name: form.firstName.trim(),
      middle_name: form.middleName.trim() || null,
      default_time_limit: Number(form.defaultTimeMinutes) * 60,
      prefer_offline_asr: Boolean(form.preferOfflineAsr),
      settings_json: settingsJson,
    });
    applyProfile(data.user);
    savedAt.value = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    toastStore.notify('Настройки сохранены.', 'success');
  } catch (error) {
    saveError.value = getErrorMessage(error, 'Не удалось сохранить настройки');
  } finally {
    saving.value = false;
  }
}

function selectTheme(theme) {
  form.theme = theme;
  themeStore.setTheme(theme);
}

function validatePassword() {
  passwordErrors.current = password.current ? '' : 'Введите текущий пароль';
  passwordErrors.next = password.next.length >= 8 && password.next.length <= 128
    ? ''
    : 'Пароль должен содержать от 8 до 128 символов';
  if (!password.confirmation) passwordErrors.confirmation = 'Повторите новый пароль';
  else if (password.confirmation !== password.next) passwordErrors.confirmation = 'Пароли не совпадают';
  else passwordErrors.confirmation = '';
  return !Object.values(passwordErrors).some(Boolean);
}

async function changePassword() {
  passwordError.value = '';
  if (!validatePassword()) return;
  changingPassword.value = true;
  try {
    await usersAPI.changePassword(profile.value.id, password.current, password.next);
    password.current = '';
    password.next = '';
    password.confirmation = '';
    toastStore.notify('Пароль успешно изменён.', 'success');
  } catch (error) {
    passwordError.value = getErrorMessage(error, 'Не удалось изменить пароль');
  } finally {
    changingPassword.value = false;
  }
}

function getErrorMessage(error, fallback) {
  const validation = error.response?.data?.error?.errors?.[0]?.msg;
  return validation || error.response?.data?.error?.message || error.message || fallback;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}
</script>

<style scoped>
.settings-page { width: 100%; max-width: 1180px; margin: 0 auto; padding: 32px 24px 56px; }
.settings-page__header { margin-bottom: 24px; }
.settings-page__header p { color: var(--color-accent); font-size: var(--text-xs); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.settings-page__header h1 { margin: 4px 0; font-size: var(--text-3xl); }
.settings-page__header span { color: var(--color-text-muted); font-size: var(--text-sm); }
.settings-page__loading { display: grid; min-height: 55vh; place-items: center; }
.settings-page__error-card { max-width: 650px; margin: 40px auto; }
.settings-page__state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 24px; text-align: center; }
.settings-page__state > i { color: var(--color-error); font-size: 2.5rem; }
.settings-page__state p { color: var(--color-text-muted); }
.settings-page__layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px; align-items: start; }
.settings-page__summary { position: sticky; top: 88px; display: flex; flex-direction: column; align-items: center; padding: 26px 18px; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); text-align: center; }
.settings-page__avatar { display: grid; width: 76px; height: 76px; margin-bottom: 14px; color: var(--color-text-inverse); background: var(--color-accent); border-radius: 50%; font-family: var(--font-heading); font-size: var(--text-2xl); place-items: center; }
.settings-page__summary strong { line-height: 1.4; }
.settings-page__summary > span { max-width: 100%; margin-top: 4px; overflow: hidden; color: var(--color-text-muted); font-size: var(--text-xs); text-overflow: ellipsis; }
.settings-page__account-meta { display: flex; gap: 7px; align-items: flex-start; width: 100%; margin-top: 20px; padding-top: 16px; color: var(--color-text-muted); border-top: 1px solid var(--color-border); font-size: var(--text-xs); line-height: 1.45; text-align: left; }
.settings-page__content, .settings-page__content form { display: flex; flex-direction: column; gap: 20px; }
.settings-page__section-heading { display: flex; gap: 12px; align-items: flex-start; }
.settings-page__section-heading > i { display: grid; flex: 0 0 38px; width: 38px; height: 38px; color: var(--color-accent); background: var(--color-accent-light); border-radius: var(--radius-md); place-items: center; }
.settings-page__section-heading h2 { font-family: var(--font-body); font-size: var(--text-lg); }
.settings-page__section-heading p { margin-top: 3px; color: var(--color-text-muted); font-size: var(--text-xs); line-height: 1.4; }
.settings-page__fields { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.settings-page__rehearsal { display: grid; grid-template-columns: .7fr 1.3fr; gap: 28px; }
.settings-page__field { min-width: 0; border: 0; }
.settings-page__field > label, .settings-page__field > legend { display: block; margin-bottom: 7px; color: var(--color-text); font-size: var(--text-sm); font-weight: 500; }
.settings-page__field > p { margin-top: 6px; color: var(--color-text-muted); font-size: var(--text-xs); }
.settings-page__field .settings-page__field-error { color: var(--color-error); }
.settings-page__number-input { display: flex; align-items: center; overflow: hidden; background: var(--color-input-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.settings-page__number-input:focus-within { border-color: var(--color-input-focus); box-shadow: 0 0 0 3px var(--color-accent-light); }
.settings-page__number-input--error { border-color: var(--color-error); }
.settings-page__number-input input { min-width: 0; flex: 1; padding: 12px 14px; color: var(--color-text); background: transparent; border: 0; outline: 0; font-size: var(--text-base); }
.settings-page__number-input span { padding: 12px 14px; color: var(--color-text-muted); background: var(--color-surface-hover); font-size: var(--text-sm); }
.settings-page__engine-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.settings-page__engine-options label { display: flex; gap: 11px; align-items: center; padding: 13px; border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; transition: border-color var(--transition-fast), background var(--transition-fast); }
.settings-page__engine-options input { position: absolute; opacity: 0; pointer-events: none; }
.settings-page__engine-options label > i { color: var(--color-text-muted); font-size: var(--text-lg); }
.settings-page__engine-options span { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
.settings-page__engine-options small { color: var(--color-text-muted); font-size: var(--text-xs); }
.settings-page__engine-options .settings-page__choice--active { background: var(--color-accent-light); border-color: var(--color-accent); }
.settings-page__choice--active > i { color: var(--color-accent) !important; }
.settings-page__engine-options .settings-page__choice--disabled { cursor: not-allowed; opacity: .55; }
.settings-page__theme-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.settings-page__theme-options button { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; padding: 13px; color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); text-align: left; }
.settings-page__theme-options button:hover, .settings-page__theme-options .settings-page__theme--active { border-color: var(--color-accent); background: var(--color-accent-light); }
.settings-page__theme-options button > i { color: var(--color-accent); }
.settings-page__theme-options button > span { display: grid; width: 44px; height: 34px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); place-items: center; }
.settings-page__theme-preview--light { color: #1e3a5f; background: #f9f8f6; }
.settings-page__theme-preview--dark { color: #d4a853; background: #282930; }
.settings-page__form-error { display: flex; gap: 8px; align-items: center; padding: 11px 14px; color: var(--color-error); background: color-mix(in srgb, var(--color-error) 10%, transparent); border-radius: var(--radius-md); font-size: var(--text-sm); }
.settings-page__save-row { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
.settings-page__save-row > span { color: var(--color-success); font-size: var(--text-xs); }
.settings-page__password-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
@media (max-width: 900px) {
  .settings-page__layout { grid-template-columns: 1fr; }
  .settings-page__summary { position: static; display: grid; grid-template-columns: auto 1fr; column-gap: 14px; text-align: left; }
  .settings-page__avatar { grid-row: 1 / 4; margin: 0; }
  .settings-page__account-meta { grid-column: 1 / -1; }
  .settings-page__password-fields { grid-template-columns: 1fr; }
}
@media (max-width: 650px) {
  .settings-page { padding: 22px 12px 40px; }
  .settings-page__fields, .settings-page__rehearsal, .settings-page__theme-options { grid-template-columns: 1fr; }
  .settings-page__engine-options { grid-template-columns: 1fr; }
  .settings-page__save-row { align-items: stretch; flex-direction: column; }
  .settings-page__save-row :deep(.base-button) { width: 100%; }
}
</style>
