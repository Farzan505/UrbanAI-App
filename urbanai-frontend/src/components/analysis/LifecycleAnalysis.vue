<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js'
import { Building, Layers, Euro, Leaf, Download } from 'lucide-vue-next'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement)

// Props
interface Props {
  lcaLccResults?: any
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  lcaLccResults: null,
  isLoading: false
})

// Load mock data from the sample JSON file
const mockLcaLccResults = ref<any>(null)

onMounted(async () => {
  try {
    // Load the sample data from the JSON file
    const response = await fetch('/src/sample-retrofit-analysis-response.json')
    const sampleData = await response.json()
    mockLcaLccResults.value = sampleData.data.lca_lcc_results
  } catch (error) {
    console.error('Error loading sample LCA/LCC data:', error)
    // Fallback to null if loading fails
    mockLcaLccResults.value = null
  }
})

// Use real data if available, otherwise use loaded mock data
const effectiveLcaLccResults = computed(() => {
  return props.lcaLccResults || mockLcaLccResults.value
})

// Reactive state
const activeTab = ref('lca') // 'lca' or 'lcc'
const viewMode = ref('building') // 'building', 'component', or 'system'
const selectedComponent = ref('facade') // 'facade', 'roof', 'base', 'window', 'hvac'
const selectedIndicator = ref('gwptotal_a2') // for LCA
const showPerM2 = ref(false) // toggle between total and per m²

// Watch for view mode changes to set appropriate default component
watch(viewMode, (newMode) => {
  const results = effectiveLcaLccResults.value
  if (!results) return
  
  if (newMode === 'system' && results.hvac) {
    selectedComponent.value = 'hvac'
  } else if (newMode === 'component') {
    // Set to first available building component
    const buildingComponents = Object.keys(results).filter(key => key !== 'hvac')
    if (buildingComponents.length > 0) {
      selectedComponent.value = buildingComponents[0]
    }
  }
})

// Available components
const availableComponents = computed(() => {
  const results = effectiveLcaLccResults.value
  if (!results) return []
  
  if (viewMode.value === 'component') {
    // Show only building components (excluding hvac)
    const buildingComponents = Object.keys(results).filter(key => key !== 'hvac')
    return buildingComponents.map(key => ({
      key,
      label: getComponentLabel(key),
      icon: getComponentIcon(key)
    }))
  } else if (viewMode.value === 'system' && results.hvac) {
    // Show only HVAC/Wärmeversorgung
    return [{
      key: 'hvac',
      label: 'Wärmeversorgung',
      icon: getComponentIcon('hvac')
    }]
  }
  
  return []
})

// Available LCA indicators
const lcaIndicators = [
  { key: 'gwptotal_a2', label: 'Treibhauspotential (GWP)', unit: 'kg CO₂ eq' },
  { key: 'pert', label: 'Primärenergie erneuerbar (PERT)', unit: 'MJ' },
  { key: 'penrt', label: 'Primärenergie nicht-erneuerbar (PENRT)', unit: 'MJ' }
]

// Helper functions
function getComponentLabel(key: string): string {
  const labels: Record<string, string> = {
    facade: 'Fassade',
    roof: 'Dach',
    base: 'Bodenplatte',
    window: 'Fenster',
    hvac: 'Wärmeversorgung'
  }
  return labels[key] || key
}

function getComponentIcon(key: string) {
  const icons: Record<string, any> = {
    facade: Building,
    roof: Layers,
    base: Building,
    window: Building,
    hvac: Building
  }
  return icons[key] || Building
}

function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '0'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0 €'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

