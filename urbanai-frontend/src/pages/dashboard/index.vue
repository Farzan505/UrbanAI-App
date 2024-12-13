<script setup lang="ts">
import { onMounted } from 'vue'
import type { Router } from 'vue-router'
import { useRouter } from 'vue-router'
import ArcGISMap from '../../components/map/ArcGISMap.vue'

const router: Router = useRouter()

onMounted(() => {
  // Check if user is authenticated
  const token = localStorage.getItem('token')
  if (!token) {
    router.push('/login')
  }
})
</script>

<template>
  <div class="p-8 h-screen">
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-3xl font-bold">Dashboard</h1>
      </div>
      
      <!-- Map Container with proper height -->
      <div class="h-[calc(100vh-12rem)]">
        <ArcGISMap />
      </div>
    </div>
  </div>
</template>
