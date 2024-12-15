<script setup lang="ts">
import { onMounted, ref, provide, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import ArcGISMap from '../../components/map/ArcGISMap.vue'
import GrowthRateChart from '../../components/GrowthRateChart.vue'
import DataTable from '../../components/DataTable.vue'
import DataBarChart from '../../components/DataBarChart.vue'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { colorMode } from '../../composables/useTheme'
import { useMapData } from '../../composables/useMapData'
import { createColumns } from '../../components/columns'
import Skeleton from '../../components/ui/skeleton/Skeleton.vue'

interface GeoJSONFeature {
  id: string
  type: "Feature"
  properties: Record<string, any>
  geometry: any
}

interface GeoJSONCollection {
  type: "FeatureCollection"
  features: GeoJSONFeature[]
  crs?: {
    type: string
    properties: Record<string, any>
  }
  bbox?: number[]
}

const router = useRouter()
const activeTab = ref(0)

// Store map data at dashboard level for persistence
const { mapData, error, loading: mapLoading, fetchMapData } = useMapData()
provide('mapData', mapData)
provide('colorMode', colorMode)

// Store filtered data for table and chart separately from map
const filteredTableData = ref<GeoJSONFeature[]>([])
const selectedColumn = ref('')
const chartLoading = ref(true)

// Sample growth rate data
const growthData = ref([
  {
    year: 2019,
    'Export Growth Rate': 2.5,
    'Import Growth Rate': 1.8,
    'singlePoint': 3.5,
  },
  {
    year: 2020,
    'Export Growth Rate': -5.3,
    'Import Growth Rate': -4.1,
  },
  {
    year: 2021,
    'Export Growth Rate': 8.2,
    'Import Growth Rate': 7.5,
  },
  {
    year: 2022,
    'Export Growth Rate': 4.1,
    'Import Growth Rate': 3.9,
  }
])

// Create columns configuration
const columns = computed(() => {
  if (!mapData.value?.features) return []
  return createColumns(mapData.value.features)
})

// Get column names for bar chart
const columnNames = computed(() => {
  if (!mapData.value?.features?.[0]) return []
  return Object.keys(mapData.value.features[0].properties)
})

// Initialize selected column with first available column
watch(columnNames, (newNames) => {
  if (newNames.length > 0 && !selectedColumn.value) {
    selectedColumn.value = newNames[0]
  }
}, { immediate: true })

// Prepare data for bar chart
const barChartData = computed(() => {
  const features = filteredTableData.value.length > 0 
    ? filteredTableData.value 
    : (mapData.value?.features || [])
  
  return features.map(feature => ({
    id: feature.id,
    ...feature.properties
  }))
})

onMounted(async () => {
  // Check if user is authenticated
  const token = localStorage.getItem('token')
  if (!token) {
    await router.push('/login')
    return
  }
  
  try {
    // Fetch map data if not already cached
    if (!mapData.value) {
      await fetchMapData()
    }
  } catch (err) {
    console.error('Error loading map data:', err)
  } finally {
    chartLoading.value = false
  }
})

// Handle filtered data updates for table only
function handleFilteredData(data: GeoJSONFeature[]) {
  if (!data) return
  filteredTableData.value = data
}

// Watch for map data changes and reset filtered data when map data changes
watch(mapData, () => {
  filteredTableData.value = []
}, { deep: true })
</script>

<template>
  <div class="hidden h-full flex-1 flex-col space-y-8 p-8 md:flex">
    <div class="flex items-center justify-between space-y-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p class="text-muted-foreground">
          Anzeigen und Analysie von GIS-Daten
        </p>
      </div>
    </div>

    <div class="flex-1 space-y-8">
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

      <!-- Map Tab -->
      <div v-if="activeTab === 0" class="space-y-8">
        <!-- Map Card -->
        <Card class="h-[calc(100vh-12rem)]">
          <CardContent class="p-0 h-full">
            <template v-if="mapLoading">
              <div class="flex items-center justify-center h-full">
                <div class="flex flex-col space-y-3">
                  <Skeleton class="h-[125px] w-[250px] rounded-xl" />
                  <div class="space-y-2">
                    <Skeleton class="h-4 w-[250px]" />
                    <Skeleton class="h-4 w-[200px]" />
                  </div>
                </div>
              </div>
            </template>
            <ArcGISMap 
              v-else-if="mapData"
              :data="mapData" 
            />
          </CardContent>
        </Card>
        
        <!-- Data Table Card -->
        <Card>
          <CardHeader>
            <CardTitle>Data Table</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable 
              v-if="mapData"
              :data="mapData.features"
              :columns="columns"
              @update:filteredData="handleFilteredData"
            />
            <template v-else>
              <div class="flex flex-col space-y-3">
                <Skeleton class="h-[125px] w-full rounded-xl" />
                <div class="space-y-2">
                  <Skeleton class="h-4 w-[250px]" />
                  <Skeleton class="h-4 w-[200px]" />
                </div>
              </div>
            </template>
          </CardContent>
        </Card>

        <!-- Bar Chart Card -->
        <Card>
          <CardHeader>
            <CardTitle>Data Visualization</CardTitle>
          </CardHeader>
          <CardContent class="h-[400px]">
            <DataBarChart
              v-if="mapData"
              :data="barChartData"
              :columns="columnNames"
              v-model:selectedColumn="selectedColumn"
              :loading="chartLoading"
            />
            <template v-else>
              <div class="flex flex-col space-y-3">
                <Skeleton class="h-[125px] w-full rounded-xl" />
                <div class="space-y-2">
                  <Skeleton class="h-4 w-[250px]" />
                  <Skeleton class="h-4 w-[200px]" />
                </div>
              </div>
            </template>
          </CardContent>
        </Card>
      </div>

      <!-- Analytics Tab -->
      <div v-if="activeTab === 1">
        <Card>
          <CardHeader>
            <CardTitle>Import/Export Growth Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <GrowthRateChart
              :data="growthData"
              class="h-[calc(100vh-24rem)] w-full"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.space-y-8 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 2rem;
}
</style>
