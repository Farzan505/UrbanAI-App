<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import DataBarChart from '@/components/DataBarChart.vue'

// Reactive variables
const selectedDataSource = ref('')
const selectedDatasets = ref<string[]>([])
const dataSources = ref<any[]>([])
const dataSourcesLoading = ref(false)
const dataSourcesError = ref('')
const retrievedData = ref<any>(null)
const availableDatasets = ref<any[]>([])
const dataLoading = ref(false)
const dataError = ref('')
const apiBaseUrl = ref('http://localhost:8080')

// Interfaces
interface DataSource {
  id: string
  name: string
  description?: string
  [key: string]: any
}

interface Dataset {
  id: string
  name: string
  metadata: any
  type: 'table' | 'chart'
}

interface RetrievedDataResponse {
  data_source: string
  data: {
    [key: string]: {
      metadata: {
        description_en?: string
        description_de?: string
        type: 'table' | 'chart'
        [key: string]: any
      }
      data: any
    }
  }
}

// Fetch data sources list
const fetchDataSources = async () => {
  dataSourcesLoading.value = true
  dataSourcesError.value = ''
  
  try {
    const response = await fetch(`${apiBaseUrl.value}/api/sources/data/list/`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Data sources response:', data)
    
    // Handle the API response structure - it returns available_data_sources array
    if (data.available_data_sources && Array.isArray(data.available_data_sources)) {
      dataSources.value = data.available_data_sources.map(source => ({
        id: source,
        name: source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }))
    } else {
      dataSources.value = data.data || data || []
    }
    
  } catch (err) {
    dataSourcesError.value = `Failed to fetch data sources: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Data sources fetch error:', err)
  } finally {
    dataSourcesLoading.value = false
  }
}

// Fetch data based on selected source
const fetchSelectedData = async (sourceId: string) => {
  if (!sourceId) return
  
  dataLoading.value = true
  dataError.value = ''
  retrievedData.value = null
  availableDatasets.value = []
  selectedDatasets.value = []
  
  try {
    const response = await fetch(`${apiBaseUrl.value}/api/sources/data/retrieve/?data_source=${encodeURIComponent(sourceId)}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data: RetrievedDataResponse = await response.json()
    console.log('Retrieved data response:', data)
    
    if (data.data) {
      retrievedData.value = data.data
      
      // Extract available datasets
      availableDatasets.value = Object.keys(data.data).map(key => ({
        id: key,
        name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        metadata: data.data[key].metadata,
        type: data.data[key].metadata.type || 'table'
      }))
    } else {
      dataError.value = 'No data available for this source'
    }
    
  } catch (err) {
    dataError.value = `Failed to fetch data: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Data fetch error:', err)
  } finally {
    dataLoading.value = false
  }
}

// Watch for data source selection changes
watch(selectedDataSource, (newSource) => {
  if (newSource) {
    fetchSelectedData(newSource)
  }
})

// Computed properties for organizing data
const tableData = computed(() => {
  if (!retrievedData.value || selectedDatasets.value.length === 0) return {}
  
  const tables: Record<string, any> = {}
  selectedDatasets.value.forEach(datasetId => {
    const dataset = retrievedData.value[datasetId]
    if (dataset && dataset.metadata.type === 'table') {
      tables[datasetId] = {
        metadata: dataset.metadata,
        data: dataset.data
      }
    }
  })
  return tables
})

const chartData = computed(() => {
  if (!retrievedData.value || selectedDatasets.value.length === 0) return {}
  
  const charts: Record<string, any> = {}
  selectedDatasets.value.forEach(datasetId => {
    const dataset = retrievedData.value[datasetId]
    if (dataset && dataset.metadata.type === 'chart') {
      charts[datasetId] = {
        metadata: dataset.metadata,
        data: dataset.data
      }
    }
  })
  return charts
})

// Helper function to get table headers from data
const getTableHeaders = (data: any) => {
  if (!data || typeof data !== 'object') return []
  return Object.keys(data)
}

// Helper function to convert table data to array format
const convertTableDataToArray = (data: any) => {
  if (!data || typeof data !== 'object') return []
  
  // Get all years/keys from the data
  const allKeys = new Set<string>()
  Object.values(data).forEach((item: any) => {
    if (typeof item === 'object') {
      Object.keys(item).forEach(key => allKeys.add(key))
    }
  })
  
  const sortedKeys = Array.from(allKeys).sort()
  
  // Convert to array format
  return sortedKeys.map(key => {
    const row: any = { year: key }
    Object.keys(data).forEach(category => {
      if (typeof data[category] === 'object' && data[category][key] !== undefined) {
        row[category] = data[category][key]
      }
    })
    return row
  })
}

// Helper function to convert data for charts
const convertToChartFeatures = (data: any, key: string) => {
  const arrayData = convertTableDataToArray(data)
  return arrayData.map((item, index) => ({
    id: index,
    type: "Feature",
    properties: item,
    geometry: null
  }))
}

// Toggle dataset selection
const toggleDataset = (datasetId: string) => {
  const index = selectedDatasets.value.indexOf(datasetId)
  if (index > -1) {
    selectedDatasets.value.splice(index, 1)
  } else {
    selectedDatasets.value.push(datasetId)
  }
}

// Initialize data sources on mount
fetchDataSources()
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <!-- Header -->
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Datenquellen</h1>
      <p class="text-muted-foreground">
        Wählen Sie eine Datenquelle aus, um die verfügbaren Daten anzuzeigen
      </p>
    </div>

    <!-- Data Source Selection -->
    <Card>
      <CardHeader>
        <CardTitle>Datenquelle auswählen</CardTitle>
        <CardDescription>
          Verfügbare Datenquellen aus der API
        </CardDescription>
      </CardHeader>
      <CardContent>
        <!-- Error message for data sources -->
        <div v-if="dataSourcesError" class="mb-4">
          <Alert variant="destructive">
            <AlertDescription>{{ dataSourcesError }}</AlertDescription>
          </Alert>
        </div>

        <!-- Loading state for data sources -->
        <div v-if="dataSourcesLoading" class="space-y-2">
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-4 w-1/2" />
        </div>

        <!-- Data source selector -->
        <div v-else class="space-y-4">
          <!-- Debug info -->
          <div v-if="dataSources.length > 0" class="text-sm text-muted-foreground">
            {{ dataSources.length }} Datenquellen verfügbar
          </div>
          <div v-else class="text-sm text-muted-foreground">
            Keine Datenquellen gefunden. Prüfen Sie die API-Verbindung.
          </div>
          
          <Select v-model="selectedDataSource" v-if="dataSources.length > 0">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Datenquelle auswählen..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem 
                v-for="source in dataSources" 
                :key="source.id || source.name" 
                :value="source.id || source.name"
              >
                <div class="flex flex-col">
                  <span class="font-medium">{{ source.name || source.id }}</span>
                  <span v-if="source.description" class="text-sm text-muted-foreground">
                    {{ source.description }}
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Selected source info -->
          <div v-if="selectedDataSource" class="flex items-center gap-2">
            <Badge variant="secondary">Ausgewählt: {{ selectedDataSource }}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Dataset Selection (shown after data source is selected) -->
    <Card v-if="selectedDataSource && availableDatasets.length > 0">
      <CardHeader>
        <CardTitle>Datasets auswählen</CardTitle>
        <CardDescription>
          Verfügbare Datasets aus der ausgewählten Datenquelle
        </CardDescription>
      </CardHeader>
      <CardContent>
        <!-- Error message for data -->
        <div v-if="dataError" class="mb-4">
          <Alert variant="destructive">
            <AlertDescription>{{ dataError }}</AlertDescription>
          </Alert>
        </div>

        <!-- Loading state for datasets -->
        <div v-if="dataLoading" class="space-y-2">
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-4 w-1/2" />
        </div>

        <!-- Dataset selector -->
        <div v-else class="space-y-4">
          <div class="text-sm text-muted-foreground">
            {{ availableDatasets.length }} Datasets verfügbar
          </div>
          
          <div class="space-y-3">
            <div 
              v-for="dataset in availableDatasets" 
              :key="dataset.id"
              class="flex items-start space-x-3 p-3 border border-border rounded-lg hover:bg-accent/50 cursor-pointer"
              @click="toggleDataset(dataset.id)"
            >
              <input
                type="checkbox"
                :checked="selectedDatasets.includes(dataset.id)"
                @change="toggleDataset(dataset.id)"
                class="mt-1"
              />
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium">{{ dataset.name }}</span>
                  <Badge 
                    :variant="dataset.type === 'table' ? 'default' : 'secondary'" 
                    class="text-xs"
                  >
                    {{ dataset.type }}
                  </Badge>
                </div>
                <div v-if="dataset.metadata.description_de" class="text-sm text-muted-foreground mt-1">
                  {{ dataset.metadata.description_de }}
                </div>
                <div v-else-if="dataset.metadata.description_en" class="text-sm text-muted-foreground mt-1">
                  {{ dataset.metadata.description_en }}
                </div>
                <div v-if="dataset.metadata.source" class="text-xs text-muted-foreground mt-1">
                  Quelle: {{ dataset.metadata.source }}
                </div>
              </div>
            </div>
          </div>

          <!-- Selected datasets info -->
          <div v-if="selectedDatasets.length > 0" class="flex flex-wrap gap-2">
            <Badge 
              v-for="datasetId in selectedDatasets" 
              :key="datasetId"
              variant="outline"
            >
              {{ availableDatasets.find(d => d.id === datasetId)?.name || datasetId }}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Data Display Section -->
    <div v-if="selectedDataSource && selectedDatasets.length > 0">
      <!-- Error message for data -->
      <div v-if="dataError" class="mb-4">
        <Alert variant="destructive">
          <AlertDescription>{{ dataError }}</AlertDescription>
        </Alert>
      </div>

      <!-- Loading state for data -->
      <div v-if="dataLoading" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card class="lg:col-span-2">
          <CardHeader>
            <Skeleton class="h-6 w-48" />
            <Skeleton class="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <Skeleton class="h-64 w-full" />
              <div class="space-y-2">
                <Skeleton class="h-4 w-full" />
                <Skeleton class="h-4 w-3/4" />
                <Skeleton class="h-4 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Data content -->
      <div v-if="retrievedData" class="space-y-6">
        <!-- Tables Section -->
        <div v-if="Object.keys(tableData).length > 0" class="space-y-4">
          <h2 class="text-2xl font-semibold">Tabellen</h2>
          <div class="grid grid-cols-1 gap-6">
            <Card v-for="(table, key) in tableData" :key="key">
              <CardHeader>
                <CardTitle class="capitalize">{{ key.replace(/_/g, ' ') }}</CardTitle>
                <CardDescription>
                  <div v-if="table.metadata.description_de" class="mb-2">
                    {{ table.metadata.description_de }}
                  </div>
                  <div v-else-if="table.metadata.description_en" class="mb-2">
                    {{ table.metadata.description_en }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    <span v-if="table.metadata.source">Quelle: {{ table.metadata.source }}</span>
                    <span v-if="table.metadata.units"> | Einheiten: {{ table.metadata.units }}</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead v-for="header in getTableHeaders(convertTableDataToArray(table.data)[0] || {})" :key="header">
                        {{ header.replace(/_/g, ' ').toUpperCase() }}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="(row, index) in convertTableDataToArray(table.data)" :key="index">
                      <TableCell v-for="header in getTableHeaders(row)" :key="header">
                        {{ row[header] }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        <!-- Charts Section -->
        <div v-if="Object.keys(chartData).length > 0" class="space-y-4">
          <h2 class="text-2xl font-semibold">Diagramme</h2>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card v-for="(chart, key) in chartData" :key="key" class="h-96">
              <CardHeader>
                <CardTitle class="capitalize">{{ key.replace(/_/g, ' ') }}</CardTitle>
                <CardDescription>
                  <div v-if="chart.metadata.description_de" class="mb-2">
                    {{ chart.metadata.description_de }}
                  </div>
                  <div v-else-if="chart.metadata.description_en" class="mb-2">
                    {{ chart.metadata.description_en }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    <span v-if="chart.metadata.source">Quelle: {{ chart.metadata.source }}</span>
                    <span v-if="chart.metadata.units"> | Einheiten: {{ chart.metadata.units }}</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent class="h-full pb-6">
                <DataBarChart
                  :filtered-features="convertToChartFeatures(chart.data, key)"
                  :color-property="[Object.keys(convertTableDataToArray(chart.data)[0] || {})[1] || 'value']"
                  :loading="false"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <!-- No data message -->
        <div v-if="Object.keys(tableData).length === 0 && Object.keys(chartData).length === 0" class="text-center py-12">
          <div class="mx-auto max-w-md">
            <div class="mx-auto h-12 w-12 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <h3 class="mt-2 text-sm font-medium text-gray-900">Keine Daten verfügbar</h3>
            <p class="mt-1 text-sm text-gray-500">
              Für diese Datenquelle sind keine Daten verfügbar.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- No selection message -->
    <div v-else-if="!dataSourcesLoading" class="text-center py-12">
      <div class="mx-auto max-w-md">
        <div class="mx-auto h-12 w-12 text-gray-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7M4 7V4c0-2.21 1.79-4 4-4h8c2.21 0 4-1.79 4-4v3M4 7h16m-10 4v6m4-6v6"/>
          </svg>
        </div>
        <h3 class="mt-2 text-sm font-medium text-gray-900">Keine Datenquelle ausgewählt</h3>
        <p class="mt-1 text-sm text-gray-500">
          Wählen Sie eine Datenquelle aus dem Dropdown-Menü aus, um die Daten anzuzeigen.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style> 