<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import { Zap, Download, Building } from 'lucide-vue-next'
import ArcGISSceneViewer from '@/components/map/ArcGISSceneViewer.vue'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// Props
interface Props {
  emissionResults?: any
  gmlIds?: string[]
  geometryData?: any
  geometryLoading?: boolean
  apiBaseUrl?: string
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  emissionResults: null,
  gmlIds: () => [],
  geometryData: null,
  geometryLoading: false,
  apiBaseUrl: 'http://localhost:8080',
  isLoading: false
})

// Load mock data from the sample JSON file
const mockEmissionResults = ref<any>(null)

onMounted(async () => {
  try {
    // Load the sample data from the JSON file
    const response = await fetch('/sample-retrofit-analysis-response.json')
    const sampleData = await response.json()
    mockEmissionResults.value = sampleData.data.emission_results
  } catch (error) {
    console.error('Error loading sample emission data:', error)
    // Fallback to null if loading fails
    mockEmissionResults.value = null
  }
})

// Watch for changes in geometry data
watch(() => props.geometryData, (newData, oldData) => {
  if (newData && !oldData) {
    console.log('✅ Geometry data now available for EnergyAnalysis')
  }
}, { deep: true })

// Use real data if available, otherwise use loaded mock data
const effectiveEmissionResults = computed(() => {
  return props.emissionResults || mockEmissionResults.value
})

// Extract only buildings and visualization_zone from geometry data
const filteredGeometryData = computed(() => {
  if (!props.geometryData) {
    return null
  }
  
  const filtered: any = {}
  
  // Extract buildings data
  if (props.geometryData.buildings) {
    filtered.buildings = props.geometryData.buildings
  }
  
  // Extract visualization_zone data
  if (props.geometryData.visualization_zone) {
    filtered.visualization_zone = props.geometryData.visualization_zone
  }
  
  return Object.keys(filtered).length > 0 ? filtered : null
})

// Reactive state
const selectedIndicator = ref('end_demand') // 'end_demand', 'net_demand', 'pe_total', 'pert', 'penrt'
const showNormalized = ref(true) // Switch between normalized and total

// Available indicators with German labels
const energyIndicators = [
  { key: 'end_demand', label: 'Endenergiebedarf', unit: 'kWh/m²a' },
  { key: 'net_demand', label: 'Nutzenergiebedarf', unit: 'kWh/m²a' },
  { key: 'pe_total', label: 'Primärenergiebedarf', unit: 'kWh/m²a' },
  { key: 'pert', label: 'Primärenergiebedarf erneuerbar', unit: 'kWh/m²a' },
  { key: 'penrt', label: 'Primärenergiebedarf nicht erneuerbar', unit: 'kWh/m²a' }
]

// Helper functions
function formatNumber(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) return '0'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

// Computed data for the selected indicator
const chartData = computed(() => {
  const results = effectiveEmissionResults.value
  if (!results || !results[selectedIndicator.value]) return null

  const indicatorData = results[selectedIndicator.value]
  const valueType = showNormalized.value ? 'normalized' : 'total'
  
  // Extract status quo and scenario data
  const statusQuoData = indicatorData.status_quo || {}
  const scenarioData = indicatorData.scenario || {}
  
  // For complex indicators like end_demand and net_demand, we need to handle sub-categories
  if (selectedIndicator.value === 'end_demand') {
    const categories = ['end_heating_demand', 'end_dhw_demand', 'electricity_demand', 'end_demand_total']
    const labels = ['Heizung', 'Warmwasser', 'Strom', 'Gesamt']
    
    return {
      labels,
      datasets: [
        {
          label: `Status Quo`,
          data: categories.map(cat => statusQuoData[cat]?.[valueType] || 0),
          backgroundColor: '#EF4444',
          borderColor: '#DC2626',
          borderWidth: 1
        },
        {
          label: `Szenario`,
          data: categories.map(cat => scenarioData[cat]?.[valueType] || 0),
          backgroundColor: '#10B981',
          borderColor: '#059669',
          borderWidth: 1
        }
      ]
    }
  } else if (selectedIndicator.value === 'net_demand') {
    const categories = ['net_heating_demand', 'net_dhw_demand', 'net_demand_total']
    const labels = ['Heizung', 'Warmwasser', 'Gesamt']
    
    return {
      labels,
      datasets: [
        {
          label: `Status Quo`,
          data: categories.map(cat => statusQuoData[cat]?.[valueType] || 0),
          backgroundColor: '#EF4444',
          borderColor: '#DC2626',
          borderWidth: 1
        },
        {
          label: `Szenario`,
          data: categories.map(cat => scenarioData[cat]?.[valueType] || 0),
          backgroundColor: '#10B981',
          borderColor: '#059669',
          borderWidth: 1
        }
      ]
    }
  } else {
    // For simple indicators like pe_total, pert, penrt
    return {
      labels: ['Status Quo', 'Szenario'],
      datasets: [{
        label: `${energyIndicators.find(i => i.key === selectedIndicator.value)?.label}`,
        data: [
          statusQuoData[valueType] || 0,
          scenarioData[valueType] || 0
        ],
        backgroundColor: ['#EF4444', '#10B981'],
        borderColor: ['#DC2626', '#059669'],
        borderWidth: 1
      }]
    }
  }
})