// Computed data for building-level overview
const buildingLevelData = computed(() => {
  const results = effectiveLcaLccResults.value
  if (!results) return null

  // Exclude HVAC from building components as it's handled separately
  const components = Object.keys(results).filter(key => key !== 'hvac')
  let totalCost = 0
  let totalGWP = 0
  let totalPERT = 0
  let totalPENRT = 0
  let totalArea = 0

  const componentData = components.map(component => {
    const data = results[component]
    
    // Extract costs from summary
    const totalCostValue = data.summary?.total_cost_euro || 0
    const costPerM2Value = data.summary?.cost_per_m2_euro || 0
    const area = data.summary?.area_m2 || 0
    totalCost += totalCostValue
    totalArea += area

    // Calculate LCA values from lca_by_material data
    const lcaData = data.lca_by_material || []
    let gwpTotal = 0, gwpPerM2 = 0
    let pertTotal = 0, pertPerM2 = 0
    let penrtTotal = 0, penrtPerM2 = 0

    lcaData.forEach((item: any) => {
      if (item.indicator === 'gwptotal_a2') {
        gwpTotal += item.total_value || 0
        gwpPerM2 += item.scaled_value_dynamic || 0
      } else if (item.indicator === 'pert') {
        pertTotal += item.total_value || 0
        pertPerM2 += item.scaled_value_dynamic || 0
      } else if (item.indicator === 'penrt') {
        penrtTotal += item.total_value || 0
        penrtPerM2 += item.scaled_value_dynamic || 0
      }
    })

    totalGWP += gwpTotal
    totalPERT += pertTotal
    totalPENRT += penrtTotal

    return {
      name: getComponentLabel(component),
      component,
      cost: showPerM2.value ? costPerM2Value : totalCostValue,
      gwp: showPerM2.value ? gwpPerM2 : gwpTotal,
      pert: showPerM2.value ? pertPerM2 : pertTotal,
      penrt: showPerM2.value ? penrtPerM2 : penrtTotal,
      area: area,
      uValueOld: data.summary?.u_value_old || 0,
      uValueNew: data.summary?.u_value_new || 0
    }
  })

  return {
    components: componentData,
    totals: {
      cost: showPerM2.value && totalArea > 0 ? totalCost / totalArea : totalCost,
      gwp: showPerM2.value && totalArea > 0 ? totalGWP / totalArea : totalGWP,
      pert: showPerM2.value && totalArea > 0 ? totalPERT / totalArea : totalPERT,
      penrt: showPerM2.value && totalArea > 0 ? totalPENRT / totalArea : totalPENRT,
      area: totalArea
    }
  }
})

