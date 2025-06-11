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
          path: 'buildinganalysis',
          name: 'building-analysis',
          component: BuildingViewer
        },
        {
          path: 'buildinganalysis/gebid=:gebid',
          name: 'building-analysis-gebid',
          component: BuildingViewer,
          props: true
        },
        {
          path: 'gebid=:gebid',
          name: 'gebid',
          redirect: to => {
            // Redirect old gebid routes to new buildinganalysis routes
            return `/buildinganalysis/gebid=${to.params.gebid}`
          }
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