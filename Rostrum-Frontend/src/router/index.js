import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/pages/RegisterPage.vue'),
    meta: { guest: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/pages/DashboardPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/presentations',
    name: 'Presentations',
    component: () => import('@/pages/PresentationsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/presentations/upload',
    name: 'UploadPresentation',
    component: () => import('@/pages/UploadPresentationPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/presentations/:id',
    name: 'PresentationDetail',
    component: () => import('@/pages/PresentationDetailPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/session/new',
    name: 'SessionSetup',
    component: () => import('@/pages/SessionSetupPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/session/:id/rehearsal',
    name: 'SessionRehearsal',
    component: () => import('@/pages/SessionRehearsalPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/session/:id/results',
    name: 'SessionResults',
    component: () => import('@/pages/SessionResultsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/pages/SettingsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/NotFoundPage.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next('/login');
  }

  if (to.meta.guest && authStore.isAuthenticated) {
    return next('/dashboard');
  }

  next();
});

export default router;