// Computed data for component-level detail
const componentLevelData = computed(() => {
  const results = effectiveLcaLccResults.value
  if (!results || !selectedComponent.value) return null

  const componentData = results[selectedComponent.value]
  if (!componentData) return null

  // Handle HVAC data differently
  if (selectedComponent.value === 'hvac') {
    // Process LCC data by system for HVAC
    const lccData = componentData.lcc_by_system || []
    const lccByYear = lccData.reduce((acc: any, item: any) => {
      const year = item.year
      if (!acc[year]) {
        acc[year] = {
          year,
          totalCost: 0,
          systems: []
        }
      }
      const totalCost = item.total_cost || 0
      const costPerKw = item.cost_per_kw || 0
      
      acc[year].totalCost += totalCost
      acc[year].systems.push({
        name: item.name_de,
        cost: totalCost,
        total_cost: totalCost,
        cost_per_kw: costPerKw,
        eventType: item.event_type,
        hvacNumber: item.hvac_number,
        power: item.allocated_power_kw
      })
      return acc
    }, {})

    // Process LCA data by system for HVAC
    const lcaData = componentData.lca_by_system || []
    const lcaByYear = lcaData.reduce((acc: any, item: any) => {
      const year = item.year
      const indicator = item.indicator
      
      if (!acc[year]) {
        acc[year] = {
          year,
          indicators: {}
        }
      }
      
      if (!acc[year].indicators[indicator]) {
        acc[year].indicators[indicator] = {
          indicator,
          unit: item.unit,
          systems: []
        }
      }
      
      acc[year].indicators[indicator].systems.push({
        name: item.name_de,
        uuid: item.uuid,
        total_value: item.total_value || 0,
        raw_value: item.raw_value || 0,
        scaled_value: item.scaled_value || 0,
        scaled_value_dynamic: item.scaled_value_dynamic || item.scaled_value || 0,
        module: item.module,
        year: year,
        eventType: item.event_type,
        cause: item.cause
      })
      return acc
    }, {})

    // Also keep the old structure for backward compatibility
    const lcaByIndicator = lcaData.reduce((acc: any, item: any) => {
      const indicator = item.indicator
      if (!acc[indicator]) {
        acc[indicator] = {
          indicator,
          unit: item.unit,
          systems: []
        }
      }
      acc[indicator].systems.push({
        name: item.name_de,
        uuid: item.uuid,
        total_value: item.total_value || 0,
        raw_value: item.raw_value || 0,
        scaled_value: item.scaled_value || 0,
        scaled_value_dynamic: item.scaled_value_dynamic || item.scaled_value || 0,
        module: item.module,
        year: item.year,
        eventType: item.event_type,
        cause: item.cause
      })
      return acc
    }, {})

    return {
      summary: componentData.summary,
      lcc: {
        byYear: Object.values(lccByYear),
        timeline: Object.values(lccByYear).sort((a: any, b: any) => a.year - b.year)
      },
      lca: {
        byYear: lcaByYear,
        byIndicator: lcaByIndicator,
        indicators: Object.keys(lcaByIndicator)
      },
      isHvac: true
    }
  } else {
    // Handle regular building components (existing code)
    // Process LCC data by material
    const lccData = componentData.lcc_by_material || []
    const lccByYear = lccData.reduce((acc: any, item: any) => {
      const year = item.year
      if (!acc[year]) {
        acc[year] = {
          year,
          totalCost: 0,
          materials: []
        }
      }
      const totalCost = item.total_cost || 0
      const costPerM2 = item.cost_per_m2 || 0
      
      acc[year].totalCost += totalCost
      acc[year].materials.push({
        name: item.name_de,
        cost: totalCost,
        total_cost: totalCost,
        cost_per_m2: costPerM2,
        eventType: item.event_type,
        cause: item.cause,
        module: item.module
      })
      return acc
    }, {})

    // Process LCA data by material - group by year and indicator
    const lcaData = componentData.lca_by_material || []
    const lcaByYear = lcaData.reduce((acc: any, item: any) => {
      // Use year if available, otherwise replacement_year, otherwise default to 2030
      const year = item.year || item.replacement_year || 2030
      const indicator = item.indicator
      
      if (!acc[year]) {
        acc[year] = {
          year,
          indicators: {}
        }
      }
      
      if (!acc[year].indicators[indicator]) {
        acc[year].indicators[indicator] = {
          indicator,
          unit: item.unit,
          materials: []
        }
      }
      
      acc[year].indicators[indicator].materials.push({
        name: item.name_de,
        uuid: item.uuid,
        position_number: item.position_number,
        lifespan: item.lifespan,
        total_value: item.total_value || 0,
        raw_value: item.raw_value || 0,
        scaled_value: item.scaled_value || 0,
        scaled_value_dynamic: item.scaled_value_dynamic || item.scaled_value || 0,
        module: item.module,
        year: year,
        eventType: item.event_type,
        cause: item.cause
      })
      return acc
    }, {})

    // Also keep the old structure for backward compatibility
    const lcaByIndicator = lcaData.reduce((acc: any, item: any) => {
      const indicator = item.indicator
      if (!acc[indicator]) {
        acc[indicator] = {
          indicator,
          unit: item.unit,
          materials: []
        }
      }
      acc[indicator].materials.push({
        name: item.name_de,
        uuid: item.uuid,
        position_number: item.position_number,
        lifespan: item.lifespan,
        total_value: item.total_value || 0,
        raw_value: item.raw_value || 0,
        scaled_value: item.scaled_value || 0,
        scaled_value_dynamic: item.scaled_value_dynamic || item.scaled_value || 0,
        module: item.module,
        year: item.year || item.replacement_year || 2030,
        eventType: item.event_type,
        cause: item.cause
      })
      return acc
    }, {})

    return {
      summary: componentData.summary,
      lcc: {
        byYear: Object.values(lccByYear),
        timeline: Object.values(lccByYear).sort((a: any, b: any) => a.year - b.year)
      },
      lca: {
        byYear: lcaByYear,
        byIndicator: lcaByIndicator,
        indicators: Object.keys(lcaByIndicator)
      },
      isHvac: false
    }
  }
})

// Chart data for building comparison
const buildingComparisonChartData = computed(() => {
  if (!buildingLevelData.value) return null

  const components = buildingLevelData.value.components
  const labels = components.map(c => c.name)
  const unit = showPerM2.value ? '/m²' : ''
  
  if (activeTab.value === 'lcc') {
    return {
      labels,
      datasets: [{
        label: `Lebenszykluskosten (€${unit})`,
        data: components.map(c => c.cost),
        backgroundColor: '#3B82F6',
        borderColor: '#2563EB',
        borderWidth: 1
      }]
    }
  } else {
    const selectedLcaData = components.map(c => (c as any)[selectedIndicator.value] || 0)
    const indicatorInfo = lcaIndicators.find(i => i.key === selectedIndicator.value)
    
    return {
      labels,
      datasets: [{
        label: `${indicatorInfo?.label} (${indicatorInfo?.unit}${unit})`,
        data: selectedLcaData,
        backgroundColor: '#10B981',
        borderColor: '#059669',
        borderWidth: 1
      }]
    }
  }
})

