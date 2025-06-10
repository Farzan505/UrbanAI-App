import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/layouts/AppLayout.vue'
import BuildingViewer from '@/pages/BuildingViewer.vue'
import DataSources from '@/pages/DataSources.vue'

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
        },
        {
          path: 'data-sources',
          name: 'data-sources',
          component: DataSources
        }
      ]
    }
  ]
})

export default router 