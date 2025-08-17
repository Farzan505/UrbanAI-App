import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import BuildingViewer from '@/pages/BuildingViewer.vue'
import MapViewer from '@/pages/MapViewer.vue'
import LoginPage from '@/pages/LoginPage.vue'

// Check if user is authenticated
function isAuthenticated() {
  const token = localStorage.getItem('decotwo_token')
  const user = localStorage.getItem('decotwo_user')
  
  console.log('Auth check:', { 
    hasToken: !!token, 
    tokenLength: token?.length || 0,
    hasUser: !!user, 
    userValue: user,
    userIsUndefined: user === 'undefined'
  })
  
  if (!token || !user || user === 'undefined') {
    return false
  }
  
  try {
    const parsedUser = JSON.parse(user)
    const isValid = parsedUser && typeof parsedUser === 'object' && parsedUser.id
    console.log('Parsed user:', parsedUser, 'isValid:', isValid)
    return isValid
  } catch (err) {
    console.error('Error parsing user data:', err)
    return false
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { requiresGuest: true }
    },
    {
      path: '/',
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          redirect: '/gebaudeanalyse'
        },
        {
          path: 'gebaudeanalyse',
          name: 'gebaudeanalyse',
          component: BuildingViewer
        },
        {
          path: 'gebaudeanalyse/gmlid=:gmlid',
          name: 'gebaudeanalyse-gmlid',
          component: BuildingViewer,
          props: true
        },
        {
          path: 'karte',
          name: 'karte',
          component: MapViewer
        }
      ]
    }
  ]
})

// Route guards
router.beforeEach((to, _from, next) => {
  const authenticated = isAuthenticated()
  
  console.log('Route guard:', { 
    to: to.path, 
    authenticated, 
    token: !!localStorage.getItem('decotwo_token'),
    user: localStorage.getItem('decotwo_user')
  })

  if (to.meta.requiresAuth && !authenticated) {
    // Redirect to login if route requires auth and user is not authenticated
    console.log('Redirecting to login - not authenticated')
    next('/login')
  } else if (to.meta.requiresGuest && authenticated) {
    // Redirect to app if route is for guests only and user is authenticated
    console.log('Redirecting to app - already authenticated')
    next('/')
  } else {
    next()
  }
})

export default router 