// Chart data for year-based stacked materials (LCC)
const yearBasedLccChartData = computed(() => {
  if (!componentLevelData.value) return null

  const lccData = componentLevelData.value.lcc.byYear
  if (!lccData || lccData.length === 0) return null

  const isHvac = componentLevelData.value.isHvac

  // Get all unique materials/systems across all years
  const allItems = new Set()
  lccData.forEach((yearData: any) => {
    const items = isHvac ? yearData.systems : yearData.materials
    if (items) {
      items.forEach((item: any) => {
        allItems.add(item.name)
      })
    }
  })

  const itemColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]

  const datasets = Array.from(allItems).map((itemName, index) => ({
    label: itemName as string,
    data: lccData.map((yearData: any) => {
      const items = isHvac ? yearData.systems : yearData.materials
      const item = items ? items.find((i: any) => i.name === itemName) : null
      if (!item) return 0
      // Use showPerM2 toggle to determine which field to use
      if (isHvac) {
        return showPerM2.value ? (item.cost_per_kw || 0) : (item.cost || item.total_cost || 0)
      } else {
        return showPerM2.value ? (item.cost_per_m2 || 0) : (item.cost || item.total_cost || 0)
      }
    }),
    backgroundColor: itemColors[index % itemColors.length],
    borderColor: itemColors[index % itemColors.length],
    borderWidth: 1
  }))

  return {
    labels: lccData.map((yearData: any) => yearData.year.toString()),
    datasets
  }
})

