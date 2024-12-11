import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue')
    },
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/dashboard',
      component: () => import('@/layouts/DashboardLayout.vue'), 
      meta: { requiresAuth: true },
      children: [
        {
          path: '', // this will be /dashboard
          name: 'dashboard',
          component: () => import('@/pages/dashboard/index.vue'),
          meta: { requiresAuth: true }
        }
      ]
    }
  ]
})

// Navigation guard
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
