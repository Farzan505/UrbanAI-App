<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { TrendingDown, Euro, Factory } from 'lucide-vue-next'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Register Chart.js components including Filler for fill option
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// Reactive state
const useScenario = ref(false)

// Detailed view state
const showDetailedView = ref(false)
const selectedDetailYear = ref<number | null>(null)

// Props interface for receiving emission data
interface Props {
  emissionData?: any
}

const props = defineProps<Props>()

// Chart options for reduction path
const reductionPathOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: '',
      font: {
        size: 16,
        weight: 'bold' as const
      }
    },
    legend: {
      position: 'bottom' as const
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        label: function(context: any) {
          return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} kg CO₂-Äq/m²`
        }
      }
    }
  },
  scales: {
    x: {
      type: 'linear' as const,
      title: {
        display: true,
        text: 'Jahr'
      },
      ticks: {
        callback: function(value: any) {
          return Math.round(value).toString() // Remove comma formatting
        }
      }
    },
    y: {
      title: {
        display: true,
        text: 'CO₂-Emissionen (kg CO₂-Äq/m²)'
      },
      beginAtZero: true
    }
  },
  elements: {
    line: {
      tension: 0.1
    }
  }
}

// Chart options for scope emissions (bar chart)
const scopeEmissionsOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: '',
      font: {
        size: 16,
        weight: 'bold' as const
      }
    },
    legend: {
      position: 'bottom' as const
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false
    }
  },
  scales: {
    x: {
      type: 'linear' as const,
      title: {
        display: true,
        text: 'Jahr'
      },
      stacked: true,
      ticks: {
        callback: function(value: any) {
          return Math.round(value).toString() // Remove comma formatting
        },
        stepSize: 1
      }
    },
    y: {
      title: {
        display: true,
        text: 'Emissionen (kg CO₂-Äq)'
      },
      stacked: true,
      beginAtZero: true
    }
  }
}

// Chart options for costs
const costsOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: '',
      font: {
        size: 16,
        weight: 'bold' as const
      }
    },
    legend: {
      position: 'bottom' as const
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      callbacks: {
        label: function(context: any) {
          return `${context.dataset.label}: €${context.parsed.y.toFixed(2)}`
        }
      }
    }
  },
  scales: {
    x: {
      type: 'linear' as const,
      title: {
        display: true,
        text: 'Jahr'
      },
      ticks: {
        callback: function(value: any) {
          return Math.round(value).toString() // Remove comma formatting
        },
        stepSize: 1
      }
    },
    y: {
      title: {
        display: true,
        text: 'Kosten (€/m²)'
      },
      beginAtZero: true
    }
  }
}

// No longer loading sample data - using real API response data

// Debug watchers - reduced logging
watch(() => props.emissionData, (newData, oldData) => {
  if (newData?.scenario_activated !== oldData?.scenario_activated) {
    console.log('🔍 Props scenario_activated changed:', oldData?.scenario_activated, '→', newData?.scenario_activated)
  }
}, { deep: true, immediate: true })

watch(useScenario, (newValue) => {
  console.log('🔄 Switch toggled to:', newValue ? 'Scenario' : 'Status Quo')
  console.log('🔄 Scenario activated:', scenarioActivated.value)
  
  // Reset detailed view when switching scenarios
  if (showDetailedView.value) {
    showDetailedView.value = false
    selectedDetailYear.value = null
  }
})

// Computed properties for data processing
const emissionResults = computed(() => {
  // Use the real API response data from props
  const data = props.emissionData || null
  
  // Add some stability checking
  if (data && typeof data === 'object') {
    return data
  }
  
  return null
})

const scenarioActivated = computed(() => {
  const activated = emissionResults.value?.scenario_activated || false
  return activated
})

const profileKey = computed(() => {
  // Use the toggle state to determine which profile to show
  return useScenario.value ? 'profile_combined' : 'profile_status_quo'
})

// Additional watchers after computed properties
watch(scenarioActivated, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    console.log('🎯 scenarioActivated changed from', oldValue, 'to', newValue)
  }
})

watch(emissionResults, (newData, oldData) => {
  if (newData?.scenario_activated !== oldData?.scenario_activated) {
    console.log('📊 emissionResults scenario_activated changed:', oldData?.scenario_activated, '→', newData?.scenario_activated)
  }
}, { deep: true })

// Reduction path chart data
const reductionPathData = computed(() => {
  const results = emissionResults.value
  if (!results?.reduction_path) {
    console.log('❌ No reduction path data')
    return null
  }

  const reductionYears = Object.keys(results.reduction_path).map(Number).sort()
  const reductionValues = reductionYears.map(year => results.reduction_path[year.toString()])

  const datasets: any[] = [
    {
      label: 'CO₂-Äq Reduktionspfad',
      data: reductionValues,
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: false,
      tension: 0.1,
      pointRadius: 4
    }
  ]

  // Add CO2 emissions heating/DHW data - show both profiles when scenario is active
  if (results.co2_emissions_heating_dhw) {
    console.log('🔥 Available heating/DHW profiles:', Object.keys(results.co2_emissions_heating_dhw))
    
    // If switch is off or no scenario available, show only status quo
    if (!useScenario.value || !scenarioActivated.value) {
      if (results.co2_emissions_heating_dhw.profile_status_quo) {
        const statusQuoProfile = results.co2_emissions_heating_dhw.profile_status_quo
        const statusQuoYears = Object.keys(statusQuoProfile).map(Number).sort()
        const statusQuoValues = statusQuoYears.map(year => statusQuoProfile[year.toString()])

        console.log('🔥 Status quo heating/DHW:', { years: statusQuoYears, values: statusQuoValues })

        datasets.push({
          label: 'CO₂-Äq Heizen/Warmwasser (Status Quo)',
          data: statusQuoValues,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderDash: [5, 5], // Dashed line for status quo
          fill: false,
          tension: 0.1,
          pointRadius: 3
        })
      }
    } else {
      // Switch is on and scenario is available - show combined profile
      if (results.co2_emissions_heating_dhw.profile_combined) {
        const combinedProfile = results.co2_emissions_heating_dhw.profile_combined
        const combinedYears = Object.keys(combinedProfile).map(Number).sort()
        const combinedValues = combinedYears.map(year => combinedProfile[year.toString()])

        console.log('🔥 Combined heating/DHW:', { years: combinedYears, values: combinedValues })

        datasets.push({
          label: 'CO₂-Äq Heizen/Warmwasser (Szenario)',
          data: combinedValues,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          tension: 0.1,
          pointRadius: 3
        })
      }
    }
  }

  // Add stranding points if available
  if (results.stranding) {
    const strandingAnnotations = []

    // Check for stranding dates
    if (results.stranding.status_quo && results.stranding.status_quo !== null) {
      const strandingDate = new Date(results.stranding.status_quo)
      const strandingYear = strandingDate.getFullYear()
      if (reductionYears.includes(strandingYear)) {
        const yearIndex = reductionYears.indexOf(strandingYear)
        strandingAnnotations.push({
          year: strandingYear,
          value: reductionValues[yearIndex],
          label: 'Stranding (Status Quo)'
        })
      }
    }

    if (results.stranding.scenario && results.stranding.scenario !== null) {
      const strandingDate = new Date(results.stranding.scenario)
      const strandingYear = strandingDate.getFullYear()
      if (reductionYears.includes(strandingYear)) {
        const yearIndex = reductionYears.indexOf(strandingYear)
        strandingAnnotations.push({
          year: strandingYear,
          value: reductionValues[yearIndex],
          label: 'Stranding (Szenario)'
        })
      }
    }

    console.log('⚠️ Stranding annotations:', strandingAnnotations)
  }

  // Combine all years for x-axis
  const allYears = [...new Set([...reductionYears])].sort()

  return {
    labels: allYears,
    datasets
  }
})

// Scope emissions chart data
const scopeEmissionsData = computed(() => {
  const results = emissionResults.value
  if (!results?.scope_emissions) {
    return null
  }

  // Determine which profile to show based on switch and availability
  let profileToShow = 'profile_status_quo'
  if (useScenario.value && scenarioActivated.value && results.scope_emissions.profile_combined) {
    profileToShow = 'profile_combined'
  }

  // Use the determined profile data
  const profileData = results.scope_emissions[profileToShow]
  
  if (!profileData) {
    console.log('❌ No profile data for scope emissions:', { profileToShow, available: Object.keys(results.scope_emissions || {}) })
    return null
  }

  // Get years from any scope data - now handling object keys directly
  const firstScope = Object.keys(profileData)[0]
  const firstCategory = Object.keys(profileData[firstScope] || {})[0]
  const sampleData = profileData[firstScope]?.[firstCategory] || {}
  
  // Extract years from date strings like "2020-01-01" and convert to numbers
  const years = Object.keys(sampleData)
    .map(dateStr => parseInt(dateStr.split('-')[0]))
    .sort((a, b) => a - b)

  console.log('📊 Scope emissions:', { profileToShow, years, hasData: years.length > 0, profileData })
  
  if (years.length === 0) {
    console.log('❌ No years found in scope emissions data')
    return null
  }
  
  // Process each scope
  const datasets: any[] = []
  const colors = {
    'Scope 1': { bg: 'rgba(239, 68, 68, 0.7)', border: 'rgb(239, 68, 68)' },
    'Scope 2': { bg: 'rgba(59, 130, 246, 0.7)', border: 'rgb(59, 130, 246)' },
    'Scope 3': { bg: 'rgba(16, 185, 129, 0.7)', border: 'rgb(16, 185, 129)' }
  }

  Object.keys(profileData).forEach(scopeKey => {
    const scopeValues = profileData[scopeKey]
    if (scopeValues && typeof scopeValues === 'object') {
      // Combine heating, dhw, and electricity for each scope
      const combinedValues = years.map(year => {
        const dateKey = `${year}-01-01`
        const heating = scopeValues.heating?.[dateKey] || 0
        const dhw = scopeValues.dhw?.[dateKey] || 0
        const electricity = scopeValues.electricity?.[dateKey] || 0
        
        // Add LCA categories if available
        const lca_base = scopeValues.lca_base?.[dateKey] || 0
        const lca_roof = scopeValues.lca_roof?.[dateKey] || 0
        const lca_window = scopeValues.lca_window?.[dateKey] || 0
        const lca_wall = scopeValues.lca_wall?.[dateKey] || 0
        const lca_hvac = scopeValues.lca_hvac?.[dateKey] || 0
        
        return heating + dhw + electricity + lca_base + lca_roof + lca_window + lca_wall + lca_hvac
      })

      datasets.push({
        label: `${scopeKey} (${useScenario.value ? 'Szenario' : 'Status Quo'})`,
        data: combinedValues,
        backgroundColor: colors[scopeKey as keyof typeof colors]?.bg || 'rgba(156, 163, 175, 0.7)',
        borderColor: colors[scopeKey as keyof typeof colors]?.border || 'rgb(156, 163, 175)',
        borderWidth: 1
      })
    }
  })

  return {
    labels: years,
    datasets
  }
})

// CO2 costs chart data
const co2CostsData = computed(() => {
  const results = emissionResults.value
  if (!results?.co2_costs_tax) {
    return null
  }

  // Determine which profile to show based on switch and availability
  let profileToShow = 'profile_status_quo'
  if (useScenario.value && scenarioActivated.value && results.co2_costs_tax.profile_combined) {
    profileToShow = 'profile_combined'
  }

  const profile = results.co2_costs_tax[profileToShow]
  if (!profile) {
    return null
  }

  // Extract years from the profile data - these might be simple year strings
  const years = Object.keys(profile)
    .map(key => parseInt(key))
    .sort((a, b) => a - b)
  
  const values = years.map(year => profile[year.toString()])

  console.log('💰 CO2 costs chart data:', { profileToShow, years, values, hasData: values.length > 0 })

  return {
    labels: years,
    datasets: [
      {
        label: `CO₂-ÄqVermeidungskosten (${useScenario.value ? 'Szenario' : 'Status Quo'})`,
        data: values,
        borderColor: 'rgb(234, 88, 12)',
        backgroundColor: 'rgba(234, 88, 12, 0.1)',
        fill: true,
        tension: 0.1
      }
    ]
  }
})

// Operation costs chart data
const operationCostsData = computed(() => {
  const results = emissionResults.value
  if (!results?.operation_costs) {
    return null
  }

  // Determine which profile to show based on switch and availability
  let profileToShow = 'profile_status_quo'
  if (useScenario.value && scenarioActivated.value && results.operation_costs.profile_combined) {
    profileToShow = 'profile_combined'
  }

  const profile = results.operation_costs[profileToShow]
  if (!profile) {
    return null
  }

  // Extract years from the profile data - these are simple year strings
  const years = Object.keys(profile)
    .map(key => parseInt(key))
    .sort((a, b) => a - b)
    
  const values = years.map(year => profile[year.toString()])

  console.log('⚡ Operation costs chart data:', { profileToShow, years, values, hasData: values.length > 0 })

  return {
    labels: years,
    datasets: [
      {
        label: `Betriebskosten (${useScenario.value ? 'Szenario' : 'Status Quo'})`,
        data: values,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.1
      }
    ]
  }
})

// Detailed scope emissions data for specific year
const detailedScopeEmissionsData = computed(() => {
  const results = emissionResults.value
  if (!results?.scope_emissions || !selectedDetailYear.value) {
    return null
  }

  // Determine which profile to show based on switch and availability
  let profileToShow = 'profile_status_quo'
  if (useScenario.value && scenarioActivated.value && results.scope_emissions.profile_combined) {
    profileToShow = 'profile_combined'
  }

  const profileData = results.scope_emissions[profileToShow]
  if (!profileData) {
    return null
  }

  const dateKey = `${selectedDetailYear.value}-01-01`
  const baseCategories = ['heating', 'dhw', 'electricity']
  const lcaCategories = ['lca_base', 'lca_roof', 'lca_window', 'lca_wall', 'lca_hvac']
  
  const categoryLabels = {
    heating: 'Heizen',
    dhw: 'Warmwasser',
    electricity: 'Strom',
    lca_base: 'Bodenplatte',
    lca_roof: 'Dach',
    lca_window: 'Fenster',
    lca_wall: 'Außenwand',
    lca_hvac: 'Wärmeversorgung'
  }
  const categoryColors = {
    heating: { bg: 'rgba(239, 68, 68, 0.7)', border: 'rgb(239, 68, 68)' },
    dhw: { bg: 'rgba(59, 130, 246, 0.7)', border: 'rgb(59, 130, 246)' },
    electricity: { bg: 'rgba(16, 185, 129, 0.7)', border: 'rgb(16, 185, 129)' },
    lca_base: { bg: 'rgba(168, 85, 247, 0.7)', border: 'rgb(168, 85, 247)' },
    lca_roof: { bg: 'rgba(236, 72, 153, 0.7)', border: 'rgb(236, 72, 153)' },
    lca_window: { bg: 'rgba(245, 158, 11, 0.7)', border: 'rgb(245, 158, 11)' },
    lca_wall: { bg: 'rgba(34, 197, 94, 0.7)', border: 'rgb(34, 197, 94)' },
    lca_hvac: { bg: 'rgba(99, 102, 241, 0.7)', border: 'rgb(99, 102, 241)' }
  }

  // Get available scopes
  const scopes = Object.keys(profileData).sort()
  
  // Determine which categories are actually available in the data
  const availableCategories: string[] = []
  
  // Check base categories
  baseCategories.forEach(category => {
    const hasData = scopes.some(scopeKey => {
      const scopeValues = profileData[scopeKey]
      return scopeValues?.[category]?.[dateKey] !== undefined
    })
    if (hasData) {
      availableCategories.push(category)
    }
  })
  
  // Check LCA categories
  lcaCategories.forEach(category => {
    const hasData = scopes.some(scopeKey => {
      const scopeValues = profileData[scopeKey]
      return scopeValues?.[category]?.[dateKey] !== undefined
    })
    if (hasData) {
      availableCategories.push(category)
    }
  })
  
  const datasets: any[] = []

  // Create dataset for each available category
  availableCategories.forEach(category => {
    const categoryValues = scopes.map(scopeKey => {
      const scopeValues = profileData[scopeKey]
      return scopeValues?.[category]?.[dateKey] || 0
    })

    datasets.push({
      label: categoryLabels[category as keyof typeof categoryLabels],
      data: categoryValues,
      backgroundColor: categoryColors[category as keyof typeof categoryColors]?.bg || 'rgba(156, 163, 175, 0.7)',
      borderColor: categoryColors[category as keyof typeof categoryColors]?.border || 'rgb(156, 163, 175)',
      borderWidth: 1
    })
  })

  return {
    labels: scopes, // Scopes on Y-axis
    datasets
  }
})

// Available years for detailed view
const availableDetailYears = computed(() => {
  const results = emissionResults.value
  if (!results?.scope_emissions) {
    return []
  }

  // Determine which profile to show based on switch and availability
  let profileToShow = 'profile_status_quo'
  if (useScenario.value && scenarioActivated.value && results.scope_emissions.profile_combined) {
    profileToShow = 'profile_combined'
  }

  const profileData = results.scope_emissions[profileToShow]
  if (!profileData) {
    return []
  }

  // Get years from any scope data - now handling object keys directly
  const firstScope = Object.keys(profileData)[0]
  const firstCategory = Object.keys(profileData[firstScope] || {})[0]
  const sampleData = profileData[firstScope]?.[firstCategory] || {}
  
  const years = Object.keys(sampleData)
    .map(dateStr => parseInt(dateStr.split('-')[0]))
    .sort((a, b) => a - b)

  return years
})

// Functions for detailed view
const toggleDetailedView = () => {
  showDetailedView.value = !showDetailedView.value
  
  // Auto-select first available year when entering detailed view
  if (showDetailedView.value && availableDetailYears.value.length > 0) {
    selectedDetailYear.value = availableDetailYears.value[0]
  }
}

const selectDetailYear = (year: number) => {
  selectedDetailYear.value = year
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header with Toggle -->
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <TrendingDown class="h-6 w-6 text-green-600" />
        <h2 class="text-2xl font-semibold">Dekarbonisierung</h2>
        <Badge v-if="scenarioActivated" variant="default">Szenario verfügbar</Badge>
        <Badge v-else variant="secondary">Nur Status Quo</Badge>
      </div>
      
      <!-- Toggle Switch -->
      <div v-if="scenarioActivated" class="flex items-center space-x-3">
        <Label for="scenario-toggle" class="text-sm font-medium">
          {{ useScenario ? 'Szenario' : 'Status Quo' }}
        </Label>
        <Switch 
          id="scenario-toggle"
          v-model="useScenario"
          :disabled="!scenarioActivated"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="!emissionResults" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Laden...</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton class="h-64 w-full" />
          <p class="text-sm text-muted-foreground mt-2">
            Lade Emissionsdaten...
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Error State -->
    <div v-else-if="emissionResults === false" class="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fehler beim Laden</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">
            Die Emissionsdaten konnten nicht geladen werden.
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Debug Information - Enabled for troubleshooting -->
    <!--
    <div v-if="emissionResults" class="text-xs text-muted-foreground p-2 bg-gray-50 rounded">
      <p>Debug: Emission data available: {{ !!emissionResults }}</p>
      <p>Scenario activated: {{ scenarioActivated }}</p>
      <p>Current profile: {{ profileKey }}</p>
      <p>Has reduction path: {{ !!emissionResults?.reduction_path }}</p>
      <p>Has scope emissions: {{ !!emissionResults?.scope_emissions }}</p>
      <p>Has CO2 costs: {{ !!emissionResults?.co2_costs_tax }}</p>
      <p>Has operation costs: {{ !!emissionResults?.operation_costs }}</p>
    </div>
    -->

    <!-- Main Content -->
    <div v-if="emissionResults" class="space-y-6">
      <!-- Charts Grid - 2x2 Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top Left: Reduction Path Chart -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center space-x-2">
              <TrendingDown class="h-5 w-5 text-green-600" />
              <span>CO₂-Äq Reduktionspfad</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="reductionPathData" class="h-80">
              <Line 
                :data="reductionPathData" 
                :options="reductionPathOptions"
              />
            </div>
            <div v-else class="h-80 flex items-center justify-center text-muted-foreground">
              Keine Reduktionspfad-Daten verfügbar
            </div>
          </CardContent>
        </Card>

        <!-- Top Right: Scope Emissions Chart -->
        <Card>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle class="flex items-center space-x-2">
                <Factory class="h-5 w-5 text-blue-600" />
                <span>GHG Protocol</span>
              </CardTitle>
              <div class="flex items-center space-x-2">
                <Button
                  v-if="scopeEmissionsData"
                  variant="outline"
                  size="sm"
                  @click="toggleDetailedView"
                >
                  {{ showDetailedView ? 'Übersicht' : 'Detailiert' }}
                </Button>
              </div>
            </div>
            
            <!-- Year Selection for Detailed View -->
            <div v-if="showDetailedView && availableDetailYears.length > 0" class="pt-2">
              <Label for="detail-year-select" class="text-sm font-medium">Jahr auswählen:</Label>
              <Select v-model="selectedDetailYear" class="mt-1">
                <SelectTrigger id="detail-year-select" class="w-32">
                  <SelectValue placeholder="Jahr..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="year in availableDetailYears"
                    :key="year"
                    :value="year"
                  >
                    {{ year }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <!-- Overview Chart -->
            <div v-if="!showDetailedView && scopeEmissionsData" class="h-80">
              <Bar 
                :data="scopeEmissionsData" 
                :options="scopeEmissionsOptions"
              />
            </div>
            
            <!-- Detailed Chart -->
            <div v-else-if="showDetailedView && detailedScopeEmissionsData" class="h-80">
              <Bar 
                :data="detailedScopeEmissionsData" 
                :options="{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    title: {
                      display: true,
                      text: `Scope Emissionen ${selectedDetailYear} - Detailansicht`,
                      font: {
                        size: 16,
                        weight: 'bold'
                      }
                    },
                    legend: {
                      position: 'bottom'
                    },
                    tooltip: {
                      mode: 'index',
                      intersect: false
                    }
                  },
                  scales: {
                    x: {
                      title: {
                        display: true,
                        text: 'Emissionen (kg CO₂-Äq)'
                      },
                      stacked: true,
                      beginAtZero: true
                    },
                    y: {
                      title: {
                        display: true,
                        text: 'Scope'
                      },
                      stacked: true
                    }
                  }
                }"
              />
            </div>
            
            <!-- No Data State -->
            <div v-else class="h-80 flex items-center justify-center text-muted-foreground">
              Keine Scope-Emissions-Daten verfügbar
            </div>
          </CardContent>
        </Card>

        <!-- Bottom Left: CO2 Tax Costs -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center space-x-2">
              <Euro class="h-5 w-5 text-orange-600" />
              <span>CO₂-Äq Vermeidungskosten</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="co2CostsData" class="h-80">
              <Line 
                :data="co2CostsData" 
                :options="costsOptions"
              />
            </div>
            <div v-else class="h-80 flex items-center justify-center text-muted-foreground">
              Keine CO₂-Äq Kostendaten verfügbar
            </div>
          </CardContent>
        </Card>

        <!-- Bottom Right: Operation Costs -->
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center space-x-2">
              <Euro class="h-5 w-5 text-green-600" />
              <span>Betriebskosten</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="operationCostsData" class="h-80">
              <Line 
                :data="operationCostsData" 
                :options="costsOptions"
              />
            </div>
            <div v-else class="h-80 flex items-center justify-center text-muted-foreground">
              Keine Betriebskostendaten verfügbar
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