// LCC chart options
const lccChartOptions = computed(() => {
  const isHvac = componentLevelData.value?.isHvac || false
  const unit = showPerM2.value ? (isHvac ? '€/kW' : '€/m²') : '€'
  
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
            const unitSuffix = showPerM2.value ? (isHvac ? '/kW' : '/m²') : ''
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}${unitSuffix}`
          }
        }
      },
      title: {
        display: true,
        text: `Lebenszykluskosten nach Jahr (${unit})`
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Jahr'
        },
        stacked: true
      },
      y: {
        title: {
          display: true,
          text: `Kosten (${unit})`
        },
        stacked: true,
        beginAtZero: true
      }
    }
  }
})

// Chart data for year-based stacked materials (LCA)
const yearBasedLcaChartData = computed(() => {
  if (!componentLevelData.value) return null

  const lcaByYear = componentLevelData.value.lca.byYear || {}
  const indicator = selectedIndicator.value
  const isHvac = componentLevelData.value.isHvac
  
  // Get all years that have data for the selected indicator
  const yearsWithData = Object.keys(lcaByYear).filter(year => 
    lcaByYear[year].indicators && lcaByYear[year].indicators[indicator]
  ).sort((a, b) => parseInt(a) - parseInt(b))

  if (yearsWithData.length === 0) return null

  // Get all unique materials/systems across all years for this indicator
  const allItems = new Set()
  yearsWithData.forEach(year => {
    const yearData = lcaByYear[year].indicators[indicator]
    const items = isHvac ? yearData.systems : yearData.materials
    if (items) {
      items.forEach((item: any) => {
        allItems.add(item.name)
      })
    }
  })

  const itemColors = [
    '#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ]

  const datasets = Array.from(allItems).map((itemName, index) => ({
    label: itemName as string,
    data: yearsWithData.map(year => {
      const yearData = lcaByYear[year].indicators[indicator]
      const items = isHvac ? yearData.systems : yearData.materials
      const itemsFiltered = items ? items.filter((i: any) => i.name === itemName) : []
      
      // Sum up values for the same material/system in the same year (in case there are multiple entries)
      const totalValue = itemsFiltered.reduce((sum: number, item: any) => {
        // Use total_value when not per unit, scaled_value_dynamic when per unit
        const value = showPerM2.value ? (item.scaled_value_dynamic || 0) : (item.total_value || 0)
        return sum + value
      }, 0)
      
      return totalValue
    }),
    backgroundColor: itemColors[index % itemColors.length],
    borderColor: itemColors[index % itemColors.length],
    borderWidth: 1,
    // Store additional data for tooltips
    materialData: yearsWithData.map(year => {
      const yearData = lcaByYear[year].indicators[indicator]
      const items = isHvac ? yearData.systems : yearData.materials
      return items ? items.filter((i: any) => i.name === itemName) : []
    })
  }))

  return {
    labels: yearsWithData,
    datasets
  }
})

// LCA chart options
const lcaChartOptions = computed(() => {
  const indicatorInfo = lcaIndicators.find(i => i.key === selectedIndicator.value)
  const isHvac = componentLevelData.value?.isHvac || false
  const unit = showPerM2.value ? `${indicatorInfo?.unit}${isHvac ? '/kW' : '/m²'}` : indicatorInfo?.unit

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
            const baseLabel = `${context.dataset.label}: ${formatNumber(context.parsed.y)} ${unit}`
            return baseLabel
          },
          afterLabel: function(context: any) {
            // Get the material data for this specific point
            const dataset = context.dataset
            const dataIndex = context.dataIndex
            
            if (dataset.materialData && dataset.materialData[dataIndex]) {
              const items = dataset.materialData[dataIndex]
              if (items.length > 0) {
                const additionalInfo: string[] = []
                items.forEach((item: any) => {
                  additionalInfo.push(`Modul: ${item.module}`)

                  if (item.cause) {
                    additionalInfo.push(`Ursache: ${item.cause}`)
                  }
                })
                return additionalInfo
              }
            }
            return []
          }
        }
      },
      title: {
        display: true,
        text: `${indicatorInfo?.label} nach Jahr (${unit})`
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Jahr'
        },
        stacked: true
      },
      y: {
        title: {
          display: true,
          text: `${indicatorInfo?.label} (${unit})`
        },
        stacked: true,
        beginAtZero: true
      }
    }
  }
})

// Construction layer visualization data
const constructionLayersData = computed(() => {
  if (!componentLevelData.value) return null

  const results = effectiveLcaLccResults.value
  if (!results || !selectedComponent.value) return null

  const componentData = results[selectedComponent.value]
  if (!componentData?.construction_dimensions) return null

  const layers = componentData.construction_dimensions.sort((a: any, b: any) => a.position_number - b.position_number)
  
  let cumulativeThickness = 0
  return layers.map((layer: any) => {
    const layerData = {
      name: layer.name_de,
      position: layer.position_number,
      thickness: layer.thickness_m,
      lifespan: layer.lifespan,
      startPosition: cumulativeThickness,
      endPosition: cumulativeThickness + layer.thickness_m,
      layerDimensions: layer.layer_dimensions,
      uuid: layer.uuid
    }
    cumulativeThickness += layer.thickness_m
    return layerData
  })
})

// Chart options
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          const unit = showPerM2.value ? '/m²' : ''
          if (activeTab.value === 'lcc') {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}${unit}`
          } else {
            return `${context.dataset.label}: ${formatNumber(context.parsed.y)}${unit}`
          }
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
}))

// Export functions
const exportData = () => {
  // Implementation for data export
  console.log('Exporting lifecycle analysis data...')
}
</script>

