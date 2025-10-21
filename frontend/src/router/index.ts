import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
// import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    redirect: '/conversations',
  },
  {
    path: '/conversations',
    name: 'Conversations',
    component: () => import('@/views/Conversations.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/teams',
    name: 'Teams',
    component: () => import('@/views/Teams.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/knowledge-base',
    name: 'KnowledgeBase',
    component: () => import('@/views/KnowledgeBase.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/conversations/:id',
    name: 'ConversationDetail',
    component: () => import('@/views/ConversationDetail.vue'),
    meta: { requiresAuth: true },
    props: true,
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/Admin.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((_to, _from, next) => {
  // Auth disabled for demo
  next()

  /* const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)

  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (requiresAdmin && authStore.user?.role !== 'admin') {
    next({ name: 'Dashboard' })
  } else if (to.name === 'Login' && authStore.isAuthenticated) {
    next({ name: 'Dashboard' })
  } else {
    next()
  } */
})

export default router
