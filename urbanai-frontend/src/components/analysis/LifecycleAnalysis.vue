<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js'
import { Building, Layers, Euro, Leaf, Download, Settings, Plus, X, AlertTriangle } from 'lucide-vue-next'
import { useConstructionData } from '@/composables/useConstructionData'
import { toast } from 'vue-sonner'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Input } from '@/components/ui/input'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement)

// Props interface for receiving API response data
interface Props {
  lcaLccResults?: any
  summaryData?: any
  isLoading?: boolean
  buildingData?: any
  geometryData?: any
  co2PathScenarios?: string[]
  co2CostScenarios?: string[]
  selectedCo2PathScenario?: string
  selectedCo2CostScenario?: string
  // Retrofit scenario props
  retrofitScenario?: any
  isSheetOpen?: boolean
  formData?: any
  formDataError?: string
  isLoadingFormData?: boolean
  energyStandards?: any
  energyStandardsError?: string
  isLoadingEnergyStandards?: boolean
  selectedEnergyStandard?: string
  constructionYear?: string
  selectedHvacType?: string
  selectedHvac?: string
  hvacYear?: string
  getHvacOptions?: any[]
  isScenarioValid?: boolean
  getValidationMessage?: string
  constructionSummary?: string
  isDeleteDialogOpen?: boolean
  // Analysis function from parent
  analyzeWithConstructionsFunction?: (
    buildingData: any,
    geometryData: any,
    constructionSelections: any,
    selectedCo2PathScenario: string,
    selectedCo2CostScenario: string,
    retrofitScenario?: any
  ) => Promise<any>
}

const props = withDefaults(defineProps<Props>(), {
  lcaLccResults: null,
  summaryData: null,
  isLoading: false,
  buildingData: null,
  geometryData: null,
  co2PathScenarios: () => [],
  co2CostScenarios: () => [],
  selectedCo2PathScenario: 'KSG',
  selectedCo2CostScenario: '0% reine Zeitpräferenzrate',
  // Retrofit scenario defaults
  retrofitScenario: null,
  isSheetOpen: false,
  formData: null,
  formDataError: '',
  isLoadingFormData: false,
  energyStandards: null,
  energyStandardsError: '',
  isLoadingEnergyStandards: false,
  selectedEnergyStandard: '',
  constructionYear: '',
  selectedHvacType: '',
  selectedHvac: '',
  hvacYear: '',
  getHvacOptions: () => [],
  isScenarioValid: false,
  getValidationMessage: '',
  constructionSummary: '',
  isDeleteDialogOpen: false,
  // Analysis function from parent
  analyzeWithConstructionsFunction: undefined
})

// Emit events to parent
const emit = defineEmits([
  'update:isSheetOpen',
  'update:selectedEnergyStandard',
  'update:constructionYear',
  'update:selectedHvacType',
  'update:selectedHvac',
  'update:hvacYear',
  'update:isDeleteDialogOpen',
  'openRetrofitSheet',
  'saveRetrofitScenario',
  'modifyRetrofitScenario',
  'handleDeleteClick',
  'removeRetrofitScenario'
])

// Construction selection state
const isConstructionSheetOpen = ref(false)
const isAnalyzingWithConstructions = ref(false)
const constructionAnalysisError = ref('')

// Use construction data composable
const {
  isLoading: isLoadingConstructions,
  error: constructionError,
  constructionSelections,
  fetchAllConstructionTypes,
  updateConstructionSelection,
  resetSelections,
  getConstructionOptions
} = useConstructionData()

// Use real data from API response
const effectiveLcaLccResults = computed(() => {
  console.log('🔄 effectiveLcaLccResults computed recalculated:', {
    hasResults: !!props.lcaLccResults,
    keys: props.lcaLccResults ? Object.keys(props.lcaLccResults) : []
  })
  return props.lcaLccResults
})

const effectiveSummaryData = computed(() => {
  console.log('🔄 effectiveSummaryData computed recalculated:', {
    hasSummary: !!props.summaryData,
    keys: props.summaryData ? Object.keys(props.summaryData) : []
  })
  return props.summaryData
})

// Reactive state
const activeTab = ref('investments') // 'investments', 'lca' or 'lcc'
const viewMode = ref('building') // 'building', 'component', or 'system'
const selectedComponent = ref('facade') // 'facade', 'roof', 'base', 'window', 'hvac'
const selectedIndicator = ref('gwptotal_a2') // for LCA
const showPerM2 = ref(false) // toggle between total and per m²

