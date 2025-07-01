<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRetrofitAnalysis } from '@/composables/useRetrofitAnalysis'
import { useEnergyMetricsCards } from '@/composables/useEnergyMetricsCards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import ArcGISSceneViewer from '@/components/map/ArcGISSceneViewer.vue'
import LifecycleAnalysis from '@/components/analysis/LifecycleAnalysis.vue'
import EnergyAnalysis from '@/components/analysis/EnergyAnalysis.vue'
import Dekarbonisierung from '@/components/analysis/Dekarbonisierung.vue'
import { Plus, Settings, X, Zap, Factory, AlertTriangle, Euro, CircleFadingPlus, ChartNoAxesGantt, TrendingDown, CheckCircle, AlertCircle } from 'lucide-vue-next'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Router
let route: any
try {
  route = useRoute()
} catch (err) {
  console.error('Error accessing route:', err)
  // Create a fallback route object
  route = {
    params: {},
    query: {},
    path: '/'
  }
}

// Props (for when accessed via route params)
interface Props {
  gebid?: string
}

const props = withDefaults(defineProps<Props>(), {
  gebid: ''
})

// Reactive variables
const isSearching = ref(false)
const searchError = ref('')
const currentGmlIds = ref<string[]>([])
const showViewer = ref(false)
const apiBaseUrl = ref('http://localhost:8080')
const buildingData = ref<any>(null)
const geometryData = ref<any>(null)
const geometryLoading = ref(false)
const geometryError = ref('')

// Retrofit scenario state
const isSheetOpen = ref(false)
const isLoadingFormData = ref(false)
const formDataError = ref('')
const formData = ref<FormDataResponse | null>(null)
const retrofitScenario = ref<RetrofitScenario | null>(null)
const isDeleteDialogOpen = ref(false)

// Energy standards state
const isLoadingEnergyStandards = ref(false)
const energyStandardsError = ref('')
const energyStandards = ref<EnergyStandardsResponse | null>(null)

// Construction details state
const isConstructionDetailsOpen = ref(false)

// Analysis tab state
const activeAnalysisTab = ref('overview') // 'overview', 'energy', 'lifecycle', or 'dekarbonisierung'

// Missing data state
const missingData = ref<string[]>([])
const isLoadingMissingData = ref(false)
const missingDataError = ref('')

// Store for undo functionality
const deletedScenario = ref<RetrofitScenario | null>(null)
const deletedFormState = ref<{
  selectedEnergyStandard: string
  selectedHVACType: string
  selectedHVAC: string
  constructionYear: string
  hvacYear: string
} | null>(null)

// Form state for energy standards (replaces construction details)
const selectedEnergyStandard = ref<string>('')
const constructionYear = ref<string>('')

// Form state for HVAC
const selectedHVACType = ref<string>('')
const selectedHVAC = ref<string>('')
const hvacYear = ref<string>('')

// Use composables
const { 
  isAnalyzingRetrofit, 
  retrofitAnalysisError, 
  retrofitAnalysisResult, 
  analyzeBaseScenario, 
  analyzeRetrofitScenario,
  analyzeWithConstructions
} = useRetrofitAnalysis()

const { 
  selectedEnergyType, 
  selectedEnergyUnit, 
  selectedEmissionType, 
  selectedEmissionUnit, 
  selectedCostType, 
  selectedCostUnit,
  formatNumber,
  getImprovementColorClass,
  getRiskColorClass,
  createCardData
} = useEnergyMetricsCards()

// Create card data using the composable
const { 
  energyCardData, 
  emissionCardData, 
  strandingCardData, 
  costCardData 
} = createCardData(computed(() => retrofitAnalysisResult.value))

// Settings and CO2 scenarios state (not moved to composables yet)
const isSettingsOpen = ref(false)
const co2PathScenarios = ref<string[]>([])
const co2CostScenarios = ref<string[]>([])
const selectedCo2PathScenario = ref('KSG') // Default value
const selectedCo2CostScenario = ref('0% reine Zeitpräferenzrate') // Default value
const isLoadingCo2Scenarios = ref(false)
const co2ScenariosError = ref('')

// Temporary state for settings dialog (before saving)
const tempSelectedCo2PathScenario = ref('KSG')
const tempSelectedCo2CostScenario = ref('0% reine Zeitpräferenzrate')

// Interface for the API response
interface BuildingDataResponse {
  gebid: string
  include_gml_mapping: boolean
  status: string
  data: {
    buildings_assumptions: {
      gebid: string
      epl: string
      babez: string
      ligbez: string
      gebzabt: string
      [key: string]: any
      gebplz: string
      mapped_system_type: string
      construction_year: string
    }
    gmlid_gebid_mapping: Array<{
      gebid: string
      gmlid: string
      epl: string | null
      babez: string | null
      gebzabt: string | null
      ligbez: string | null
      geprueft: string
      kontrollbedarf: string
      konsistent_citygml_fdh: string
      kommentar: string | null
      bearbeitungsbedarf_ldbv: string | null
      fdh_merge: string | null
      edited_at: string
    }>
  }
}

// Interface for geometry response
interface GeometryResponse {
  [key: string]: any // Allow dynamic keys since the structure is nested
}

// Interface for form data response
interface FormDataResponse {
  construction_types: string[]
  hvac_types: string[]
  construction_samples: {
    [key: string]: Array<{
      construction_number: string
      construction_name: string
      construction_type: string
    }>
  }
  hvac_samples: {
    [key: string]: Array<{
      hvac_number: string
      hvac_name: string
      hvac_type: string
    }>
  }
  co2_path_scenarios: string[]
  co2_cost_scenarios: string[]
  form_structure: {
    construction_fields: string[]
    hvac_fields: string[]
    co2_scenario_fields: string[]
  }
  year_ranges: {
    construction_retrofit_year: {
      min: number
      max: number
      default: number
      description: string
    }
    hvac_retrofit_year: {
      min: number
      max: number
      default: number
      description: string
    }
  }
}

// Interface for energy standards response
interface EnergyStandardsResponse {
  status: string
  is_heritage: boolean
  standards: string[]
  description: string
  count: number
}

// Interface for missing data response
interface MissingDataResponse {
  status: string
  gebid: string
  missing_fields: string[]
}

// Interface for retrofit scenario
interface RetrofitScenario {
  energy_standard: {
    id: string
    name: string
    description?: string
    [key: string]: any
  } | null
  construction_year: string | null
  hvac: {
    hvac_number: string
    hvac_name: string
    hvac_type: string
  } | null
  hvac_year: string | null
}

// Get building category directly from database (no mapping needed)
const getBuildingCategory = (assumptions: any): string => {
  const enobCategory = assumptions?.enob_category
  console.log('🏢 Raw enob_category from database:', enobCategory)
  
  // Use the raw value from database, fallback to default if missing
  return enobCategory || 'Wohngebäude' // Default fallback
}

// Parse construction year with proper validation
const parseConstructionYear = (construction_year: string | number | null | undefined): string => {
  if (!construction_year) return "1950" // Default fallback year
  
  const year = typeof construction_year === 'string' ? parseInt(construction_year) : construction_year
  
  // Validate year range (buildings should be between 1800 and current year)
  if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
    console.warn(`Invalid construction year: ${construction_year}, using default 1950`)
    return "1950"
  }
  
  return String(year)
}

