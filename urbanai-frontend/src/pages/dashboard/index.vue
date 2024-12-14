<script setup lang="ts">
import { onMounted, ref, provide, shallowRef } from 'vue'
import type { Router } from 'vue-router'
import { useRouter } from 'vue-router'
import ArcGISMap from '../../components/map/ArcGISMap.vue'
import { LineChart } from '@/components/ui/chart-line'
import { colorMode } from '@/composables/useTheme'

const router: Router = useRouter()
const activeTab = ref(0)

// Store map data at dashboard level for persistence
const mapData = shallowRef(null)
provide('mapData', mapData)
provide('colorMode', colorMode)

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
  { 'year': 1976, 'Single Point': 1.85 },
  { 'year': 1977}
]
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <div class="p-8 flex-1 min-h-0">
      <div class="flex flex-col h-full gap-6">
        <div>
          <h1 class="text-3xl font-bold">Dashboard</h1>
        </div>
        
        <div class="flex-1 min-h-0">
          <div class="border-b border-gray-200">
            <nav class="flex space-x-8" aria-label="Tabs">
              <button
                v-for="(tab, index) in ['Übersicht', 'Analyse']"
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

          <div class="mt-4 h-[calc(100%-4rem)]">
            <!-- Map Tab -->
            <div v-if="activeTab === 0" class="h-full">
              <ArcGISMap />
            </div>

            <!-- Analytics Tab -->
            <div v-if="activeTab === 1" class="h-full">
              <div class="h-full p-4 border rounded-lg bg-card flex flex-col">
                <h3 class="text-lg font-medium mb-4">Import/Export Growth Rates</h3>
                <div class="flex-1 min-h-0">
                  <LineChart
                    :data="growthData"
                    index="year"
                    :categories="['Export Growth Rate', 'Import Growth Rate', 'Single Point']"
                    class="h-full w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