// Watch for prop changes to ensure reactivity
watch(() => props.lcaLccResults, (newResults, oldResults) => {
  console.log('🔄 LCA/LCC Results prop changed:', {
    hasNew: !!newResults,
    hasOld: !!oldResults,
    newKeys: newResults ? Object.keys(newResults) : [],
    oldKeys: oldResults ? Object.keys(oldResults) : []
  })
  
  // Reset component selection when new data arrives
  if (newResults && Object.keys(newResults).length > 0) {
    if (viewMode.value === 'component') {
      const buildingComponents = Object.keys(newResults).filter(key => key !== 'hvac' && key !== 'hvac_skipped')
      if (buildingComponents.length > 0 && !buildingComponents.includes(selectedComponent.value)) {
        selectedComponent.value = buildingComponents[0]
      }
    } else if (viewMode.value === 'system' && newResults.hvac) {
      selectedComponent.value = 'hvac'
    }
  }
}, { deep: true })

watch(() => props.summaryData, (newSummary, oldSummary) => {
  console.log('🔄 Summary Data prop changed:', {
    hasNew: !!newSummary,
    hasOld: !!oldSummary,
    newKeys: newSummary ? Object.keys(newSummary) : [],
    oldKeys: oldSummary ? Object.keys(oldSummary) : []
  })
}, { deep: true })