// Search for building by GEBID
const searchBuilding = async (gebidToSearch: string) => {
  try {
    console.log('🔍 searchBuilding called with:', gebidToSearch)
    
    if (!gebidToSearch) {
      searchError.value = 'Please enter a GEBID'
      console.log('❌ No gebidToSearch provided')
      return
    }

    console.log('🚀 Starting search for building:', gebidToSearch)
    isSearching.value = true
    searchError.value = ''
    showViewer.value = false
    missingData.value = []
    missingDataError.value = ''

    try {
      const url = `${apiBaseUrl.value}/api/database/get_building_data/${encodeURIComponent(gebidToSearch)}`
      console.log('📡 Fetching from URL:', url)
      
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData: BuildingDataResponse = await response.json()
      console.log('✅ Building data response received:', responseData)
      console.log('Response data keys:', Object.keys(responseData.data || {}))
      console.log('Buildings assumptions:', responseData.data?.buildings_assumptions)
      console.log('GML mapping:', responseData.data?.gmlid_gebid_mapping)

      // Check if the response is successful and has data
      if (responseData.status === 'success' && responseData.data) {
        const { data } = responseData
        
        // Store building data for display
        buildingData.value = data
        console.log('💾 Stored buildingData:', buildingData.value)
        console.log('Building assumptions in stored data:', buildingData.value?.buildings_assumptions)
        
        // Fetch missing data for this building
        fetchMissingData(gebidToSearch).catch(err => {
          console.error('Non-blocking missing data fetch error:', err)
        })
        
        // Extract GML IDs from the nested data structure
        if (data.gmlid_gebid_mapping && data.gmlid_gebid_mapping.length > 0) {
          currentGmlIds.value = data.gmlid_gebid_mapping.map(item => item.gmlid)
          console.log('🗺️ Found GML IDs:', currentGmlIds.value)
          
          // Show the viewer immediately (each card will handle its own loading)
          showViewer.value = true
          console.log('👁️ Set showViewer to true')
          
          // Fetch geometry data for the GML IDs (non-blocking)
          fetchGeometry(currentGmlIds.value).catch(err => {
            console.error('Non-blocking geometry fetch error:', err)
          })
        } else {
          searchError.value = 'No GML ID mapping found for this GEBID'
          console.log('❌ No GML ID mapping found')
        }
      } else {
        searchError.value = `API returned status: ${responseData.status || 'unknown'}`
        console.log('❌ API returned unsuccessful status:', responseData.status)
      }

    } catch (err) {
      searchError.value = `Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      console.error('❌ Search error:', err)
    } finally {
      isSearching.value = false
      console.log('🏁 Search completed, isSearching:', isSearching.value, 'showViewer:', showViewer.value)
    }
  } catch (err) {
    console.error('❌ Outer search error:', err)
    searchError.value = 'An unexpected error occurred'
    isSearching.value = false
  }
}

// Fetch missing data for building
const fetchMissingData = async (gebid: string) => {
  try {
    console.log('🔍 Fetching missing data for GEBID:', gebid)
    
    if (!gebid) {
      console.log('❌ No GEBID provided for missing data fetch')
      return
    }

    isLoadingMissingData.value = true
    missingDataError.value = ''

    const url = `${apiBaseUrl.value}/api/database/get_missing_data/${encodeURIComponent(gebid)}`
    console.log('📡 Fetching missing data from URL:', url)
    
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseData: MissingDataResponse = await response.json()
    console.log('✅ Missing data response received:', responseData)

    if (responseData.status === 'success') {
      missingData.value = responseData.missing_fields || []
      console.log('📋 Missing fields:', missingData.value)
    } else {
      missingDataError.value = `API returned status: ${responseData.status || 'unknown'}`
      console.log('❌ API returned unsuccessful status:', responseData.status)
    }

  } catch (err) {
    missingDataError.value = `Failed to fetch missing data: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('❌ Missing data fetch error:', err)
  } finally {
    isLoadingMissingData.value = false
    console.log('🏁 Missing data fetch completed')
  }
}

// Watch for route changes (both params and query)
watch(() => {
  try {
    return [route.params?.gebid, route.query?.gebid, route.path]
  } catch (err) {
    console.error('Error accessing route in watcher:', err)
    return [null, null, null]
  }
}, (newValues, oldValues) => {
  try {
    const [paramGebid, queryGebid, path] = newValues || [null, null, null]
    const [oldParamGebid, oldQueryGebid, oldPath] = oldValues || [null, null, null]
    
    const newGebid = paramGebid || queryGebid
    const oldGebid = oldParamGebid || oldQueryGebid
    
    console.log('Route changed:', { 
      paramGebid, 
      queryGebid, 
      newGebid, 
      oldGebid, 
      path,
      oldPath
    })
    
    if (newGebid && typeof newGebid === 'string') {
      // Only search if we don't already have this building loaded
      const currentGebid = buildingData.value?.buildings_assumptions?.gebid
      if (currentGebid !== newGebid) {
        console.log('Triggering searchBuilding from route watcher for:', newGebid)
        searchBuilding(newGebid)
      }
    } else if (!newGebid && oldGebid) {
      // Route changed but no gebid - reset the view
      console.log('Route changed to no gebid, resetting view')
      showViewer.value = false
      buildingData.value = null
      currentGmlIds.value = []
      missingData.value = []
      missingDataError.value = ''
    }
  } catch (err) {
    console.error('Error in route watcher callback:', err)
  }
}, { immediate: true })

// Initialize from props or route
onMounted(() => {
  try {
    console.log('BuildingViewer mounted with full route info:', { 
      propsGebid: props.gebid, 
      routeGebid: route.params.gebid, 
      routePath: route.path,
      routeName: route.name,
      fullRoute: route,
      allParams: route.params,
      allQuery: route.query
    })
    
    // Fetch CO2 scenarios on mount
    fetchCo2Scenarios().catch(err => {
      console.error('Error fetching CO2 scenarios:', err)
    })
    
    const initialGebid = props.gebid || route.params.gebid
    if (initialGebid && typeof initialGebid === 'string') {
      console.log('Initializing with gebid:', initialGebid)
      searchBuilding(initialGebid)
    } else {
      console.log('No initial gebid found - checking alternative sources')
      console.log('Route params keys:', Object.keys(route.params))
      console.log('Route query keys:', Object.keys(route.query))
      console.log('Checking if gebid is in query:', route.query.gebid)
      
      // Check if gebid is in query parameters instead
      if (route.query.gebid && typeof route.query.gebid === 'string') {
        console.log('Found gebid in query parameters:', route.query.gebid)
        searchBuilding(route.query.gebid)
      }
    }
  } catch (err) {
    console.error('Error in onMounted:', err)
    searchError.value = 'Initialization error occurred'
  }
})

// Fetch geometry data from API
const fetchGeometry = async (gmlIds: string[]) => {
  console.log('🌐 Starting fetchGeometry in BuildingViewer...')
  
  if (!gmlIds || gmlIds.length === 0) {
    geometryError.value = 'No GML IDs provided'
    console.error('❌ No GML IDs provided')
    return
  }

  console.log('📡 Fetching geometry for GML IDs:', gmlIds)
  geometryLoading.value = true
  geometryError.value = ''
  
  try {
    // Create URLSearchParams object to handle multiple gmlids
    const params = new URLSearchParams()
    
    // Add each GML ID as a separate gmlids parameter
    gmlIds.forEach(gmlId => {
      params.append('gmlids', gmlId)
    })
    
    // Extract actual building data instead of hard-coded values
    const assumptions = buildingData.value?.buildings_assumptions
    if (!assumptions) {
      throw new Error('Building assumptions data is missing')
    }
    
    const actualBuildingCategory = getBuildingCategory(assumptions)
    const actualConstructionYear = parseConstructionYear(assumptions?.construction_year)
    
    // Add required parameters with actual building data
    params.append('building_category', actualBuildingCategory)
    params.append('construction_year', actualConstructionYear.toString())
    params.append('radius', '50')
    params.append('calculate_window_areas', 'true')
    
    const url = `${apiBaseUrl.value}/api/geometry/get_geometry?${params.toString()}`
    console.log('🔗 API URL:', url)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      let errorDetail = ''
      try {
        const errorData = await response.json()
        console.error('❌ Geometry API error response:', errorData)
        
        if (Array.isArray(errorData.detail)) {
          errorDetail = errorData.detail.map((err: any) => 
            `${err.loc.join('.')}: ${err.msg} (${err.type})`
          ).join('\n')
        } else if (errorData.detail) {
          errorDetail = errorData.detail
        } else if (errorData.message) {
          errorDetail = errorData.message
        } else {
          errorDetail = JSON.stringify(errorData)
        }
      } catch (e) {
        errorDetail = `HTTP error! status: ${response.status}`
      }
      throw new Error(errorDetail)
    }
    
    const data: GeometryResponse = await response.json()
    console.log('✅ Geometry API Response received:', data)
    
    // Store geometry data
    geometryData.value = data
    
    // Automatically trigger base scenario analysis after geometry is loaded
    console.log('🚀 Geometry loaded successfully, triggering base scenario analysis...')
    analyzeBaseScenario(
      buildingData.value,
      geometryData.value,
      co2PathScenarios.value,
      co2CostScenarios.value,
      selectedCo2PathScenario.value,
      selectedCo2CostScenario.value
    ).catch(err => {
      console.error('❌ Base scenario analysis failed:', err)
      // Don't show error toast here as it's automatic - just log it
    })
    
  } catch (err) {
    geometryError.value = `Failed to fetch geometry: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('❌ Geometry fetch error:', err)
  } finally {
    geometryLoading.value = false
    console.log('🏁 fetchGeometry completed, loading:', geometryLoading.value)
  }
}

// Fetch form data for retrofit scenarios
const fetchFormData = async () => {
  if (formData.value) return // Already loaded

  isLoadingFormData.value = true
  formDataError.value = ''
  
  try {
    const response = await fetch(`${apiBaseUrl.value}/api/construction-hvac/form-data`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data: FormDataResponse = await response.json()
    console.log('Form data response:', data)
    
    formData.value = data
    
    // Note: Years are intentionally left empty for user input
    
  } catch (err) {
    formDataError.value = `Failed to fetch form data: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Form data fetch error:', err)
  } finally {
    isLoadingFormData.value = false
  }
}

