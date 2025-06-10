import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import BuildingViewer from '@/components/BuildingViewer.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: BuildingViewer
        },
        {
          path: 'gebid=:gebid',
          name: 'gebid',
          component: BuildingViewer,
          props: true
        }
      ]
    }
  ]
})

export default router 