// Watch for view mode changes to set appropriate default component
watch(viewMode, (newMode) => {
  const results = effectiveLcaLccResults.value
  if (!results) return
  
  // Switch away from investments tab if not in building mode
  if (newMode !== 'building' && activeTab.value === 'investments') {
    activeTab.value = 'lca'
  }
  
  if (newMode === 'system' && results.hvac) {
    selectedComponent.value = 'hvac'
  } else if (newMode === 'component') {
    // Show only building components (excluding hvac and hvac_skipped)
    const buildingComponents = Object.keys(results).filter(key => key !== 'hvac' && key !== 'hvac_skipped')
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
    // Show only building components (excluding hvac and hvac_skipped)
    const buildingComponents = Object.keys(results).filter(key => key !== 'hvac' && key !== 'hvac_skipped')
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
  { key: 'pert', label: 'Primärenergie erneuerbar (PERT)', unit: 'kWh' },
  { key: 'penrt', label: 'Primärenergie nicht-erneuerbar (PENRT)', unit: 'kWh' }
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
  const summaryData = effectiveSummaryData.value
  if (!summaryData) return null

  // Get investment costs, lifecycle costs, and LCA impacts from summary
  const investmentCosts = summaryData.investment_costs || {}
  const lcaImpacts = summaryData.lca_impacts || {}
  const lifecycleCosts = summaryData.lifecycle_costs?.lcc_costs || {}
  const ngfArea = summaryData.building_info?.ngf_area_sqm || 0

  // Building components (excluding hvac)
  const components = ['facade', 'roof', 'base', 'window']
  let totalInvestmentCost = 0
  let totalLifecycleCost = 0
  let totalGWP = 0
  let totalPERT = 0
  let totalPENRT = 0

  const componentData = components.map(component => {
    // Investment costs
    const investmentData = investmentCosts[component] || {}
    const totalInvestmentValue = investmentData.total_euro || 0
    const investmentPerM2Value = investmentData.per_sqm_ngf_euro || 0
    const area = investmentData.area_sqm || 0
    totalInvestmentCost += totalInvestmentValue

    // Lifecycle costs
    const lifecycleData = lifecycleCosts[component] || {}
    const totalLifecycleValue = lifecycleData.total_euro || 0
    const lifecyclePerM2Value = lifecycleData.per_sqm_ngf_euro || 0
    totalLifecycleCost += totalLifecycleValue

    // LCA impacts
    const lcaData = lcaImpacts[component] || {}
    const gwpData = lcaData.gwptotal_a2 || {}
    const pertData = lcaData.pert || {}
    const penrtData = lcaData.penrt || {}

    const gwpTotal = gwpData.total || 0
    const gwpPerM2 = gwpData.per_sqm_ngf || 0
    const pertTotal = pertData.total || 0
    const pertPerM2 = pertData.per_sqm_ngf || 0
    const penrtTotal = penrtData.total || 0
    const penrtPerM2 = penrtData.per_sqm_ngf || 0

    totalGWP += gwpTotal
    totalPERT += (pertTotal * 0.277778) // Convert MJ to kWh
    totalPENRT += (penrtTotal * 0.277778) // Convert MJ to kWh

    return {
      name: getComponentLabel(component),
      component,
      // Store both investment and lifecycle costs
      investmentCost: showPerM2.value ? investmentPerM2Value : totalInvestmentValue,
      lifecycleCost: showPerM2.value ? lifecyclePerM2Value : totalLifecycleValue,
      // Legacy cost field for backward compatibility - will be set based on active tab
      cost: 0, // Will be set below
      gwptotal_a2: showPerM2.value ? gwpPerM2 : gwpTotal,
      gwp: showPerM2.value ? gwpPerM2 : gwpTotal,
      pert: showPerM2.value ? (pertPerM2 * 0.277778) : (pertTotal * 0.277778),
      penrt: showPerM2.value ? (penrtPerM2 * 0.277778) : (penrtTotal * 0.277778),
      area: area,
      uValueOld: 0, // Not available in summary data
      uValueNew: 0  // Not available in summary data
    }
  })

  // Add HVAC data
  const hvacInvestment = investmentCosts.hvac || {}
  const hvacLifecycle = lifecycleCosts.hvac || {}
  const hvacLca = lcaImpacts.hvac || {}
  
  const hvacInvestmentCost = hvacInvestment.total_euro || 0
  const hvacInvestmentCostPerM2 = hvacInvestment.per_sqm_ngf_euro || 0
  const hvacLifecycleCost = hvacLifecycle.total_euro || 0
  const hvacLifecycleCostPerM2 = hvacLifecycle.per_sqm_ngf_euro || 0
  const hvacPower = hvacInvestment.power_kw || 0

  const hvacGwpData = hvacLca.gwptotal_a2 || {}
  const hvacPertData = hvacLca.pert || {}
  const hvacPenrtData = hvacLca.penrt || {}

  const hvacGwp = hvacGwpData.total || 0
  const hvacGwpPerM2 = hvacGwpData.per_sqm_ngf || 0
  const hvacPert = hvacPertData.total || 0
  const hvacPertPerM2 = hvacPertData.per_sqm_ngf || 0
  const hvacPenrt = hvacPenrtData.total || 0
  const hvacPenrtPerM2 = hvacPenrtData.per_sqm_ngf || 0

  totalInvestmentCost += hvacInvestmentCost
  totalLifecycleCost += hvacLifecycleCost
  totalGWP += hvacGwp
  totalPERT += (hvacPert * 0.277778) // Convert MJ to kWh
  totalPENRT += (hvacPenrt * 0.277778) // Convert MJ to kWh

  // Add HVAC to components array
  componentData.push({
    name: getComponentLabel('hvac'),
    component: 'hvac',
    // Store both investment and lifecycle costs
    investmentCost: showPerM2.value ? hvacInvestmentCostPerM2 : hvacInvestmentCost,
    lifecycleCost: showPerM2.value ? hvacLifecycleCostPerM2 : hvacLifecycleCost,
    // Legacy cost field for backward compatibility - will be set below
    cost: 0, // Will be set below
    gwptotal_a2: showPerM2.value ? hvacGwpPerM2 : hvacGwp,
    gwp: showPerM2.value ? hvacGwpPerM2 : hvacGwp,
    pert: showPerM2.value ? (hvacPertPerM2 * 0.277778) : (hvacPert * 0.277778), // Convert MJ to kWh
    penrt: showPerM2.value ? (hvacPenrtPerM2 * 0.277778) : (hvacPenrt * 0.277778), // Convert MJ to kWh
    area: 0, // HVAC doesn't have area
    uValueOld: 0,
    uValueNew: 0
  })

  // Set the cost field based on active tab for backward compatibility
  componentData.forEach(component => {
    if (activeTab.value === 'lcc') {
      component.cost = component.lifecycleCost
    } else {
      component.cost = component.investmentCost
    }
  })

  return {
    components: componentData,
    totals: {
      // Include both investment and lifecycle costs in totals
      investmentCost: showPerM2.value && ngfArea > 0 ? totalInvestmentCost / ngfArea : totalInvestmentCost,
      lifecycleCost: showPerM2.value && ngfArea > 0 ? totalLifecycleCost / ngfArea : totalLifecycleCost,
      // Legacy cost field for backward compatibility
      cost: activeTab.value === 'lcc' 
        ? (showPerM2.value && ngfArea > 0 ? totalLifecycleCost / ngfArea : totalLifecycleCost)
        : (showPerM2.value && ngfArea > 0 ? totalInvestmentCost / ngfArea : totalInvestmentCost),
      gwp: showPerM2.value && ngfArea > 0 ? totalGWP / ngfArea : totalGWP,
      pert: showPerM2.value && ngfArea > 0 ? totalPERT / ngfArea : totalPERT,
      penrt: showPerM2.value && ngfArea > 0 ? totalPENRT / ngfArea : totalPENRT,
      area: ngfArea
    }
  }
})

// Computed data for component-level detail
const componentLevelData = computed(() => {
  const results = effectiveLcaLccResults.value
  console.log('🔄 componentLevelData computed recalculated:', {
    hasResults: !!results,
    selectedComponent: selectedComponent.value,
    resultsKeys: results ? Object.keys(results) : [],
    hasComponentData: results && selectedComponent.value ? !!results[selectedComponent.value] : false
  })
  
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
  console.log('🔄 buildingComparisonChartData computed recalculated:', {
    hasBuildingData: !!buildingLevelData.value,
    activeTab: activeTab.value,
    showPerM2: showPerM2.value,
    selectedIndicator: selectedIndicator.value
  })
  
  if (!buildingLevelData.value) return null

  const components = buildingLevelData.value.components
  const labels = components.map(c => c.name)
  const unit = showPerM2.value ? '/m²' : ''
  
  if (activeTab.value === 'investments') {
    return {
      labels,
      datasets: [{
        label: `Investitionskosten (€${unit})`,
        data: components.map(c => c.cost),
        backgroundColor: '#F59E0B',
        borderColor: '#D97706',
        borderWidth: 1
      }]
    }
  } else if (activeTab.value === 'lcc') {
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
  } else if (activeTab.value === 'lca') {
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

  return null
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
          if (activeTab.value === 'investments' || activeTab.value === 'lcc') {
            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}${unit}`
          } else if (activeTab.value === 'lca') {
            return `${context.dataset.label}: ${formatNumber(context.parsed.y)}${unit}`
          }
          return `${context.dataset.label}: ${formatNumber(context.parsed.y)}${unit}`
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

// Construction selection functions
const openConstructionSheet = async () => {
  isConstructionSheetOpen.value = true
  try {
    await fetchAllConstructionTypes()
  } catch (err) {
    console.error('Error fetching construction types:', err)
    toast.error('Fehler beim Laden der Konstruktionstypen')
  }
}

const analyzeWithConstructions = async () => {
  if (!props.buildingData || !props.geometryData) {
    toast.error('Fehlende Gebäudedaten für die Analyse')
    return
  }

  if (!props.analyzeWithConstructionsFunction) {
    toast.error('Analysefunktion nicht verfügbar')
    return
  }

  try {
    isAnalyzingWithConstructions.value = true
    constructionAnalysisError.value = ''

    // Use the analysis function passed from parent
    const data = await props.analyzeWithConstructionsFunction(
      props.buildingData,
      props.geometryData,
      constructionSelections,
      props.selectedCo2PathScenario || 'KSG',
      props.selectedCo2CostScenario || '0% reine Zeitpräferenzrate',
      props.retrofitScenario // Include retrofit scenario data
    )
    
    console.log('✅ Construction analysis completed via parent function:', data)
    
    // Close the sheet
    isConstructionSheetOpen.value = false


  } catch (err) {
    console.error('❌ Construction analysis error:', err)
    constructionAnalysisError.value = err instanceof Error ? err.message : 'Unbekannter Fehler'
    
    toast.error('Konstruktionsanalyse fehlgeschlagen', {
      description: constructionAnalysisError.value
    })
  } finally {
    isAnalyzingWithConstructions.value = false
  }
}

const resetConstructionSelections = () => {
  resetSelections()
  toast.success('Auswahl zurückgesetzt', {
    description: 'Die Konstruktionsauswahl wurde auf die Standardwerte zurückgesetzt.'
  })
}

// Check if retrofit scenario has building envelope renovation
const hasEnvelopeRenovation = computed(() => {
  return props.retrofitScenario?.energy_standard && props.retrofitScenario?.construction_year
})

watch(() => props.isLoading, (newLoading, oldLoading) => {
  console.log('🔄 Loading state changed:', {
    from: oldLoading,
    to: newLoading,
    hasLcaResults: !!props.lcaLccResults,
    hasSummaryData: !!props.summaryData
  })
})

// Force reactivity by creating a computed key based on data
const dataKey = computed(() => {
  const lcaKey = props.lcaLccResults ? JSON.stringify(Object.keys(props.lcaLccResults).sort()) : 'no-lca'
  const summaryKey = props.summaryData ? JSON.stringify(Object.keys(props.summaryData).sort()) : 'no-summary'
  const key = `${lcaKey}-${summaryKey}`
  console.log('🔄 dataKey computed:', { lcaKey, summaryKey, finalKey: key })
  return key
})

// Add a watcher to force chart updates when data changes
watch([() => props.lcaLccResults, () => props.summaryData], ([newLca, newSummary], [oldLca, oldSummary]) => {
  console.log('🔄 Props changed - analyzing data:', {
    lcaChanged: newLca !== oldLca,
    summaryChanged: newSummary !== oldSummary,
    newLcaKeys: newLca ? Object.keys(newLca) : [],
    newSummaryKeys: newSummary ? Object.keys(newSummary) : [],
    oldLcaKeys: oldLca ? Object.keys(oldLca) : [],
    oldSummaryKeys: oldSummary ? Object.keys(oldSummary) : []
  })
  
  // Only force update if data actually changed
  if (newLca !== oldLca || newSummary !== oldSummary) {
    console.log('🚨 Data has changed - checking content:', {
      newLcaContent: newLca,
      newSummaryContent: newSummary,
      hasNewLcaData: !!newLca && Object.keys(newLca).length > 0,
      hasNewSummaryData: !!newSummary && Object.keys(newSummary).length > 0
    })
    
    // Force reactivity on next tick
    nextTick(() => {
      console.log('🔄 NextTick - checking computed states after data change:', {
        effectiveLcaLccResults: !!effectiveLcaLccResults.value,
        effectiveSummaryData: !!effectiveSummaryData.value,
        buildingLevelData: !!buildingLevelData.value,
        componentLevelData: !!componentLevelData.value,
        buildingComparisonChartData: !!buildingComparisonChartData.value
      })
    })
  }
}, { deep: true, immediate: true })
</script>

<template>
  <div class="w-full space-y-6" :key="dataKey">
    <!-- Header with controls -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">Lebenszyklusanalyse</h2>
        <p class="text-muted-foreground">
          Analyse der Umweltauswirkungen und Lebenszykluskosten der Sanierungsmaßnahmen
        </p>
      </div>
      
      <div class="flex items-center space-x-4">
        <!-- Construction Selection Button -->
        <Sheet :open="isConstructionSheetOpen" @update:open="isConstructionSheetOpen = $event">
          <SheetTrigger as-child>
            <Button variant="outline" size="sm" @click="openConstructionSheet">
              <Settings class="h-4 w-4 mr-2" />
              Konstruktionsauswahl
            </Button>
          </SheetTrigger>
          
          <SheetContent side="right" class="w-[600px] sm:w-[700px] flex flex-col">
            <SheetHeader>
              <SheetTitle>Konstruktionsauswahl für LCA</SheetTitle>
              <SheetDescription>
                Wählen Sie spezifische Konstruktionstypen für eine detaillierte Lebenszyklusanalyse aus.
              </SheetDescription>
            </SheetHeader>
            
            <!-- Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto py-4">
              <div class="space-y-6 px-4">
                <!-- Error Message -->
                <div v-if="constructionError" class="bg-red-50 border border-red-200 rounded-md p-3">
                  <p class="text-sm text-red-600">{{ constructionError }}</p>
                </div>
                
                <!-- Warning Message for Missing Envelope Renovation -->
                <div v-if="!hasEnvelopeRenovation" class="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <div class="flex items-start space-x-2">
                    <AlertTriangle class="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div class="text-sm text-amber-800">
                      <p class="font-medium mb-1">Sanierung der Gebäudehülle erforderlich</p>
                      <p>
                        Bitte definieren Sie zuerst ein Sanierungsszenario mit Energiestandard und Sanierungsjahr 
                        für die Gebäudehülle, bevor Sie die Konstruktionsauswahl verwenden.
                      </p>
                    </div>
                  </div>
                </div>
                
                <!-- Loading State -->
                <div v-if="isLoadingConstructions" class="space-y-4">
                  <div v-for="i in 4" :key="i" class="space-y-2">
                    <Skeleton class="h-4 w-24" />
                    <Skeleton class="h-10 w-full" />
                  </div>
                </div>
                
                <!-- Construction Selection Forms -->
                <div v-else class="space-y-6">
                  <!-- Fenster (Windows) -->
                  <div class="space-y-3">
                    <div>
                      <h3 class="text-lg font-medium">Fenster</h3>
                      <p class="text-sm text-muted-foreground">Auswahl der Fensterkonstruktion</p>
                    </div>
                    <Select 
                      :model-value="constructionSelections.window_construction"
                      @update:model-value="(value) => updateConstructionSelection('Fenster', value as string)"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie eine Fensterkonstruktion..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="construction in getConstructionOptions('Fenster')"
                          :key="construction.construction_number"
                          :value="construction.construction_number"
                        >
                          {{ construction.construction_name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Separator />
                  
                  <!-- Außenwand (Walls) -->
                  <div class="space-y-3">
                    <div>
                      <h3 class="text-lg font-medium">Außenwand</h3>
                      <p class="text-sm text-muted-foreground">Auswahl der Außenwandkonstruktion</p>
                    </div>
                    <Select 
                      :model-value="constructionSelections.wall_construction"
                      @update:model-value="(value) => updateConstructionSelection('Außenwand', value as string)"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie eine Außenwandkonstruktion..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="construction in getConstructionOptions('Außenwand')"
                          :key="construction.construction_number"
                          :value="construction.construction_number"
                        >
                          {{ construction.construction_name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Separator />
                  
                  <!-- Dach (Roof) -->
                  <div class="space-y-3">
                    <div>
                      <h3 class="text-lg font-medium">Dach</h3>
                      <p class="text-sm text-muted-foreground">Auswahl der Dachkonstruktion</p>
                    </div>
                    <Select 
                      :model-value="constructionSelections.roof_construction"
                      @update:model-value="(value) => updateConstructionSelection('Dach', value as string)"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie eine Dachkonstruktion..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="construction in getConstructionOptions('Dach')"
                          :key="construction.construction_number"
                          :value="construction.construction_number"
                        >
                          {{ construction.construction_name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Separator />
                  
                  <!-- Boden (Base/Floor) -->
                  <div class="space-y-3">
                    <div>
                      <h3 class="text-lg font-medium">Boden</h3>
                      <p class="text-sm text-muted-foreground">Auswahl der Bodenkonstruktion</p>
                    </div>
                    <Select 
                      :model-value="constructionSelections.base_construction"
                      @update:model-value="(value) => updateConstructionSelection('Boden', value as string)"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wählen Sie eine Bodenkonstruktion..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="construction in getConstructionOptions('Boden')"
                          :key="construction.construction_number"
                          :value="construction.construction_number"
                        >
                          {{ construction.construction_name }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Separator />
                  
                  <!-- Dynamic LCA Option -->
                  <div class="space-y-3">
                    <div>
                      <h3 class="text-lg font-medium">Erweiterte Optionen</h3>
                      <p class="text-sm text-muted-foreground">Zusätzliche Einstellungen für die LCA</p>
                    </div>
                    <div class="flex items-center space-x-2">
                      <Switch 
                        id="dynamic-lca"
                        v-model="constructionSelections.dynamic_lca"
                      />
                      <Label for="dynamic-lca" class="text-sm">
                        Dynamische LCA aktivieren
                      </Label>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      Berücksichtigt zeitabhängige Faktoren in der Lebenszyklusanalyse
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <SheetFooter class="mt-4 border-t pt-4 px-4">
              <div class="flex space-x-2 w-full">
                <Button 
                  variant="outline" 
                  @click="resetConstructionSelections"
                  class="flex-1"
                >
                  Zurücksetzen
                </Button>
                <Button 
                  variant="outline" 
                  @click="isConstructionSheetOpen = false"
                  class="flex-1"
                >
                  Abbrechen
                </Button>
                <Button 
                  @click="analyzeWithConstructions"
                  :disabled="isAnalyzingWithConstructions || !hasEnvelopeRenovation"
                  class="flex-1"
                >
                  <template v-if="isAnalyzingWithConstructions">
                    <span class="animate-spin mr-2">⟳</span>
                    Analysiere...
                  </template>
                  <template v-else>
                    Analyse starten
                  </template>
                </Button>
              </div>
              
              <!-- Error Message -->
              <div v-if="constructionAnalysisError" class="mt-2 text-xs text-red-500">
                {{ constructionAnalysisError }}
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        
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
              <TabsList v-if="viewMode === 'building'" class="grid w-full grid-cols-3">
                <TabsTrigger value="investments" class="flex items-center justify-center space-x-1 text-xs">
                  <Euro class="h-3 w-3" />
                  <span>Invest.</span>
                </TabsTrigger>
                <TabsTrigger value="lca" class="flex items-center justify-center space-x-1 text-xs">
                  <Leaf class="h-3 w-3" />
                  <span>LCA</span>
                </TabsTrigger>
                <TabsTrigger value="lcc" class="flex items-center justify-center space-x-1 text-xs">
                  <Euro class="h-3 w-3" />
                  <span>LCC</span>
                </TabsTrigger>
              </TabsList>
              <TabsList v-else class="grid w-full grid-cols-2">
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
            {{ (viewMode === 'system' && componentLevelData?.isHvac) ? 'Pro kW Leistung anzeigen' : 
               (viewMode === 'building') ? 'Pro m² NGF anzeigen' : 'Pro m² Bauteilfläche anzeigen' }}
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
        <!-- Investment Cost Card -->
        <Card v-if="activeTab === 'investments'">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">
              {{ showPerM2 ? 'Investitionskosten pro m²' : 'Gesamte Investitionskosten' }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ formatCurrency(buildingLevelData.totals.cost) }}{{ showPerM2 ? '/m²' : '' }}
            </div>
            <p class="text-xs text-muted-foreground">Investitionskosten</p>
          </CardContent>
        </Card>

        <!-- LCC Cost Card -->
        <Card v-if="activeTab === 'lcc'">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">
              {{ showPerM2 ? 'LCC-Kosten pro m²' : 'Gesamte LCC-Kosten' }}
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
            <CardTitle class="text-sm font-medium">Treibhauspotential (GWP)</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ showPerM2 ? formatNumber(buildingLevelData.totals.gwp, 1) : formatNumber(buildingLevelData.totals.gwp / 1000, 1) }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ showPerM2 ? 'kg CO₂-eq/m²' : 't CO₂-eq' }}
            </p>
          </CardContent>
        </Card>

        <!-- PERT Card -->
        <Card v-if="activeTab === 'lca'">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Primärenergie erneuerbar (PERT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ showPerM2 ? formatNumber(buildingLevelData.totals.pert, 1) : formatNumber(buildingLevelData.totals.pert / 1000, 1) }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ showPerM2 ? 'kWh/m²' : 'MWh' }}
            </p>
          </CardContent>
        </Card>

        <!-- PENRT Card -->
        <Card v-if="activeTab === 'lca'">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm font-medium">Primärenergie nicht-erneuerbar (PENRT)</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">
              {{ showPerM2 ? formatNumber(buildingLevelData.totals.penrt, 1) : formatNumber(buildingLevelData.totals.penrt / 1000, 1) }}
            </div>
            <p class="text-xs text-muted-foreground">
              {{ showPerM2 ? 'kWh/m²' : 'MWh' }}
            </p>
          </CardContent>
        </Card>
      </div>

      <!-- Components Comparison Chart -->
      <Card>
        <CardHeader>
          <CardTitle>Vergleich nach Bauteilen/Komponenten</CardTitle>
          <CardDescription>
            <span v-if="activeTab === 'investments'">Investitionskosten aufgeschlüsselt nach Bauteilen/Komponenten</span>
            <span v-else-if="activeTab === 'lca'">Umweltauswirkungen aufgeschlüsselt nach Bauteilen/Komponenten</span>
            <span v-else-if="activeTab === 'lcc'">Lebenszykluskosten aufgeschlüsselt nach Bauteilen/Komponenten</span>
            {{ showPerM2 ? '(pro m²)' : '(Gesamtwerte)' }}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="h-80">
            <Bar 
              v-if="buildingComparisonChartData"
              :data="buildingComparisonChartData" 
              :options="chartOptions"
            />
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