// Fetch energy standards based on heritage status
const fetchEnergyStandards = async () => {
  if (energyStandards.value) return // Already loaded

  isLoadingEnergyStandards.value = true
  energyStandardsError.value = ''
  
  try {
    const isHeritage = buildingData.value?.buildings_assumptions?.is_heritage || false
    console.log('🏛️ Heritage status:', isHeritage)
    console.log('🏛️ Building data assumptions:', buildingData.value?.buildings_assumptions)
    
    const response = await fetch(`${apiBaseUrl.value}/api/database/get_energy_standards?heritage=${isHeritage}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data: EnergyStandardsResponse = await response.json()
    console.log('🏛️ Energy standards response:', data)
    
    energyStandards.value = data
    
  } catch (err) {
    energyStandardsError.value = `Failed to fetch energy standards: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('❌ Energy standards fetch error:', err)
  } finally {
    isLoadingEnergyStandards.value = false
  }
}

// Handle opening retrofit scenario sheet
const openRetrofitSheet = () => {
  try {
    isSheetOpen.value = true
    fetchEnergyStandards().catch(err => {
      console.error('Error fetching energy standards:', err)
    })
    fetchFormData().catch(err => {
      console.error('Error fetching form data:', err)
    })
  } catch (err) {
    console.error('Error opening retrofit sheet:', err)
  }
}

// Check if energy standard is selected
const isEnergyStandardSelected = computed(() => {
  try {
    return selectedEnergyStandard.value !== ''
  } catch (err) {
    console.error('Error in isEnergyStandardSelected computed:', err)
    return false
  }
})

// Check if HVAC is selected
const isHVACSelected = computed(() => {
  try {
    return selectedHVAC.value !== ''
  } catch (err) {
    console.error('Error in isHVACSelected computed:', err)
    return false
  }
})

// Check if at least one section is complete with its year
const isScenarioValid = computed(() => {
  try {
    const hasConstruction = isEnergyStandardSelected.value && constructionYear.value !== ''
    const hasHVAC = isHVACSelected.value && hvacYear.value !== ''
    return hasConstruction || hasHVAC
  } catch (err) {
    console.error('Error in isScenarioValid computed:', err)
    return false
  }
})

// Get validation message for save button
const getValidationMessage = computed(() => {
  try {
    if (!isEnergyStandardSelected.value && !isHVACSelected.value) {
      return 'Bitte wählen Sie mindestens einen Energiestandard oder eine Wärmeversorgungs-Maßnahme'
    }
    if (isEnergyStandardSelected.value && !constructionYear.value) {
      return 'Bitte geben Sie das Sanierungsjahr für die Konstruktion ein'
    }
    if (isHVACSelected.value && !hvacYear.value) {
      return 'Bitte geben Sie das Sanierungsjahr für die Wärmeversorgung ein'
    }
    return ''
  } catch (err) {
    console.error('Error in getValidationMessage computed:', err)
    return 'Validierungsfehler'
  }
})
const getConstructionOptions = (constructionType: string) => {
  try {
    return formData.value?.construction_samples[constructionType] || []
  } catch (err) {
    console.error('Error in getConstructionOptions:', err)
    return []
  }
}

// Get HVAC options for selected type
const getHVACOptions = computed(() => {
  try {
    return selectedHVACType.value ? 
      (formData.value?.hvac_samples[selectedHVACType.value] || []) : 
      []
  } catch (err) {
    console.error('Error in getHVACOptions computed:', err)
    return []
  }
})

// Get construction summary for display
const constructionSummary = computed(() => {
  try {
    if (!retrofitScenario.value) return ''
    
    return retrofitScenario.value.energy_standard?.name || 'Keine Auswahl'
  } catch (err) {
    console.error('Error in constructionSummary computed:', err)
    return 'Fehler bei der Zusammenfassung'
  }
})

// Get building surface areas from geometry data
const buildingSurfaceAreas = computed(() => {
  try {
    console.log('🏢 Checking geometry data for surface areas:', geometryData.value)
    
    if (!geometryData.value) {
      console.log('❌ No geometry data available')
      return null
    }
    
    // Check different possible locations for summed_surface_areas
    let areas = null
    if (geometryData.value.summed_surface_areas) {
      areas = geometryData.value.summed_surface_areas
      console.log('✅ Found summed_surface_areas directly:', areas)
    } else if (geometryData.value.results?.summed_surface_areas) {
      areas = geometryData.value.results.summed_surface_areas
      console.log('✅ Found summed_surface_areas in results:', areas)
    } else {
      // Look for it in nested structure
      for (const key in geometryData.value) {
        if (geometryData.value[key]?.summed_surface_areas) {
          areas = geometryData.value[key].summed_surface_areas
          console.log(`✅ Found summed_surface_areas in ${key}:`, areas)
          break
        }
      }
    }
    
    if (!areas) {
      console.log('❌ No summed_surface_areas found in geometry data')
      console.log('Available keys:', Object.keys(geometryData.value))
      return null
    }
    
    // German translations for surface types
    const surfaceLabels: { [key: string]: string } = {
      'buildingwallsurface_area': 'Außenwandfläche',
      'buildingroofsurface_area': 'Dachfläche', 
      'buildinggroundsurface_area': 'Bodenfläche',
      'buildingwindowsurface_area': 'Fensterfläche',
      'buildingwallsurface_adiabatic_area': 'Außenwandfläche (gemeinsame Flächen)',
      'buildingwallsurface_nonadiabatic_area': 'Außenwandfläche (nicht gemeinsame Flächen)',
      'total_bgf': 'Bruttogrundfläche',
      'total_ngf': 'Nettogrundfläche',
      'total_built_area': 'Bebaute Fläche',
      'a_ngf': 'Gebäudehülle zu Nettogrundfläche'
    }
    
    // Convert to array with German labels and formatted values
    const result = Object.entries(areas).map(([key, value]) => ({
      label: surfaceLabels[key] || key,
      value: typeof value === 'number' ? value.toFixed(2) : 'N/A',
      unit: key === 'a_ngf' ? '[-]' : 'm²'
    }))
    
    console.log('🏢 Processed surface areas:', result)
    return result
  } catch (err) {
    console.error('Error in buildingSurfaceAreas computed:', err)
    return null
  }
})

// Handle saving retrofit scenario
const saveRetrofitScenario = () => {
  try {
    if (!isScenarioValid.value) {
      // Show validation error
      const message = getValidationMessage.value
      if (message) {
        try {
          toast.error('Validierungsfehler', {
            description: message
          })
        } catch (toastErr) {
          console.error('Error showing validation toast:', toastErr)
        }
      }
      return
    }

    let energyStandardData = null
    let hvacData = null

    // Handle energy standard if selected
    if (isEnergyStandardSelected.value && constructionYear.value) {
      const selectedStandardName = selectedEnergyStandard.value
      if (energyStandards.value?.standards.includes(selectedStandardName)) {
        energyStandardData = {
          id: selectedStandardName,
          name: selectedStandardName,
          description: energyStandards.value.description
        }
      }
    }

    // Handle HVAC if selected
    if (isHVACSelected.value && hvacYear.value) {
      const hvacItem = getHVACOptions.value.find(item => item.hvac_number === selectedHVAC.value)
      if (hvacItem) {
        hvacData = hvacItem
      }
    }

    retrofitScenario.value = {
      energy_standard: energyStandardData,
      construction_year: constructionYear.value || null,
      hvac: hvacData,
      hvac_year: hvacYear.value || null
    }

    isSheetOpen.value = false
    
    console.log('Saved retrofit scenario:', retrofitScenario.value)
    
    // Show success message
    try {
      toast.success('Sanierungszenario gespeichert', {
        description: 'Das Sanierungszenario wurde erfolgreich erstellt und die Analyse wird gestartet.'
      })
    } catch (toastErr) {
      console.error('Error showing success toast:', toastErr)
    }

    // Automatically trigger retrofit analysis after saving
    if (buildingData.value && geometryData.value && co2PathScenarios.value.length > 0 && co2CostScenarios.value.length > 0) {
      console.log('🚀 Automatically triggering retrofit analysis after scenario save...')
      analyzeRetrofitScenario(
        buildingData.value,
        geometryData.value,
        retrofitScenario.value,
        selectedCo2PathScenario.value,
        selectedCo2CostScenario.value,
        getHVACOptions.value
      ).catch(err => {
        console.error('❌ Automatic retrofit analysis failed:', err)
        toast.error('Analyse fehlgeschlagen', {
          description: 'Die automatische Analyse des Sanierungsszenarios ist fehlgeschlagen.'
        })
      })
    } else {
      console.warn('⚠️ Cannot trigger automatic analysis - missing required data:', {
        hasBuildingData: !!buildingData.value,
        hasGeometryData: !!geometryData.value,
        co2PathScenariosCount: co2PathScenarios.value.length,
        co2CostScenariosCount: co2CostScenarios.value.length
      })
    }
  } catch (err) {
    console.error('Error saving retrofit scenario:', err)
    // Show error toast if possible
    try {
      toast.error('Fehler beim Speichern', {
        description: 'Das Sanierungszenario konnte nicht gespeichert werden.'
      })
    } catch (toastErr) {
      console.error('Error showing error toast:', toastErr)
    }
  }
}

// Handle canceling/removing retrofit scenario
const removeRetrofitScenario = () => {
  try {
    // Store current state for undo
    deletedScenario.value = { ...retrofitScenario.value! }
    deletedFormState.value = {
      selectedEnergyStandard: selectedEnergyStandard.value,
      selectedHVACType: selectedHVACType.value,
      selectedHVAC: selectedHVAC.value,
      constructionYear: constructionYear.value,
      hvacYear: hvacYear.value
    }
    
    // Clear current scenario
    retrofitScenario.value = null
    selectedEnergyStandard.value = ''
    selectedHVACType.value = ''
    selectedHVAC.value = ''
    constructionYear.value = ''
    hvacYear.value = ''
    
    // Close dialog
    isDeleteDialogOpen.value = false
    
    // Show toast with undo option
    try {
      toast('Sanierungszenario gelöscht', {
        description: 'Das Sanierungszenario wurde erfolgreich entfernt und die Baseline-Analyse wird gestartet.',
        // action: {
        //   label: 'Rückgängig',
        //   onClick: () => undoDeleteScenario()
        // },
        duration: 5000
      })
    } catch (toastErr) {
      console.error('Error showing delete toast:', toastErr)
    }

    // Automatically trigger baseline analysis (with null retrofit scenario)
    if (buildingData.value && geometryData.value && co2PathScenarios.value.length > 0 && co2CostScenarios.value.length > 0) {
      console.log('🚀 Automatically triggering baseline analysis after scenario deletion...')
      
      // Create an empty/null retrofit scenario to revert to baseline
      const nullRetrofitScenario = {
        energy_standard: null,
        construction_year: null,
        hvac: null,
        hvac_year: null
      }
      
      analyzeRetrofitScenario(
        buildingData.value,
        geometryData.value,
        nullRetrofitScenario,
        selectedCo2PathScenario.value,
        selectedCo2CostScenario.value,
        getHVACOptions.value
      ).catch(err => {
        console.error('❌ Automatic baseline analysis failed:', err)
        toast.error('Baseline-Analyse fehlgeschlagen', {
          description: 'Die automatische Baseline-Analyse nach dem Löschen ist fehlgeschlagen.'
        })
      })
    } else {
      console.warn('⚠️ Cannot trigger automatic baseline analysis - missing required data:', {
        hasBuildingData: !!buildingData.value,
        hasGeometryData: !!geometryData.value,
        co2PathScenariosCount: co2PathScenarios.value.length,
        co2CostScenariosCount: co2CostScenarios.value.length
      })
    }
  } catch (err) {
    console.error('Error removing retrofit scenario:', err)
  }
}

// Undo delete scenario
const undoDeleteScenario = () => {
  try {
    if (deletedScenario.value && deletedFormState.value) {
      // Restore scenario
      retrofitScenario.value = deletedScenario.value
      
      // Restore form state
      selectedEnergyStandard.value = deletedFormState.value.selectedEnergyStandard
      selectedHVACType.value = deletedFormState.value.selectedHVACType
      selectedHVAC.value = deletedFormState.value.selectedHVAC
      constructionYear.value = deletedFormState.value.constructionYear
      hvacYear.value = deletedFormState.value.hvacYear
      
      // Clear undo data
      deletedScenario.value = null
      deletedFormState.value = null
      
      // Show success toast
      try {
        toast.success('Sanierungszenario wiederhergestellt', {
          description: 'Das Sanierungszenario wurde erfolgreich wiederhergestellt.'
        })
      } catch (toastErr) {
        console.error('Error showing success toast:', toastErr)
      }
    }
  } catch (err) {
    console.error('Error undoing delete scenario:', err)
  }
}

// Handle delete button click (opens confirmation dialog)
const handleDeleteClick = () => {
  try {
    isDeleteDialogOpen.value = true
  } catch (err) {
    console.error('Error opening delete dialog:', err)
  }
}

// Format display values for German localization
const formatDisplayValue = (value: any) => {
  if (value === true) return 'Ja'
  if (value === false) return 'Nein'
  if (value === null || value === undefined || value === '' || value === 'N/A') return 'keine Info vorhanden'
  return value
}

// Translate field names to German for better UX
const translateFieldName = (fieldName: string): string => {
  const fieldTranslations: { [key: string]: string } = {
    'verxxh': 'Wärmeversorgung',
    'construction_year': 'Baujahr',
    'epl': 'Einzelpan',
    'bgf': 'Bruttogrundfläche',
    'ngf': 'Nettogrundfläche',
    'babez': 'Bauamtbezeichnung',
    'ligbez': 'Liegenschaftsbezeichnung',
    'gebzabt': 'Gebäudezuordnung',
    'enob_category': 'EnOB-Kategorie',
    'sq_standard': 'Status Quo Standard',
    'is_heritage': 'Denkmalschutz',
    'current_system_type': 'Wärmeversorgung',
    'hvac': 'Wärmeversorgung'
  }
  
  return fieldTranslations[fieldName] || fieldName
}

// Handle modifying existing scenario
const modifyRetrofitScenario = () => {
  try {
    if (retrofitScenario.value) {
      // Restore energy standard selection
      selectedEnergyStandard.value = retrofitScenario.value.energy_standard?.name || ''
      constructionYear.value = retrofitScenario.value.construction_year || ''
      
      // Restore HVAC selections
      selectedHVACType.value = retrofitScenario.value.hvac?.hvac_type || ''
      selectedHVAC.value = retrofitScenario.value.hvac?.hvac_number || ''
      hvacYear.value = retrofitScenario.value.hvac_year || ''
    }
    isSheetOpen.value = true
    fetchEnergyStandards().catch(err => {
      console.error('Error fetching energy standards:', err)
    })
    fetchFormData().catch(err => {
      console.error('Error fetching form data:', err)
    })
  } catch (err) {
    console.error('Error modifying retrofit scenario:', err)
  }
}

// Modify the fetchCo2Scenarios function to handle the new response format
const fetchCo2Scenarios = async () => {
  try {
    isLoadingCo2Scenarios.value = true
    co2ScenariosError.value = ''

    // Fetch both path and cost scenarios in parallel
    const [pathResponse, costResponse] = await Promise.all([
      fetch(`${apiBaseUrl.value}/api/construction-hvac/co2-scenarios/path`),
      fetch(`${apiBaseUrl.value}/api/construction-hvac/co2-scenarios/cost`)
    ])

    if (!pathResponse.ok || !costResponse.ok) {
      throw new Error('Failed to fetch CO2 scenarios')
    }

    const [pathData, costData] = await Promise.all([
      pathResponse.json(),
      costResponse.json()
    ])

    console.log('📥 CO2 Path Scenarios Response:', pathData)
    console.log('📥 CO2 Cost Scenarios Response:', costData)

    // Handle path scenarios
    if (pathData.co2_path_scenarios && Array.isArray(pathData.co2_path_scenarios)) {
      co2PathScenarios.value = pathData.co2_path_scenarios
      // Store descriptions if available
      if (pathData.descriptions) {
        console.log('📝 Path scenario descriptions:', pathData.descriptions)
      }
    } else {
      console.warn('Unexpected path scenarios response structure:', pathData)
      co2PathScenarios.value = []
    }

    // Handle cost scenarios
    if (costData.co2_cost_scenarios && Array.isArray(costData.co2_cost_scenarios)) {
      co2CostScenarios.value = costData.co2_cost_scenarios
      // Store descriptions if available
      if (costData.descriptions) {
        console.log('📝 Cost scenario descriptions:', costData.descriptions)
      }
    } else {
      console.warn('Unexpected cost scenarios response structure:', costData)
      co2CostScenarios.value = []
    }

    // Set defaults if not already set
    if (!selectedCo2PathScenario.value && co2PathScenarios.value.length > 0) {
      selectedCo2PathScenario.value = co2PathScenarios.value[0]
      tempSelectedCo2PathScenario.value = co2PathScenarios.value[0] // Initialize temp state
    }
    if (!selectedCo2CostScenario.value && co2CostScenarios.value.length > 0) {
      selectedCo2CostScenario.value = co2CostScenarios.value[0]
      tempSelectedCo2CostScenario.value = co2CostScenarios.value[0] // Initialize temp state
    }

    console.log('✅ Updated CO2 scenarios:', {
      pathScenarios: co2PathScenarios.value,
      costScenarios: co2CostScenarios.value,
      selectedPath: selectedCo2PathScenario.value,
      selectedCost: selectedCo2CostScenario.value
    })

  } catch (err) {
    console.error('Error fetching CO2 scenarios:', err)
    co2ScenariosError.value = `Fehler beim Laden der CO2-Szenarien: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
  } finally {
    isLoadingCo2Scenarios.value = false
  }
}

// Debug: Watch for changes in analysis results
watch(retrofitAnalysisResult, (newValue) => {
  console.log('🔄 RetrofitAnalysisResult changed:', {
    hasValue: !!newValue,
    hasData: !!newValue?.data,
    dataKeys: newValue?.data ? Object.keys(newValue.data) : null,
    hasLcaLccResults: !!newValue?.data?.lca_lcc_results,
    hasSummary: !!newValue?.data?.summary,
    lcaLccKeys: newValue?.data?.lca_lcc_results ? Object.keys(newValue.data.lca_lcc_results) : null,
    summaryKeys: newValue?.data?.summary ? Object.keys(newValue.data.summary) : null,
    fullStructure: newValue
  })
}, { deep: true })

// Debug: Watch for changes in card data
watch([energyCardData, emissionCardData, strandingCardData, costCardData], 
  ([energy, emission, stranding, cost]) => {
    console.log('📊 Card data updated:', {
      energyCardData: !!energy,
      emissionCardData: !!emission,
      strandingCardData: !!stranding,
      costCardData: !!cost,
      energyData: energy,
      emissionData: emission,
      strandingData: stranding,
      costData: cost
    })
  }, { deep: true })

// Computed properties for missing data
const hasMissingData = computed(() => {
  return missingData.value.length > 0
})

const missingDataCount = computed(() => {
  return missingData.value.length
})

const isDataComplete = computed(() => {
  return missingData.value.length === 0
})

// Handle opening settings sheet
const openSettingsSheet = () => {
  try {
    // Copy current values to temporary state
    tempSelectedCo2PathScenario.value = selectedCo2PathScenario.value
    tempSelectedCo2CostScenario.value = selectedCo2CostScenario.value
    isSettingsOpen.value = true
  } catch (err) {
    console.error('Error opening settings sheet:', err)
  }
}

// Handle saving settings
const saveSettings = () => {
  try {
    // Apply temporary values to actual state
    selectedCo2PathScenario.value = tempSelectedCo2PathScenario.value
    selectedCo2CostScenario.value = tempSelectedCo2CostScenario.value
    
    isSettingsOpen.value = false
    
    // Show success message
    toast.success('Einstellungen gespeichert', {
      description: 'Die CO2-Szenarien wurden erfolgreich aktualisiert.'
    })
    
    // Trigger re-analysis if building data is available
    if (buildingData.value && geometryData.value) {
      if (retrofitScenario.value) {
        // Re-run retrofit analysis with new CO2 scenarios
        analyzeRetrofitScenario(
          buildingData.value,
          geometryData.value,
          retrofitScenario.value,
          selectedCo2PathScenario.value,
          selectedCo2CostScenario.value,
          getHVACOptions.value
        ).catch(err => {
          console.error('❌ Re-analysis after settings change failed:', err)
        })
      } else {
        // Re-run base analysis with new CO2 scenarios
        analyzeBaseScenario(
          buildingData.value,
          geometryData.value,
          co2PathScenarios.value,
          co2CostScenarios.value,
          selectedCo2PathScenario.value,
          selectedCo2CostScenario.value
        ).catch(err => {
          console.error('❌ Re-analysis after settings change failed:', err)
        })
      }
    }
  } catch (err) {
    console.error('Error saving settings:', err)
    toast.error('Fehler beim Speichern', {
      description: 'Die Einstellungen konnten nicht gespeichert werden.'
    })
  }
}

// Handle canceling settings
const cancelSettings = () => {
  try {
    // Reset temporary values to current state
    tempSelectedCo2PathScenario.value = selectedCo2PathScenario.value
    tempSelectedCo2CostScenario.value = selectedCo2CostScenario.value
    isSettingsOpen.value = false
  } catch (err) {
    console.error('Error canceling settings:', err)
  }
}

// Handle resetting settings to defaults
const resetSettings = () => {
  try {
    // Reset to default values
    tempSelectedCo2PathScenario.value = co2PathScenarios.value.length > 0 ? co2PathScenarios.value[0] : 'KSG'
    tempSelectedCo2CostScenario.value = co2CostScenarios.value.length > 0 ? co2CostScenarios.value[0] : '0% reine Zeitpräferenzrate'
    
    toast.info('Einstellungen zurückgesetzt', {
      description: 'Die CO₂-Szenarien wurden auf die Standardwerte zurückgesetzt.'
    })
  } catch (err) {
    console.error('Error resetting settings:', err)
  }
}

// Helper functions for the new card fields
const getZustandsbewertungColor = (value: string) => {
  if (!value || value === 'keine Info vorhanden') return 'text-gray-500'
  
  switch (value) {
    case 'schlecht':
      return 'text-red-600'
    case 'eher schlecht':
      return 'text-red-400'
    case 'eher gut':
      return 'text-yellow-500'
    case 'gut':
      return 'text-green-400'
    case 'sehr gut':
      return 'text-green-600'
    default:
      return 'text-gray-500'
  }
}

const getZustandsbewertungArrow = (value: string) => {
  if (!value || value === 'keine Info vorhanden') return '→'
  
  switch (value) {
    case 'schlecht':
      return '↓'
    case 'eher schlecht':
      return '↘'
    case 'eher gut':
      return '↗'
    case 'gut':
      return '↑'
    case 'sehr gut':
      return '↑'
    default:
      return '→'
  }
}

const getVerbesserungspotenzialColor = (value: string) => {
  if (!value || value === 'keine Info vorhanden') return 'text-gray-500'
  
    switch (value) {
    case 'kaum Verbesserungspotenzial':
      return 'text-red-600'
    case 'geringes Verbesserungspotenzial':
      return 'text-red-400'
    case 'mittleres Verbesserungspotenzial':
      return 'text-yellow-500'
    case 'hohes Verbesserungspotenzial':
      return 'text-green-400'
    case 'sehr hohes Verbesserungspotenzial':
      return 'text-green-600'
    default:
      return 'text-gray-500'
  }

}

const getVerbesserungspotenzialArrow = (value: string) => {
  if (!value || value === 'keine Info vorhanden') return '→'
  
  switch (value) {
    case 'kaum Verbesserungspotenzial':
      return '↓'
    case 'geringes Verbesserungspotenzial':
      return '↘'
    case 'mittleres Verbesserungspotenzial':
      return '→'
    case 'hohes Verbesserungspotenzial':
      return '↗'
    case 'sehr hohes Verbesserungspotenzial':
      return '↑'
    default:
      return '→'
  }
}

const getBaufachlicheMoeglichkeitenColor = (value: string) => {
  if (!value || value === 'keine Info vorhanden') return 'text-gray-500'
  
  switch (value) {
    case 'gering':
      return 'text-red-600'
    case 'mittel':
      return 'text-yellow-500'
    case 'umfassend':
      return 'text-green-600'
    default:
      return 'text-gray-500'
  }
}

const getBaufachlicheMoeglichkeitenArrow = (value: string) => {
  if (!value || value === 'keine Info vorhanden') return '→'
  
  switch (value) {
    case 'gering':
      return '↓'
    case 'mittel':
      return '→'
    case 'umfassend':
      return '↑'
    default:
      return '→'
  }
}
</script>

<template>
  <div class="h-full bg-white">
    <!-- Main Content -->
    <main class="w-full px-4 sm:px-6 lg:px-8 py-8 h-full overflow-auto">
      <!-- Error Message -->
      <div v-if="searchError" class="mb-4">
        <div class="bg-red-50 border border-red-200 rounded-md p-3">
          <p class="text-sm text-red-600">{{ searchError }}</p>
        </div>
      </div>
      
      <!-- Geometry Error Message -->
      <div v-if="geometryError" class="mb-4">
        <div class="bg-orange-50 border border-orange-200 rounded-md p-3">
          <p class="text-sm text-orange-600">Geometry Error: {{ geometryError }}</p>
        </div>
      </div>
      
      <!-- Welcome State -->
      <div v-if="!showViewer && !isSearching && !searchError" class="text-center py-12">
        <div class="mx-auto max-w-md">
          <div class="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H7m10 0v-2a2 2 0 00-2-2H9a2 2 0 00-2 2v2m10-10V7a2 2 0 00-2-2H9a2 2 0 00-2 2v4m2 4h.01"/>
            </svg>
          </div>
          <h3 class="mt-2 text-sm font-medium text-gray-900">kein Gebäude ausgewählt</h3>
          <p class="mt-1 text-sm text-gray-500">
            Suchen Sie nach einem Gebäude anhand seiner Gebäudenummer, um die Informationen anzuzeigen.
          </p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isSearching" class="w-full">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Building Information Loading -->
          <div class="lg:col-span-1">
            <Card class="w-full h-[600px]">
              <CardHeader>
                <CardTitle class="flex items-center space-x-2">
                  <Skeleton class="h-6 w-48" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div class="space-y-4">
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-3/4" />
                  <Skeleton class="h-4 w-1/2" />
                  <Skeleton class="h-32 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
          
          <!-- Visualization Loading -->
          <div class="lg:col-span-1">
            <Card class="w-full h-[600px]">
              <CardHeader>
                <CardTitle class="flex items-center space-x-2">
                  <Skeleton class="h-6 w-48" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div class="space-y-4">
                  <Skeleton class="h-8 w-full" />
                  <Skeleton class="h-96 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <!-- 3D Viewer and Building Info -->
      <div v-if="buildingData && !isSearching" class="w-full">
        <!-- Missing Data Checklist -->
        <div class="mb-6">
          <Accordion type="single" collapsible class="w-full">
            <AccordionItem value="missing-data" class="border-l-4" :class="isDataComplete ? 'border-l-green-500' : 'border-l-orange-500'">
              <AccordionTrigger class="px-6 py-4 hover:no-underline">
                <div class="flex items-center justify-between w-full pr-4">
                  <div class="flex items-center space-x-2">
                    <CheckCircle v-if="isDataComplete" class="h-5 w-5 text-green-600" />
                    <AlertCircle v-else class="h-5 w-5 text-orange-600" />
                    <span class="text-base font-medium">
                      {{ isDataComplete ? 'Daten vollständig' : `Fehlende Daten (${missingDataCount})` }}
                    </span>
                  </div>
                  <Badge 
                    :variant="isDataComplete ? 'default' : 'secondary'"
                    class="text-xs"
                  >
                    {{ isDataComplete ? 'Vollständig' : 'Unvollständig' }}
                  </Badge>
                </div>
              </AccordionTrigger>
              
              <AccordionContent class="px-6 pb-4">
                <div class="space-y-3">
                  <p class="text-sm text-muted-foreground">
                    {{ isDataComplete 
                      ? 'Alle erforderlichen Gebäudedaten sind verfügbar und die Analyse kann durchgeführt werden.' 
                      : 'Einige Gebäudedaten fehlen noch. Die Analyse kann mit eingeschränkter Genauigkeit durchgeführt werden.' 
                    }}
                  </p>
                  
                  <!-- Loading state -->
                  <div v-if="isLoadingMissingData" class="space-y-2">
                    <Skeleton class="h-4 w-full" />
                    <Skeleton class="h-4 w-3/4" />
                  </div>
                  
                  <!-- Error state -->
                  <div v-else-if="missingDataError" class="bg-red-50 border border-red-200 rounded-md p-3">
                    <p class="text-sm text-red-600">{{ missingDataError }}</p>
                  </div>
                  
                  <!-- Complete data state -->
                  <div v-else-if="isDataComplete" class="flex items-center space-x-2 text-green-700">
                    <CheckCircle class="h-4 w-4" />
                    <span class="text-sm font-medium">Alle erforderlichen Daten sind vorhanden</span>
                  </div>
                  
                  <!-- Missing data checklist -->
                  <div v-else-if="hasMissingData" class="space-y-3">
                    <p class="text-sm text-muted-foreground mb-2">
                      Folgende Datenfelder fehlen noch für eine vollständige Analyse:
                    </p>
                    <div class="space-y-2">
                      <div 
                        v-for="field in missingData" 
                        :key="field"
                        class="flex items-center space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg"
                      >
                        <Checkbox 
                          :checked="false" 
                          :disabled="true"
                          class="border-orange-300"
                        />
                        <div class="flex-1">
                          <span class="text-sm font-medium text-orange-800">{{ translateFieldName(field) }}</span>
                          <p class="text-xs text-orange-600 mt-1">
                            Dieses Feld muss ergänzt werden, um eine vollständige Analyse zu ermöglichen.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div class="flex items-start space-x-2">
                        <AlertTriangle class="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div class="text-sm text-blue-800">
                          <p class="font-medium mb-1">Hinweis zur Analyse</p>
                          <p>
                            Die Analyse kann auch mit fehlenden Daten durchgeführt werden, 
                            verwendet jedoch Standardwerte für die fehlenden Felder. 
                            Dies kann die Genauigkeit der Ergebnisse beeinflussen.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        
        <!-- Analysis Tabs -->
        <div class="mb-6">
          <Tabs v-model="activeAnalysisTab" class="w-full">
            <TabsList class="grid w-full grid-cols-4 max-w-2xl">
              <TabsTrigger value="overview" class="flex items-center space-x-2">
                <ChartNoAxesGantt class="h-4 w-4" />
                <span>Überblick</span>
              </TabsTrigger>
              <TabsTrigger value="energy" class="flex items-center space-x-2">
                <Zap class="h-4 w-4" />
                <span>Energie</span>
              </TabsTrigger>
              <TabsTrigger value="lifecycle" class="flex items-center space-x-2">
                <CircleFadingPlus class="h-4 w-4" />
                <span>Lebenszyklusanalyse</span>
              </TabsTrigger>
              <TabsTrigger value="dekarbonisierung" class="flex items-center space-x-2">
                <TrendingDown class="h-4 w-4" />
                <span>Dekarbonisierung</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <!-- Action Buttons Row - Moved outside cards and under tabs -->
          <div class="flex justify-between items-center mt-4 mb-4">
            <div class="flex items-center space-x-3">
              <!-- Sanierungszenario Button - visible in all tabs -->
              <Sheet v-if="!retrofitScenario" :open="isSheetOpen" @update:open="isSheetOpen = $event">
                <SheetTrigger as-child>
                  <Button
                    size="sm" 
                    variant="outline"
                    @click="openRetrofitSheet"
                    class="flex items-center space-x-2"
                  >
                    <Plus class="h-4 w-4" />
                    <span>Sanierungsszenario hinzufügen</span>
                  </Button>
                </SheetTrigger>
                
                <SheetContent side="right" class="!w-[480px] sm:!w-[650px] !max-w-none flex flex-col">
                  <SheetHeader>
                    <SheetTitle>Sanierungsszenario hinzufügen</SheetTitle>
                    <SheetDescription>
                      Wählen Sie geeignete Maßnahmen zur Gebäudehülle und Wärmeversorgung im Rahmen der Gebäudesanierung aus.
                    </SheetDescription>
                  </SheetHeader>
                  
                  <!-- Scrollable Content Area -->
                  <div class="flex-1 overflow-y-auto py-4">
                    <div class="space-y-6 px-4">
                      <!-- Form Data Error -->
                      <div v-if="formDataError" class="bg-red-50 border border-red-200 rounded-md p-3">
                        <p class="text-sm text-red-600">{{ formDataError }}</p>
                      </div>
                      
                      <!-- Loading state -->
                      <div v-if="isLoadingFormData" class="space-y-4">
                        <Skeleton class="h-4 w-full" />
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-4 w-full" />
                        <Skeleton class="h-10 w-full" />
                      </div>
                      
                      <!-- Form content -->
                      <div v-else-if="formData" class="space-y-6">
                        <!-- Construction Section -->
                        <div class="space-y-4">
                          <div>
                            <h3 class="text-lg font-medium">
                              Gebäudehülle
                            </h3>
                            <p class="text-sm text-muted-foreground">Auswahl des Energiestandards für die Sanierung</p>
                          </div>
                          
                          <!-- Year Input for Construction -->
                          <div class="space-y-2">
                            <Label for="construction-year">Sanierungsjahr Gebäudehülle</Label>
                            <Input
                              id="construction-year"
                              v-model="constructionYear"
                              type="number"
                              placeholder="z.B. 2025"
                              :min="formData?.year_ranges?.construction_retrofit_year?.min || 2024"
                              :max="formData?.year_ranges?.construction_retrofit_year?.max || 2050"
                            />
                          </div>
                          
                          <!-- Energy Standards Error -->
                          <div v-if="energyStandardsError" class="bg-red-50 border border-red-200 rounded-md p-3">
                            <p class="text-sm text-red-600">{{ energyStandardsError }}</p>
                          </div>
                          
                          <!-- Energy Standards Selection -->
                          <div v-if="isLoadingEnergyStandards" class="space-y-2">
                            <Skeleton class="h-4 w-full" />
                            <Skeleton class="h-10 w-full" />
                          </div>
                          <div v-else-if="energyStandards" class="space-y-2">
                            <Label for="energy-standard-select">Energiestandard</Label>
                            <Select v-model="selectedEnergyStandard">
                              <SelectTrigger id="energy-standard-select">
                                <SelectValue placeholder="Wählen Sie einen Energiestandard..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  v-for="standard in energyStandards.standards"
                                  :key="standard"
                                  :value="standard"
                                >
                                  {{ standard }}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p v-if="energyStandards.description" class="text-xs text-muted-foreground">
                              {{ energyStandards.description }}
                            </p>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <!-- HVAC Section -->
                        <div class="space-y-4">
                          <div>
                            <h3 class="text-lg font-medium">
                              Wärmmeversorgung
                            </h3>
                            <p class="text-sm text-muted-foreground">Auswahl der Maßnahme zur Wärmeversorgung</p>
                          </div>
                          
                          <!-- Year Input for HVAC -->
                          <div class="space-y-2">
                            <Label for="hvac-year">Sanierungsjahr Wärmeversorgung</Label>
                            <Input
                              id="hvac-year"
                              v-model="hvacYear"
                              type="number"
                              placeholder="z.B. 2025"
                              :min="formData?.year_ranges?.hvac_retrofit_year?.min || 2024"
                              :max="formData?.year_ranges?.hvac_retrofit_year?.max || 2050"
                            />
                          </div>
                          
                          <!-- HVAC Type Selection -->
                          <div class="space-y-2">
                            <Label for="hvac-type-select">Auswahl des Systems</Label>
                            <Select v-model="selectedHVACType">
                              <SelectTrigger id="hvac-type-select">
                                <SelectValue placeholder="Wählen Sie die Wärmeversorgnung..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  v-for="hvacType in formData?.hvac_types || []"
                                  :key="hvacType"
                                  :value="hvacType"
                                >
                                  {{ hvacType }}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <!-- Specific HVAC Selection -->
                          <div v-if="selectedHVACType" class="space-y-2">
                            <Label for="hvac-item-select">{{ selectedHVACType }} Spezifikation</Label>
                            <Select v-model="selectedHVAC">
                              <SelectTrigger id="hvac-item-select">
                                <SelectValue placeholder="Wählen Sie ein spezifisches System..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  v-for="item in getHVACOptions"
                                  :key="item.hvac_number"
                                  :value="item.hvac_number"
                                >
                                  {{ item.hvac_name }}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <SheetFooter class="mt-4 border-t pt-4 px-4">
                    <div class="flex space-x-2 w-full">
                      <Button 
                        variant="outline" 
                        @click="isSheetOpen = false"
                        class="flex-1"
                      >
                        Abbrechen
                      </Button>
                      <div class="flex-1">
                        <Button 
                          @click="saveRetrofitScenario"
                          :disabled="!isScenarioValid"
                          class="w-full"
                        >
                          Szenario speichern
                        </Button>
                        <p v-if="!isScenarioValid && getValidationMessage" class="text-xs text-red-500 mt-1">
                          {{ getValidationMessage }}
                        </p>
                      </div>
                    </div>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
              
              <!-- Show scenario info if exists -->
              <div v-else class="flex items-center space-x-2">
                <HoverCard>
                  <HoverCardTrigger as-child>
                    <Button
                      size="sm"
                      variant="outline"
                      @click="modifyRetrofitScenario"
                      class="flex items-center space-x-2"
                    >
                      <Settings class="h-4 w-4" />
                      <span>Sanierungszenario bearbeiten</span>
                    </Button>
                  </HoverCardTrigger>
                  
                  <HoverCardContent side="bottom" class="max-w-sm">
                    <div class="space-y-2">
                      <div class="font-medium">Sanierungszenario</div>
                      <div class="space-y-1 text-xs">
                        <div v-if="retrofitScenario?.energy_standard && retrofitScenario?.construction_year">
                          <span class="font-medium">Energiestandard ({{ retrofitScenario?.construction_year }}):</span>
                          <div class="pl-2 text-muted-foreground">
                            {{ constructionSummary }}
                          </div>
                        </div>
                        <div v-if="retrofitScenario?.hvac && retrofitScenario?.hvac_year">
                          <span class="font-medium">Wärmeversorgung ({{ retrofitScenario?.hvac_year }}):</span> {{ retrofitScenario?.hvac?.hvac_name }}
                        </div>
                        <div v-if="!retrofitScenario?.energy_standard && !retrofitScenario?.hvac" class="text-muted-foreground">
                          Keine Maßnahmen ausgewählt
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
                
                <Button
                  size="sm"
                  variant="ghost"
                  @click="handleDeleteClick"
                  class="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  title="Szenario entfernen"
                >
                  <X class="h-4 w-4" />
                </Button>
                
                <!-- Modification Sheet -->
                <Sheet :open="isSheetOpen" @update:open="isSheetOpen = $event">
                  <SheetContent side="right" class="!w-[480px] sm:!w-[650px] !max-w-none flex flex-col">
                    <SheetHeader>
                      <SheetTitle>Sanierungszenario bearbeiten</SheetTitle>
                      <SheetDescription>
                        Bearbeiten Sie die Konstruktions- und Wärmeversorgungs-Maßnahmen für die Gebäudesanierung.
                      </SheetDescription>
                    </SheetHeader>
                    
                    <!-- Scrollable Content Area -->
                    <div class="flex-1 overflow-y-auto py-4">
                      <div class="space-y-6 px-4">
                        <!-- Form Data Error -->
                        <div v-if="formDataError" class="bg-red-50 border border-red-200 rounded-md p-3">
                          <p class="text-sm text-red-600">{{ formDataError }}</p>
                        </div>
                        
                        <!-- Loading state -->
                        <div v-if="isLoadingFormData" class="space-y-4">
                          <Skeleton class="h-4 w-full" />
                          <Skeleton class="h-10 w-full" />
                          <Skeleton class="h-4 w-full" />
                          <Skeleton class="h-10 w-full" />
                        </div>
                        
                        <!-- Form content -->
                        <div v-else-if="formData" class="space-y-6">
                          <!-- Construction Section -->
                          <div class="space-y-4">
                            <div>
                              <h3 class="text-lg font-medium">
                                Gebäudehülle
                              </h3>
                              <p class="text-sm text-muted-foreground">Auswahl des Energiestandards für die Sanierung</p>
                            </div>
                            
                            <!-- Year Input for Construction -->
                            <div class="space-y-2">
                              <Label for="construction-year-edit">Sanierungsjahr Gebäudehülle</Label>
                              <Input
                                id="construction-year-edit"
                                v-model="constructionYear"
                                type="number"
                                placeholder="z.B. 2025"
                                :min="formData?.year_ranges?.construction_retrofit_year?.min || 2024"
                                :max="formData?.year_ranges?.construction_retrofit_year?.max || 2050"
                              />
                            </div>
                            
                            <!-- Energy Standards Error -->
                            <div v-if="energyStandardsError" class="bg-red-50 border border-red-200 rounded-md p-3">
                              <p class="text-sm text-red-600">{{ energyStandardsError }}</p>
                            </div>
                            
                            <!-- Energy Standards Selection -->
                            <div v-if="isLoadingEnergyStandards" class="space-y-2">
                              <Skeleton class="h-4 w-full" />
                              <Skeleton class="h-10 w-full" />
                            </div>
                            <div v-else-if="energyStandards" class="space-y-2">
                              <Label for="energy-standard-select-edit">Energiestandard</Label>
                              <Select v-model="selectedEnergyStandard">
                                <SelectTrigger id="energy-standard-select-edit">
                                  <SelectValue placeholder="Wählen Sie einen Energiestandard..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    v-for="standard in energyStandards.standards"
                                    :key="standard"
                                    :value="standard"
                                  >
                                    {{ standard }}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <p v-if="energyStandards.description" class="text-xs text-muted-foreground">
                                {{ energyStandards.description }}
                              </p>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          <!-- HVAC Section -->
                          <div class="space-y-4">
                            <div>
                              <h3 class="text-lg font-medium">
                                Wärmmeversorgung
                              </h3>
                              <p class="text-sm text-muted-foreground">Auswahl der Maßnahme zur Wärmeversorgung</p>
                            </div>
                            
                            <!-- Year Input for HVAC -->
                            <div class="space-y-2">
                              <Label for="hvac-year-edit">Sanierungsjahr Wärmeversorgung</Label>
                              <Input
                                id="hvac-year-edit"
                                v-model="hvacYear"
                                type="number"
                                placeholder="z.B. 2025"
                                :min="formData?.year_ranges?.hvac_retrofit_year?.min || 2024"
                                :max="formData?.year_ranges?.hvac_retrofit_year?.max || 2050"
                              />
                            </div>
                            
                            <!-- HVAC Type Selection -->
                            <div class="space-y-2">
                              <Label for="hvac-type-select-edit">Auswahl des Systems</Label>
                              <Select v-model="selectedHVACType">
                                <SelectTrigger id="hvac-type-select-edit">
                                  <SelectValue placeholder="Wählen Sie Wärmeversorgungs-Typ..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    v-for="hvacType in formData?.hvac_types || []"
                                    :key="hvacType"
                                    :value="hvacType"
                                  >
                                    {{ hvacType }}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <!-- Specific HVAC Selection -->
                            <div v-if="selectedHVACType" class="space-y-2">
                              <Label for="hvac-item-select-edit">{{ selectedHVACType }} Spezifikation</Label>
                              <Select v-model="selectedHVAC">
                                <SelectTrigger id="hvac-item-select-edit">
                                  <SelectValue placeholder="Wählen Sie spezifisches System..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    v-for="item in getHVACOptions"
                                    :key="item.hvac_number"
                                    :value="item.hvac_number"
                                  >
                                    {{ item.hvac_name }}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <SheetFooter class="mt-4 border-t pt-4 px-4">
                      <div class="flex space-x-2 w-full">
                        <Button 
                          variant="outline" 
                          @click="isSheetOpen = false"
                          class="flex-1"
                        >
                          Abbrechen
                        </Button>
                        <Button 
                          @click="saveRetrofitScenario"
                          :disabled="!isScenarioValid"
                          class="flex-1"
                        >
                          Änderungen speichern
                        </Button>
                      </div>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
                
                <!-- Delete Dialog -->
                <AlertDialog :open="isDeleteDialogOpen" @update:open="isDeleteDialogOpen = $event">
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sanierungszenario löschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sind Sie sicher, dass Sie dieses Sanierungszenario löschen möchten? 
                        Diese Aktion kann nicht rückgängig gemacht werden.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        @click="removeRetrofitScenario"
                        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Löschen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            
            <!-- Right side buttons: Einstellungen next to other action buttons -->
            <div class="flex items-center space-x-3">
              <!-- Einstellungen Button (visible in all tabs) -->
              <Sheet :open="isSettingsOpen" @update:open="isSettingsOpen = $event">
                <SheetTrigger as-child>
                  <Button variant="outline" size="sm" class="flex items-center space-x-2" @click="openSettingsSheet">
                    <Settings class="h-4 w-4" />
                    <span>Einstellungen</span>
                  </Button>
                </SheetTrigger>
                
                <SheetContent side="right" class="w-[400px] flex flex-col">
                  <SheetHeader>
                    <SheetTitle>Einstellungen</SheetTitle>
                    <SheetDescription>
                      Konfigurieren Sie Szenarien für die Analyse.
                    </SheetDescription>
                  </SheetHeader>
                  
                  <!-- Scrollable Content Area -->
                  <div class="flex-1 overflow-y-auto py-4">
                    <div class="space-y-6">
                      <!-- Error Message -->
                      <div v-if="co2ScenariosError" class="bg-red-50 border border-red-200 rounded-md p-3">
                        <p class="text-sm text-red-600">{{ co2ScenariosError }}</p>
                      </div>
                      
                      <!-- Loading State -->
                      <div v-if="isLoadingCo2Scenarios" class="space-y-4">
                        <Skeleton class="h-4 w-full" />
                        <Skeleton class="h-10 w-full" />
                        <Skeleton class="h-4 w-full" />
                        <Skeleton class="h-10 w-full" />
                      </div>
                      
                      <!-- CO2 Path Scenario Selection -->
                      <div v-else class="space-y-2">
                        <Label for="co2-path-scenario">Reduktionspfad</Label>
                        <Select v-model="tempSelectedCo2PathScenario">
                          <SelectTrigger id="co2-path-scenario">
                            <SelectValue placeholder="Wählen Sie ein Reduktionsszenario..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="scenario in co2PathScenarios"
                              :key="scenario"
                              :value="scenario"
                            >
                              {{ scenario }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <!-- CO2 Cost Scenario Selection -->
                      <div class="space-y-2">
                        <Label for="co2-cost-scenario">CO₂-Bepreisung</Label>
                        <Select v-model="tempSelectedCo2CostScenario">
                          <SelectTrigger id="co2-cost-scenario">
                            <SelectValue placeholder="Wählen Sie ein Kostenszenario..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="scenario in co2CostScenarios"
                              :key="scenario"
                              :value="scenario"
                            >
                              {{ scenario }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <SheetFooter class="mt-4 border-t pt-4">
                    <div class="flex space-x-2 w-full">
                      <Button 
                        variant="outline" 
                        @click="resetSettings"
                        class="flex-1"
                      >
                        Zurücksetzen
                      </Button>
                      <Button 
                        variant="outline" 
                        @click="cancelSettings"
                        class="flex-1"
                      >
                        Abbrechen
                      </Button>
                      <Button 
                        @click="saveSettings"
                        class="flex-1"
                      >
                        Speichern
                      </Button>
                    </div>
                  </SheetFooter>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
        
        <!-- Tab Content -->
        <div class="mt-6">
          <!-- Overview Tab Content -->
          <div v-if="activeAnalysisTab === 'overview'">
            <!-- Header for Overview Tab -->
            <div class="mb-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-2xl font-bold tracking-tight">{{ buildingData?.buildings_assumptions?.gebbez || 'Gebäude' }}</h2>
                  <p class="text-muted-foreground">
                    {{ [buildingData?.buildings_assumptions?.gebstr, buildingData?.buildings_assumptions?.gebplz, buildingData?.buildings_assumptions?.gebort].filter(Boolean).join(', ') || 'Adressinformationen nicht verfügbar' }}
                  </p>
                </div>
              </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Building Information -->
          <div class="lg:col-span-1">
            <Card class="w-full h-[520px]">
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>Gebäudeinformationen</CardTitle>
                </div>
              </CardHeader>
              <CardContent class="h-full overflow-y-auto">
                <!-- Loading state for building info -->
                <div v-if="!buildingData" class="space-y-4">
                  <Skeleton class="h-4 w-full" />
                  <Skeleton class="h-4 w-3/4" />
                  <Skeleton class="h-4 w-1/2" />
                  <Skeleton class="h-32 w-full" />
                </div>
                
                <!-- Building information content -->
                <div v-else>

                  
                  <Accordion type="single" collapsible class="w-full" default-value="building-assumptions">
                    <!-- Gebäudeannahmen -->
                    <AccordionItem value="building-assumptions">
                      <AccordionTrigger>Gebäudeannahmen</AccordionTrigger>
                      <AccordionContent>
                        <div v-if="buildingData?.buildings_assumptions" class="space-y-3">
                          <div class="grid grid-cols-1 gap-2 text-sm">
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Bauwerkszuordnung:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.bwzbez) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Bautypologie (EnOB:DataNWG):</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.enob_category) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Baualtersklasse/Energiestandard (Originalzustand):</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.bac) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Baualtersklasse/Energiestandard (Status Quo):</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.sq_standard) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Denkmalschutz:</span>
                              <span class="text-gray-900 text-right">{{ formatDisplayValue(buildingData.buildings_assumptions.is_heritage) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Wärmeversorgung:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.current_system_type) }}</span>
                            </div>
                          </div>
                        </div>
                        <div v-else class="text-sm text-gray-500">
                          Keine Gebäudedaten verfügbar
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <!-- Gebäudedaten (FDH+EMIS) -->
                    <AccordionItem value="building-data">
                      <AccordionTrigger>Gebäudedaten (FDH+EMIS)</AccordionTrigger>
                      <AccordionContent>
                        <div v-if="buildingData?.buildings_assumptions" class="space-y-3">
                          <div class="grid grid-cols-1 gap-2 text-sm">
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Einzelplan:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.epl) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Bauamt Bezeichnung:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.babez) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Liegenschaft Bezeichnung:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.ligbez) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Zuständige Abteilung:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.gebzabt) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Denkmalschutz:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.denkm) }}</span>
                            </div>
                            
                            <div class="border-t pt-2 mt-2">
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Baujahr:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.construction_year) }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">BGF m²:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.bgf) }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">NGF m²:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.ngf) }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Dachgeschosse:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.dganz) }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Untergeschosse:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.uganz) }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Geschosse:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.geanz) }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Summe Geschosse:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.geges) }}</span>
                              </div>
                            </div>
                            
                            <div class="border-t pt-2 mt-2">
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Wärmeversorgung aus FDH:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.versorgung_fdh) }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Wärmeversorgung aus EMIS:</span>
                                <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.current_system_type) }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div v-else class="text-sm text-gray-500">
                          Keine Gebäudedaten verfügbar
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <!-- Building Surface Areas -->
                    <AccordionItem value="surface-areas">
                      <AccordionTrigger>Gebäudeflächen</AccordionTrigger>
                      <AccordionContent>
                        <div v-if="buildingSurfaceAreas" class="space-y-3">
                          <div class="grid grid-cols-1 gap-2 text-sm">
                            <div v-for="surface in buildingSurfaceAreas" :key="surface.label" class="flex justify-between">
                              <span class="font-medium text-gray-600">{{ surface.label }}:</span>
                              <span class="text-gray-900">{{ surface.value }} {{ surface.unit }}</span>
                            </div>
                          </div>
                        </div>
                        <div v-else-if="geometryLoading" class="space-y-2">
                          <Skeleton class="h-4 w-full" />
                          <Skeleton class="h-4 w-3/4" />
                          <Skeleton class="h-4 w-1/2" />
                        </div>
                        <div v-else class="text-sm text-gray-500">
                          Keine Flächendaten verfügbar
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- 3D Scene Viewer -->
          <div class="lg:col-span-1">
            <Card class="w-full h-[520px] flex flex-col">
              <CardHeader class="flex-shrink-0">
                <CardTitle>Gebäudevisualisierung</CardTitle>
                <CardDescription v-if="geometryLoading" class="text-sm text-muted-foreground">
                  Geometriedaten werden geladen...
                </CardDescription>
              </CardHeader>
              <CardContent class="p-0 flex-1 overflow-hidden">
                <!-- Loading state for geometry visualization -->
                <div v-if="geometryLoading" class="h-full flex items-center justify-center">
                  <div class="space-y-4 w-full max-w-sm mx-auto p-4">
                    <Skeleton class="h-6 w-3/4 mx-auto" />
                    <Skeleton class="h-32 w-full" />
                    <div class="space-y-2">
                      <Skeleton class="h-3 w-full" />
                      <Skeleton class="h-3 w-5/6" />
                      <Skeleton class="h-3 w-4/6" />
                    </div>
                  </div>
                </div>
                
                <!-- 3D Viewer content -->
                <div v-else class="h-full w-full">
                  <div v-if="currentGmlIds.length > 0" class="h-full w-full">
                    <ArcGISSceneViewer 
                      :gml-ids="currentGmlIds"
                      :api-base-url="apiBaseUrl"
                      :geometry-data="geometryData"
                      :geometry-loading="geometryLoading"
                      class="w-full h-full block"
                    />
                  </div>
                  <div v-else class="h-full flex items-center justify-center">
                    <div class="text-center text-muted-foreground">
                      <p>Keine GML-IDs verfügbar für die Visualisierung</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
            <!-- Building Assessment Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Baufachliche Möglichkeiten Card -->
              <Card class="min-h-32">
                <CardHeader class="pb-2">
                  <div class="flex items-center justify-between">
                    <CardTitle class="text-sm font-bold text-foreground">Baufachliche Möglichkeiten für energetische Verbesserungen Hülle</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="space-y-2">
                    <div class="flex items-center space-x-2">
                      <div class="text-lg font-bold" :class="getBaufachlicheMoeglichkeitenColor(buildingData?.buildings_assumptions?.envbbaf)">
                        {{ formatDisplayValue(buildingData?.buildings_assumptions?.envbbaf) }}
                      </div>
                      <span class="text-lg" :class="getBaufachlicheMoeglichkeitenColor(buildingData?.buildings_assumptions?.envbbaf)">
                        {{ getBaufachlicheMoeglichkeitenArrow(buildingData?.buildings_assumptions?.envbbaf) }}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <!-- Durchgeführte energetische Verbesserungen Card -->
              <Card class="min-h-32">
                <CardHeader class="pb-2">
                  <div class="flex items-center justify-between">
                    <CardTitle class="text-sm font-bold text-foreground">Durchgeführte energetische Verbesserungen Hülle</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="space-y-2">
                    <div class="text-lg font-bold text-gray-900">
                      {{ formatDisplayValue(buildingData?.buildings_assumptions?.envbgh) }}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <!-- Verbesserungspotenzial Card -->
              <Card class="min-h-32">
                <CardHeader class="pb-2">
                  <div class="flex items-center justify-between">
                    <CardTitle class="text-sm font-bold text-foreground">Verbesserungspotenzial</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="space-y-2">
                    <div class="flex items-center space-x-2">
                      <div class="text-lg font-bold" :class="getVerbesserungspotenzialColor(buildingData?.buildings_assumptions?.envbpot)">
                        {{ formatDisplayValue(buildingData?.buildings_assumptions?.envbpot) }}
                      </div>
                      <span class="text-lg" :class="getVerbesserungspotenzialColor(buildingData?.buildings_assumptions?.envbpot)">
                        {{ getVerbesserungspotenzialArrow(buildingData?.buildings_assumptions?.envbpot) }}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <!-- Zustandsbewertung Card -->
              <Card class="min-h-32">
                <CardHeader class="pb-2">
                  <div class="flex items-center justify-between">
                    <CardTitle class="text-sm font-bold text-foreground">Zustandsbewertung</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="space-y-2">
                    <div class="flex items-center space-x-2">
                      <div class="text-lg font-bold" :class="getZustandsbewertungColor(buildingData?.buildings_assumptions?.envbzb)">
                        {{ formatDisplayValue(buildingData?.buildings_assumptions?.envbzb) }}
                      </div>
                      <span class="text-lg" :class="getZustandsbewertungColor(buildingData?.buildings_assumptions?.envbzb)">
                        {{ getZustandsbewertungArrow(buildingData?.buildings_assumptions?.envbzb) }}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <!-- Energy Tab Content -->
          <div v-else-if="activeAnalysisTab === 'energy'">
            <EnergyAnalysis 
              :emission-results="retrofitAnalysisResult?.data?.emission_results || null"
              :gml-ids="currentGmlIds"
              :geometry-data="geometryData"
              :geometry-loading="geometryLoading"
              :api-base-url="apiBaseUrl"
              :is-loading="isAnalyzingRetrofit"
              :retrofit-scenario="retrofitScenario"
            />
          </div>
          
          <!-- Lifecycle Analysis Tab Content -->
          <div v-else-if="activeAnalysisTab === 'lifecycle'">
            <LifecycleAnalysis 
              :lca-lcc-results="retrofitAnalysisResult?.data?.lca_lcc_results || null"
              :summary-data="retrofitAnalysisResult?.data?.summary || null"
              :building-data="buildingData"
              :geometry-data="geometryData"
              :co2-path-scenarios="co2PathScenarios"
              :co2-cost-scenarios="co2CostScenarios"
              :selected-co2-path-scenario="selectedCo2PathScenario"
              :selected-co2-cost-scenario="selectedCo2CostScenario"
              :is-loading="isAnalyzingRetrofit"
              :retrofit-scenario="retrofitScenario"
              :is-sheet-open="isSheetOpen"
              :form-data="formData"
              :form-data-error="formDataError"
              :is-loading-form-data="isLoadingFormData"
              :energy-standards="energyStandards"
              :energy-standards-error="energyStandardsError"
              :is-loading-energy-standards="isLoadingEnergyStandards"
              :selected-energy-standard="selectedEnergyStandard"
              :construction-year="constructionYear"
              :selected-hvac-type="selectedHVACType"
              :selected-hvac="selectedHVAC"
              :hvac-year="hvacYear"
              :get-hvac-options="getHVACOptions"
              :is-scenario-valid="isScenarioValid"
              :get-validation-message="getValidationMessage"
              :construction-summary="constructionSummary"
              :is-delete-dialog-open="isDeleteDialogOpen"
              :analyze-with-constructions-function="analyzeWithConstructions"
              @update:is-sheet-open="isSheetOpen = $event"
              @update:selected-energy-standard="selectedEnergyStandard = $event"
              @update:construction-year="constructionYear = $event"
              @update:selected-hvac-type="selectedHVACType = $event"
              @update:selected-hvac="selectedHVAC = $event"
              @update:hvac-year="hvacYear = $event"
              @update:is-delete-dialog-open="isDeleteDialogOpen = $event"
              @open-retrofit-sheet="openRetrofitSheet"
              @save-retrofit-scenario="saveRetrofitScenario"
              @modify-retrofit-scenario="modifyRetrofitScenario"
              @handle-delete-click="handleDeleteClick"
              @remove-retrofit-scenario="removeRetrofitScenario"
            />
          </div>
          
          <!-- Dekarbonisierung Tab Content -->
          <div v-else-if="activeAnalysisTab === 'dekarbonisierung'">
            <Dekarbonisierung 
              :emission-data="retrofitAnalysisResult?.data?.emission_results || null"
              :geometry-data="geometryData"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>
