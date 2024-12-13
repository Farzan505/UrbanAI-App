<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Router } from 'vue-router'
import { useRouter } from 'vue-router'
import ArcGISMap from '../../components/map/ArcGISMap.vue'
import { LineChart } from '@/components/ui/chart-line'

const router: Router = useRouter()
const activeTab = ref(0)

onMounted(() => {
  // Check if user is authenticated
  const token = localStorage.getItem('token')
  if (!token) {
    router.push('/login')
  }
})

// Growth rate data
const growthData = [
  { 'year': 1970, 'Export Growth Rate': 2.04, 'Import Growth Rate': 1.53 },
  { 'year': 1971, 'Export Growth Rate': 1.96, 'Import Growth Rate': 1.58 },
  { 'year': 1972, 'Export Growth Rate': 1.96, 'Import Growth Rate': 1.61 },
  { 'year': 1973, 'Export Growth Rate': 1.93, 'Import Growth Rate': 1.61 },
  { 'year': 1974, 'Export Growth Rate': 1.88, 'Import Growth Rate': 1.67 },
  { 'year': 1975, 'Export Growth Rate': 1.79, 'Import Growth Rate': 1.64 },
  // Single point data
  { 'year': 1976, 'Single Point': 1.85 }
]
</script>

<template>
  <div class="p-8 h-screen">
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-3xl font-bold">Dashboard</h1>
      </div>
      
      <div class="w-full">
        <div class="border-b border-gray-200">
          <nav class="flex space-x-8" aria-label="Tabs">
            <button
              v-for="(tab, index) in ['Map View', 'Analytics']"
              :key="index"
              @click="activeTab = index"
              :class="[
                activeTab === index
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              ]"
            >
              {{ tab }}
            </button>
          </nav>
        </div>

        <div class="mt-4 h-[calc(100vh-16rem)]">
          <!-- Map Tab -->
          <div v-if="activeTab === 0" class="h-full">
            <ArcGISMap />
          </div>

          <!-- Analytics Tab -->
          <div v-if="activeTab === 1" class="h-full">
            <div class="p-4 border rounded-lg bg-card">
              <h3 class="text-lg font-medium mb-4">Import/Export Growth Rates</h3>
              <LineChart
                :data="growthData"
                index="year"
                :categories="['Export Growth Rate', 'Import Growth Rate', 'Single Point']"
                class="h-[300px]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