<template>
  <div class="w-full space-y-6">
    <!-- Header with controls -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Lebenszyklusanalyse</h2>
        <p class="text-muted-foreground">
          Analyse der Umweltauswirkungen und Lebenszykluskosten der Sanierungsmaßnahmen
        </p>
      </div>
      
      <div class="flex items-center space-x-4">
        <!-- Export Button -->
        <Button variant="outline" size="sm" @click="exportData">
          <Download class="h-4 w-4 mr-2" />
          Exportieren
        </Button>
      </div>
    </div>

    <!-- Main controls -->
    <Card>
      <CardHeader>
        <CardTitle class="text-lg">Analyseoptionen</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Analysis Type -->
          <div class="space-y-2">
            <Label>Analysetyp</Label>
            <Tabs v-model="activeTab" class="w-full">
              <TabsList class="grid w-full grid-cols-2">
                <TabsTrigger value="lca" class="flex items-center space-x-2">
                  <Leaf class="h-4 w-4" />
                  <span>LCA</span>
                </TabsTrigger>
                <TabsTrigger value="lcc" class="flex items-center space-x-2">
                  <Euro class="h-4 w-4" />
                  <span>LCC</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <!-- View Mode -->
          <div class="space-y-2">
            <Label>Betrachtungsebene</Label>
            <Select v-model="viewMode">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="building">Gebäudeebene</SelectItem>
                <SelectItem value="component">Bauteilebene</SelectItem>
                <SelectItem value="system">Komponentenebene</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Component Selection (only for component and system view) -->
          <div v-if="viewMode === 'component' || viewMode === 'system'" class="space-y-2">
            <Label>{{ viewMode === 'component' ? 'Bauteil' : 'Komponente' }}</Label>
            <Select v-model="selectedComponent">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="component in availableComponents"
                  :key="component.key"
                  :value="component.key"
                >
                  {{ component.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- LCA Indicator (only for LCA) -->
          <div v-if="activeTab === 'lca'" class="space-y-2">
            <Label>Umweltindikator</Label>
            <Select v-model="selectedIndicator">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="indicator in lcaIndicators"
                  :key="indicator.key"
                  :value="indicator.key"
                >
                  {{ indicator.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <!-- Per m² Toggle -->
        <div class="mt-4 flex items-center space-x-2">
          <Switch 
            id="per-m2-toggle"
            v-model="showPerM2"
          />
          <Label for="per-m2-toggle" class="text-sm">
            {{ (viewMode === 'system' && componentLevelData?.isHvac) ? 'Pro kW anzeigen' : 'Pro m² anzeigen' }}
          </Label>
        </div>
      </CardContent>
    </Card>

    <!-- Loading State -->
    <div v-if="isLoading" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card v-for="i in 4" :key="i">
        <CardHeader>
          <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div class="space-y-2">
            <div class="h-32 bg-gray-200 rounded animate-pulse"></div>
            <div class="h-4 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Building Level View -->
    <div v-else-if="viewMode === 'building' && buildingLevelData" class="space-y-6">
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Total Cost Card -->
        <Card v-if="activeTab === 'lcc'">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">
              {{ showPerM2 ? 'Kosten pro m²' : 'Gesamtkosten' }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatCurrency(buildingLevelData.totals.cost) }}{{ showPerM2 ? '/m²' : '' }}
            </div>
            <p class="text-xs text-muted-foreground">Lebenszykluskosten</p>
          </CardContent>
        </Card>

        <!-- GWP Card -->
        <Card v-if="activeTab === 'lca'">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Treibhauspotential</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatNumber(buildingLevelData.totals.gwp / 1000, 1) }}
            </div>
            <p class="text-xs text-muted-foreground">
              t CO₂ eq{{ showPerM2 ? '/m²' : '' }}
            </p>
          </CardContent>
        </Card>

        <!-- PERT Card -->
        <Card v-if="activeTab === 'lca'">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Primärenergie erneuerbar</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatNumber(buildingLevelData.totals.pert / 1000000, 1) }}
            </div>
            <p class="text-xs text-muted-foreground">
              GJ{{ showPerM2 ? '/m²' : '' }}
            </p>
          </CardContent>
        </Card>

        <!-- PENRT Card -->
        <Card v-if="activeTab === 'lca'">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Primärenergie nicht-erneuerbar</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatNumber(buildingLevelData.totals.penrt / 1000000, 1) }}
            </div>
            <p class="text-xs text-muted-foreground">
              GJ{{ showPerM2 ? '/m²' : '' }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Components Comparison Chart -->
      <Card>
        <CardHeader>
          <CardTitle>Vergleich nach Bauteilen</CardTitle>
          <CardDescription>
            {{ activeTab === 'lca' ? 'Umweltauswirkungen' : 'Lebenszykluskosten' }} aufgeschlüsselt nach Bauteilen
            {{ showPerM2 ? '(pro m²)' : '(Gesamtwerte)' }}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-80">              <Bar 
                v-if="buildingComparisonChartData"
                :data="buildingComparisonChartData" 
                :options="chartOptions"
              />
          </div>
        </CardContent>
      </Card>

      <!-- Components Details Table -->
      <Card>
        <CardHeader>
          <CardTitle>Detailübersicht Bauteile</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b">
                  <th class="text-left p-2">Bauteil</th>
                  <th class="text-right p-2">Fläche (m²)</th>
                  <th class="text-right p-2" v-if="activeTab === 'lcc'">
                    {{ showPerM2 ? 'Kosten (€/m²)' : 'Kosten (€)' }}
                  </th>
                  <th class="text-right p-2" v-if="activeTab === 'lca'">
                    {{ lcaIndicators.find(i => i.key === selectedIndicator)?.label }}
                    {{ showPerM2 ? ' (pro m²)' : '' }}
                  </th>
                  <th class="text-right p-2">U-Wert alt</th>
                  <th class="text-right p-2">U-Wert neu</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="component in buildingLevelData.components" :key="component.component" class="border-b">
                  <td class="p-2 font-medium">{{ component.name }}</td>
                  <td class="text-right p-2">{{ formatNumber(component.area, 1) }}</td>
                  <td class="text-right p-2" v-if="activeTab === 'lcc'">{{ formatCurrency(component.cost) }}</td>
                  <td class="text-right p-2" v-if="activeTab === 'lca'">
                    {{ formatNumber(component[selectedIndicator as keyof typeof component] as number) }}
                  </td>
                  <td class="text-right p-2">{{ formatNumber(component.uValueOld, 3) }}</td>
                  <td class="text-right p-2">{{ formatNumber(component.uValueNew, 3) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Component Level View -->
    <div v-else-if="(viewMode === 'component' || viewMode === 'system') && componentLevelData" class="space-y-6">
      <!-- Component Summary -->
      <Card>
        <CardHeader>
          <CardTitle>{{ getComponentLabel(selectedComponent) }} - Übersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="componentLevelData.isHvac" class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div class="text-muted-foreground">Leistungsbedarf</div>
              <div class="font-medium">{{ formatNumber(componentLevelData.summary?.power_requirement, 1) }} kW</div>
            </div>
            <div v-if="activeTab === 'lcc'">
              <div class="text-muted-foreground">Gesamtkosten</div>
              <div class="font-medium">{{ formatCurrency(componentLevelData.summary?.total_cost_euro) }}</div>
            </div>
            <div v-if="activeTab === 'lcc'">
              <div class="text-muted-foreground">Kosten pro kW</div>
              <div class="font-medium">{{ formatCurrency(componentLevelData.summary?.cost_per_kw_euro) }}/kW</div>
            </div>
            <div>
              <div class="text-muted-foreground">Installationsjahr</div>
              <div class="font-medium">{{ componentLevelData.summary?.installation_year || 'N/A' }}</div>
            </div>
          </div>
          <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div class="text-muted-foreground">Fläche</div>
              <div class="font-medium">{{ formatNumber(componentLevelData.summary?.area_m2, 1) }} m²</div>
            </div>
            <div v-if="activeTab === 'lcc'">
              <div class="text-muted-foreground">Gesamtkosten</div>
              <div class="font-medium">{{ formatCurrency(componentLevelData.summary?.total_cost_euro) }}</div>
            </div>
            <div>
              <div class="text-muted-foreground">U-Wert alt</div>
              <div class="font-medium">{{ formatNumber(componentLevelData.summary?.u_value_old, 3) }} W/(m²·K)</div>
            </div>
            <div>
              <div class="text-muted-foreground">U-Wert neu</div>
              <div class="font-medium">{{ formatNumber(componentLevelData.summary?.u_value_new, 3) }} W/(m²·K)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- LCC Timeline Chart -->
      <Card v-if="activeTab === 'lcc'">
        <CardHeader>
          <CardTitle>Kostenentwicklung über Lebenszyklus (gestapelt nach {{ componentLevelData.isHvac ? 'Systemen' : 'Materialien' }})</CardTitle>
          <CardDescription>
            {{ componentLevelData.isHvac ? 'Systemkosten' : 'Materialkosten' }} aufgeschlüsselt nach Jahren und {{ componentLevelData.isHvac ? 'Systemen' : 'Materialien' }}
            {{ showPerM2 ? (componentLevelData.isHvac ? '(pro kW)' : '(pro m²)') : '(Gesamtwerte)' }}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-80">
            <Bar 
              v-if="yearBasedLccChartData"
              :data="yearBasedLccChartData" 
              :options="lccChartOptions"
            />
          </div>
        </CardContent>
      </Card>

      <!-- LCA Materials Chart by Year -->
      <Card v-if="activeTab === 'lca'">
        <CardHeader>
          <CardTitle>{{ lcaIndicators.find(i => i.key === selectedIndicator)?.label }} nach {{ componentLevelData.isHvac ? 'Systemen' : 'Materialien' }} und Jahren</CardTitle>
          <CardDescription>
            Umweltauswirkungen gestapelt nach Jahren und {{ componentLevelData.isHvac ? 'Systemen' : 'Materialien' }}
            {{ showPerM2 ? (componentLevelData.isHvac ? '(pro kW)' : '(pro m²)') : '(Gesamtwerte)' }}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-80">
            <Bar 
              v-if="yearBasedLcaChartData"
              :data="yearBasedLcaChartData" 
              :options="lcaChartOptions"
            />
          </div>
        </CardContent>
      </Card>

      <!-- Construction Layers Visualization -->
      <Card v-if="!componentLevelData.isHvac && selectedComponent !== 'window'">
        <CardHeader>
          <CardTitle>{{ getComponentLabel(selectedComponent) }} - Schichtaufbau</CardTitle>
          <CardDescription>Visualisierung der Konstruktionsschichten mit Dimensionen</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-60 relative border rounded-lg bg-gray-50 overflow-hidden">
            <div 
              v-if="constructionLayersData" 
              class="h-full flex items-center justify-center relative"
            >
              <!-- Layer visualization -->
              <div class="relative w-full h-32 border-2 border-gray-300 bg-white">
                <div
                  v-for="(layer, index) in constructionLayersData"
                  :key="layer.uuid"
                  class="absolute h-full border-r-2 border-gray-400 cursor-pointer transition-all hover:bg-blue-100"
                  :style="{
                    left: `${(layer.startPosition / constructionLayersData[constructionLayersData.length - 1].endPosition) * 100}%`,
                    width: `${(layer.thickness / constructionLayersData[constructionLayersData.length - 1].endPosition) * 100}%`,
                    backgroundColor: `hsl(${(index * 360) / constructionLayersData.length}, 60%, 90%)`,
                    borderLeftColor: `hsl(${(index * 360) / constructionLayersData.length}, 60%, 50%)`
                  }"
                  :title="`${layer.name} - ${formatNumber(layer.thickness * 1000, 1)}mm - Lebensdauer: ${layer.lifespan} Jahre`"
                >
                  <!-- Hash pattern for better visibility -->
                  <div 
                    class="absolute inset-0 opacity-30"
                    :style="{
                      background: `repeating-linear-gradient(45deg, transparent, transparent 2px, hsl(${(index * 360) / constructionLayersData.length}, 60%, 50%) 2px, hsl(${(index * 360) / constructionLayersData.length}, 60%, 50%) 4px)`
                    }"
                  ></div>
                  
                  <!-- Layer number -->
                  <div class="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
                    {{ layer.position }}
                  </div>
                </div>
              </div>
              
              <!-- Dimension labels -->
              <div class="absolute -bottom-6 left-0 right-0 h-6 flex">
                <div
                  v-for="layer in constructionLayersData"
                  :key="`label-${layer.uuid}`"
                  class="text-xs text-center border-l border-gray-300 flex items-center justify-center"
                  :style="{
                    width: `${(layer.thickness / constructionLayersData[constructionLayersData.length - 1].endPosition) * 100}%`
                  }"
                >
                  {{ formatNumber(layer.thickness * 1000, 0) }}mm
                </div>
              </div>
            </div>
          </div>
          
          <!-- Layer details table -->
          <div v-if="constructionLayersData" class="mt-6 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b">
                  <th class="text-left p-2">Position</th>
                  <th class="text-left p-2">Material</th>
                  <th class="text-right p-2">Dicke (mm)</th>
                  <th class="text-right p-2">Lebensdauer (Jahre)</th>
                  <th class="text-right p-2">Schichtdimensionen</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="layer in constructionLayersData" :key="layer.uuid" class="border-b hover:bg-gray-50">
                  <td class="p-2 font-medium">{{ layer.position }}</td>
                  <td class="p-2">{{ layer.name }}</td>
                  <td class="text-right p-2">{{ formatNumber(layer.thickness * 1000, 1) }}</td>
                  <td class="text-right p-2">{{ layer.lifespan }}</td>
                  <td class="text-right p-2">{{ formatNumber(layer.layerDimensions, 1) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- No Data State -->
    <Card v-else-if="!isLoading">
      <CardContent class="text-center py-12">
        <div class="text-muted-foreground">
          <Building class="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Keine Lebenszyklusdaten verfügbar</p>
          <p class="text-sm">Führen Sie eine Sanierungsanalyse durch, um LCA/LCC-Ergebnisse zu erhalten.</p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
/* Add any custom styles here */
</style>