// Chart options
const chartOptions = computed(() => {
  const indicatorInfo = energyIndicators.find(i => i.key === selectedIndicator.value)
  const unit = showNormalized.value ? indicatorInfo?.unit : 'kWh/a'

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${formatNumber(context.parsed.y)} ${unit}`
          }
        }
      },
      title: {
        display: true,
        text: `${indicatorInfo?.label} (${unit})`
      }
    },
    scales: {
      y: {
        title: {
          display: true,
          text: `${indicatorInfo?.label} (${unit})`
        },
        beginAtZero: true
      }
    }
  }
})

// Summary data for cards
const summaryData = computed(() => {
  const results = effectiveEmissionResults.value
  if (!results) return null

  const valueType = showNormalized.value ? 'normalized' : 'total'

  return {
    endDemand: {
      statusQuo: results.end_demand?.status_quo?.end_demand_total?.[valueType] || 0,
      scenario: results.end_demand?.scenario?.end_demand_total?.[valueType] || 0,
      improvement: results.end_demand?.difference?.end_demand_total?.[valueType]?.percentage || 0
    },
    netDemand: {
      statusQuo: results.net_demand?.status_quo?.net_demand_total?.[valueType] || 0,
      scenario: results.net_demand?.scenario?.net_demand_total?.[valueType] || 0,
      improvement: results.net_demand?.difference?.net_demand_total?.[valueType]?.percentage || 0
    },
    primaryEnergy: {
      statusQuo: results.pe_total?.status_quo?.[valueType] || 0,
      scenario: results.pe_total?.scenario?.[valueType] || 0,
      improvement: results.pe_total?.difference?.[valueType]?.percentage || 0
    }
  }
})

// Export functions
const exportData = () => {
  console.log('Exporting energy analysis data...')
}
</script>

<template>
  <div class="w-full space-y-6">
    <!-- Header with controls -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Energieanalyse</h2>
        <p class="text-muted-foreground">
          3D-Visualisierung und Energiebedarfsvergleich für Status Quo und Sanierungsszenario
        </p>
      </div>
      
      <div class="flex items-center space-x-4">
        <Button variant="outline" size="sm" @click="exportData">
          <Download class="h-4 w-4 mr-2" />
          Exportieren
        </Button>
      </div>
    </div>

    <!-- Main Analysis Area - Chart on left, 3D on right -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Energy Demand Chart - Left Side -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center space-x-2">
            <Zap class="h-5 w-5" />
            <span>{{ energyIndicators.find(i => i.key === selectedIndicator)?.label }}</span>
          </CardTitle>
          <CardDescription>
            Vergleich zwischen Status Quo und Sanierungsszenario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <!-- Controls above the chart -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <!-- Indicator Selection -->
            <div class="space-y-2">
              <Label>Energieindikator</Label>
              <Select v-model="selectedIndicator">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="indicator in energyIndicators"
                    :key="indicator.key"
                    :value="indicator.key"
                  >
                    {{ indicator.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Normalized/Total Switch -->
            <div class="space-y-2">
              <Label>Darstellung</Label>
              <div class="flex items-center space-x-2">
                <Switch 
                  id="normalized-switch"
                  v-model="showNormalized"
                />
                <Label for="normalized-switch" class="text-sm">
                  {{ showNormalized ? 'Pro m²' : 'Gesamt' }}
                </Label>
              </div>
            </div>
          </div>

          <!-- Chart -->
          <div class="h-80">
            <Bar 
              v-if="chartData"
              :data="chartData" 
              :options="chartOptions"
            />
            <div v-else class="flex items-center justify-center h-full text-muted-foreground">
              <div class="text-center">
                <Zap class="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Energiedaten verfügbar</p>
                <p class="text-sm">Führen Sie eine Energieanalyse durch, um Diagramme zu generieren.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 3D Visualization - Right Side -->
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center space-x-2">
            <Building class="h-5 w-5" />
            <span>3D-Gebäudevisualisierung</span>
          </CardTitle>
          <CardDescription>
            Interaktive 3D-Darstellung der analysierten Gebäude
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-96 w-full rounded-lg border bg-muted">
            <ArcGISSceneViewer 
              v-if="gmlIds.length > 0 || filteredGeometryData"
              :gml-ids="gmlIds"
              :geometry-data="filteredGeometryData"
              class="w-full h-full rounded-lg"
            />
            <div v-else class="flex items-center justify-center h-full text-muted-foreground">
              <div class="text-center">
                <Building class="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine 3D-Daten verfügbar</p>
                <p class="text-sm">Führen Sie eine Gebäudeanalyse durch, um die 3D-Visualisierung zu aktivieren.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Summary Cards - Beneath the main analysis area -->
    <div v-if="summaryData" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- End Demand Card -->
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium">Endenergiebedarf</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ formatNumber(summaryData.endDemand.scenario) }}
          </div>
          <p class="text-xs text-muted-foreground">
            {{ showNormalized ? 'kWh/m²a' : 'kWh/a' }}
          </p>
          <div class="mt-2 text-sm">
            <span :class="summaryData.endDemand.improvement > 0 ? 'text-green-600' : 'text-red-600'">
              {{ summaryData.endDemand.improvement > 0 ? '-' : '+' }}{{ formatNumber(Math.abs(summaryData.endDemand.improvement)) }}%
            </span>
            <span class="text-muted-foreground ml-1">vs. Status Quo</span>
          </div>
        </CardContent>
      </Card>

      <!-- Net Demand Card -->
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium">Nutzenergiebedarf</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ formatNumber(summaryData.netDemand.scenario) }}
          </div>
          <p class="text-xs text-muted-foreground">
            {{ showNormalized ? 'kWh/m²a' : 'kWh/a' }}
          </p>
          <div class="mt-2 text-sm">
            <span :class="summaryData.netDemand.improvement > 0 ? 'text-green-600' : 'text-red-600'">
              {{ summaryData.netDemand.improvement > 0 ? '-' : '+' }}{{ formatNumber(Math.abs(summaryData.netDemand.improvement)) }}%
            </span>
            <span class="text-muted-foreground ml-1">vs. Status Quo</span>
          </div>
        </CardContent>
      </Card>

      <!-- Primary Energy Card -->
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium">Primärenergiebedarf</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">
            {{ formatNumber(summaryData.primaryEnergy.scenario) }}
          </div>
          <p class="text-xs text-muted-foreground">
            {{ showNormalized ? 'kWh/m²a' : 'kWh/a' }}
          </p>
          <div class="mt-2 text-sm">
            <span :class="summaryData.primaryEnergy.improvement > 0 ? 'text-green-600' : 'text-red-600'">
              {{ summaryData.primaryEnergy.improvement > 0 ? '-' : '+' }}{{ formatNumber(Math.abs(summaryData.primaryEnergy.improvement)) }}%
            </span>
            <span class="text-muted-foreground ml-1">vs. Status Quo</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
/* Add any custom styles here */
</style> 