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
import ArcGISSceneViewer from '@/components/map/ArcGISSceneViewer.vue'
import LifecycleAnalysis from '@/components/analysis/LifecycleAnalysis.vue'
import { Plus, Settings, X, Zap, Factory, AlertTriangle, Euro } from 'lucide-vue-next'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
const activeAnalysisTab = ref('energy') // 'energy' or 'lifecycle'

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
  analyzeRetrofitScenario 
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
const parseConstructionYear = (epl: string | number | null | undefined): number => {
  if (!epl) return 1950 // Default fallback year
  
  const year = typeof epl === 'string' ? parseInt(epl) : epl
  
  // Validate year range (buildings should be between 1800 and current year)
  if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
    console.warn(`Invalid construction year: ${epl}, using default 1950`)
    return 1950
  }
  
  return year
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
    const actualBuildingCategory = getBuildingCategory(assumptions)
    const actualConstructionYear = parseConstructionYear(assumptions?.epl)
    
    // Add required parameters with actual building data
    params.append('building_category', actualBuildingCategory)
    params.append('construction_year', actualConstructionYear.toString())
    params.append('radius', '50')
    params.append('calculate_window_areas', 'true')
    
    const url = `${apiBaseUrl.value}/api/geometry/get_geometry?${params.toString()}`
    console.log('🔗 API URL:', url)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
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
      return 'Bitte wählen Sie mindestens einen Energiestandard oder eine TGA-Maßnahme'
    }
    if (isEnergyStandardSelected.value && !constructionYear.value) {
      return 'Bitte geben Sie das Sanierungsjahr für die Konstruktion ein'
    }
    if (isHVACSelected.value && !hvacYear.value) {
      return 'Bitte geben Sie das Sanierungsjahr für die TGA ein'
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
      'total_built_area': 'Bebaute Fläche'
    }
    
    // Convert to array with German labels and formatted values
    const result = Object.entries(areas).map(([key, value]) => ({
      label: surfaceLabels[key] || key,
      value: typeof value === 'number' ? value.toFixed(2) : 'N/A',
      unit: 'm²'
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
    
    // TODO: Send to backend for calculation and storing
    console.log('Saved retrofit scenario:', retrofitScenario.value)
    
    // Show success message
    try {
      toast.success('Sanierungszenario gespeichert', {
        description: 'Das Sanierungszenario wurde erfolgreich erstellt.'
      })
    } catch (toastErr) {
      console.error('Error showing success toast:', toastErr)
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
        description: 'Das Sanierungszenario wurde erfolgreich entfernt.',
        action: {
          label: 'Rückgängig',
          onClick: () => undoDeleteScenario()
        },
        duration: 5000
      })
    } catch (toastErr) {
      console.error('Error showing delete toast:', toastErr)
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
    }
    if (!selectedCo2CostScenario.value && co2CostScenarios.value.length > 0) {
      selectedCo2CostScenario.value = co2CostScenarios.value[0]
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
    hasFrontendData: !!newValue?.frontend_data,
    frontendDataKeys: newValue?.frontend_data ? Object.keys(newValue.frontend_data) : null,
    hasCards: !!newValue?.frontend_data?.cards,
    cardsKeys: newValue?.frontend_data?.cards ? Object.keys(newValue.frontend_data.cards) : null,
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
</script>

<template>
  <div class="h-full bg-white">
    <!-- Main Content -->
    <main class="w-full px-4 sm:px-6 lg:px-8 py-8 h-full overflow-auto">
      <!-- Add Settings Button -->
      <div class="flex justify-end mb-4">
        <Sheet :open="isSettingsOpen" @update:open="isSettingsOpen = $event">
          <SheetTrigger as-child>
            <Button variant="outline" size="sm" class="flex items-center space-x-2">
              <Settings class="h-4 w-4" />
              <span>CO2-Szenarien</span>
            </Button>
          </SheetTrigger>
          
          <SheetContent side="right" class="w-[400px]">
            <SheetHeader>
              <SheetTitle>CO2-Szenarien Einstellungen</SheetTitle>
              <SheetDescription>
                Konfigurieren Sie die CO2-Reduktions- und Kostenszenarien für die Analyse.
              </SheetDescription>
            </SheetHeader>
            
            <div class="space-y-6 py-4">
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
                <Label for="co2-path-scenario">CO2-Reduktionsszenario</Label>
                <Select v-model="selectedCo2PathScenario">
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
                <Label for="co2-cost-scenario">CO2-Kostenszenario</Label>
                <Select v-model="selectedCo2CostScenario">
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
            
            <SheetFooter>
              <Button @click="isSettingsOpen = false">
                Schließen
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
      
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
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Building Information -->
          <div class="lg:col-span-1">
            <Card class="w-full h-[520px]">
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>Gebäudeinformationen</CardTitle>
                  
                  <!-- Retrofit Scenario Button or Hover Card -->
                  <div class="flex items-center space-x-2">
                    <!-- Show button if no scenario exists -->
                    <Sheet v-if="!retrofitScenario" :open="isSheetOpen" @update:open="isSheetOpen = $event">
                      <SheetTrigger as-child>
                        <Button
                          size="sm" 
                          variant="outline"
                          @click="openRetrofitSheet"
                          class="flex items-center space-x-1"
                        >
                          <Plus class="h-4 w-4" />
                          <span class="hidden sm:inline">Sanierungszenario hinzufügen</span>
                          <span class="sm:hidden">Szenario</span>
                        </Button>
                      </SheetTrigger>
                      
                      <SheetContent side="right" class="!w-[480px] sm:!w-[650px] !max-w-none flex flex-col">
                        <SheetHeader>
                          <SheetTitle>Sanierungszenario hinzufügen</SheetTitle>
                          <SheetDescription>
                            Wählen Sie Konstruktions- und TGA-Maßnahmen für die Gebäudesanierung aus.
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
                                    Energiestandard
                                  </h3>
                                  <p class="text-sm text-muted-foreground">Auswahl des Energiestandards für die Sanierung</p>
                                </div>
                                
                                <!-- Year Input for Construction -->
                                <div class="space-y-2">
                                  <Label for="construction-year">Sanierungsjahr Konstruktion</Label>
                                  <Input
                                    id="construction-year"
                                    v-model="constructionYear"
                                    type="number"
                                    placeholder="z.B. 2025"
                                    :min="formData.year_ranges?.construction_retrofit_year?.min || 2024"
                                    :max="formData.year_ranges?.construction_retrofit_year?.max || 2050"
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
                                    TGA (Technische Gebäudeausrüstung)
                                  </h3>
                                  <p class="text-sm text-muted-foreground">Auswahl der TGA-Maßnahmen</p>
                                </div>
                                
                                <!-- Year Input for HVAC -->
                                <div class="space-y-2">
                                  <Label for="hvac-year">Sanierungsjahr TGA</Label>
                                  <Input
                                    id="hvac-year"
                                    v-model="hvacYear"
                                    type="number"
                                    placeholder="z.B. 2025"
                                    :min="formData.year_ranges?.hvac_retrofit_year?.min || 2024"
                                    :max="formData.year_ranges?.hvac_retrofit_year?.max || 2050"
                                  />
                                </div>
                                
                                <!-- HVAC Type Selection -->
                                <div class="space-y-2">
                                  <Label for="hvac-type-select">TGA-Typ</Label>
                                  <Select v-model="selectedHVACType">
                                    <SelectTrigger id="hvac-type-select">
                                      <SelectValue placeholder="Wählen Sie TGA-Typ..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem
                                        v-for="hvacType in formData.hvac_types"
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
                                  <Label for="hvac-item-select">{{ selectedHVACType }} Auswahl</Label>
                                  <Select v-model="selectedHVAC">
                                    <SelectTrigger id="hvac-item-select">
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
                    
                    <!-- Show hover card if scenario exists -->
                    <div v-else>
                      <!-- Modification Sheet -->
                      <Sheet :open="isSheetOpen" @update:open="isSheetOpen = $event">
                        <SheetContent side="right" class="!w-[480px] sm:!w-[650px] !max-w-none flex flex-col">
                          <SheetHeader>
                            <SheetTitle>Sanierungszenario bearbeiten</SheetTitle>
                            <SheetDescription>
                              Bearbeiten Sie die Konstruktions- und TGA-Maßnahmen für die Gebäudesanierung.
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
                                      Energiestandard
                                    </h3>
                                    <p class="text-sm text-muted-foreground">Auswahl des Energiestandards für die Sanierung</p>
                                  </div>
                                  
                                  <!-- Year Input for Construction -->
                                  <div class="space-y-2">
                                    <Label for="construction-year-modify">Sanierungsjahr Konstruktion</Label>
                                    <Input
                                      id="construction-year-modify"
                                      v-model="constructionYear"
                                      type="number"
                                      placeholder="z.B. 2025"
                                      :min="formData.year_ranges?.construction_retrofit_year?.min || 2024"
                                      :max="formData.year_ranges?.construction_retrofit_year?.max || 2050"
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
                                    <Label for="energy-standard-select-modify">Energiestandard</Label>
                                    <Select v-model="selectedEnergyStandard">
                                      <SelectTrigger id="energy-standard-select-modify">
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
                                      TGA (Technische Gebäudeausrüstung)
                                    </h3>
                                    <p class="text-sm text-muted-foreground">Auswahl der TGA-Maßnahmen</p>
                                  </div>
                                  
                                  <!-- Year Input for HVAC -->
                                  <div class="space-y-2">
                                    <Label for="hvac-year-modify">Sanierungsjahr TGA</Label>
                                    <Input
                                      id="hvac-year-modify"
                                      v-model="hvacYear"
                                      type="number"
                                      placeholder="z.B. 2025"
                                      :min="formData.year_ranges?.hvac_retrofit_year?.min || 2024"
                                      :max="formData.year_ranges?.hvac_retrofit_year?.max || 2050"
                                    />
                                  </div>
                                  
                                  <!-- HVAC Type Selection -->
                                  <div class="space-y-2">
                                    <Label for="hvac-type-select-modify">TGA-Typ</Label>
                                    <Select v-model="selectedHVACType">
                                      <SelectTrigger id="hvac-type-select-modify">
                                        <SelectValue placeholder="Wählen Sie TGA-Typ..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem
                                          v-for="hvacType in formData.hvac_types"
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
                                    <Label for="hvac-item-select-modify">{{ selectedHVACType }} Auswahl</Label>
                                    <Select v-model="selectedHVAC">
                                      <SelectTrigger id="hvac-item-select-modify">
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
                    
                      <!-- Hover Card Display -->
                      <HoverCard>
                        <div class="flex items-center space-x-2">
                          <HoverCardTrigger as-child>
                            <div class="bg-primary/10 border border-primary/20 rounded-lg p-3 cursor-help">
                              <div class="flex items-center space-x-2">
                                <Badge variant="default" class="text-xs">
                                  Szenario aktiv
                                </Badge>
                              </div>
                            </div>
                          </HoverCardTrigger>
                          
                          <!-- Action buttons outside hover trigger -->
                          <Button
                            size="sm"
                            variant="ghost"
                            @click="modifyRetrofitScenario"
                            class="h-8 w-8 p-0"
                            title="Szenario bearbeiten"
                          >
                            <Settings class="h-4 w-4" />
                          </Button>
                          
                          <!-- Delete button with confirmation dialog -->
                          <AlertDialog :open="isDeleteDialogOpen" @update:open="isDeleteDialogOpen = $event">
                            <AlertDialogTrigger as-child>
                              <Button
                                size="sm"
                                variant="ghost"
                                @click="handleDeleteClick"
                                class="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                title="Szenario entfernen"
                              >
                                <X class="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            
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
                        
                        <HoverCardContent side="left" class="max-w-sm">
                          <div class="space-y-2">
                            <div class="font-medium">Sanierungszenario</div>
                            <div class="space-y-1 text-xs">
                              <div v-if="retrofitScenario.energy_standard && retrofitScenario.construction_year">
                                <span class="font-medium">Energiestandard ({{ retrofitScenario.construction_year }}):</span>
                                <div class="pl-2 text-muted-foreground">
                                  {{ constructionSummary }}
                                </div>
                              </div>
                              <div v-if="retrofitScenario.hvac && retrofitScenario.hvac_year">
                                <span class="font-medium">TGA ({{ retrofitScenario.hvac_year }}):</span> {{ retrofitScenario.hvac.hvac_name }}
                              </div>
                              <div v-if="!retrofitScenario.energy_standard && !retrofitScenario.hvac" class="text-muted-foreground">
                                Keine Maßnahmen ausgewählt
                              </div>
                            </div>
                            
                            <!-- Add Analysis Button -->
                            <div class="pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                @click="() => analyzeRetrofitScenario(
                                  buildingData,
                                  geometryData,
                                  retrofitScenario,
                                  selectedCo2PathScenario,
                                  selectedCo2CostScenario,
                                  getHVACOptions
                                )"
                                :disabled="isAnalyzingRetrofit"
                                class="w-full"
                              >
                                <template v-if="isAnalyzingRetrofit">
                                  <span class="animate-spin mr-2">⟳</span>
                                  Analysiere...
                                </template>
                                <template v-else>
                                  <Zap class="h-4 w-4 mr-2" />
                                  {{ retrofitScenario ? 'Sanierung analysieren' : 'Status Quo analysieren' }}
                                </template>
                              </Button>
                              
                              <!-- Show error if any -->
                              <p v-if="retrofitAnalysisError" class="text-xs text-red-500 mt-1">
                                {{ retrofitAnalysisError }}
                              </p>
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </div>
                  </div>
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

                  
                  <Accordion type="single" collapsible class="w-full" default-value="building-info">
                    <!-- Building Assumptions -->
                    <AccordionItem value="building-info">
                      <AccordionTrigger>Gebäudeannahmen</AccordionTrigger>
                      <AccordionContent>
                        <div v-if="buildingData?.buildings_assumptions" class="space-y-3">
                          <div class="grid grid-cols-1 gap-2 text-sm">
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Bauwerkszuordnung:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.bwz_category) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Bautypologie (EnOB:DataNWG):</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.enob_category) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Baualtersklasse (Originalzustand):</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.bac) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Baualtersklasse (Status Quo):</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.sq_standard) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Denkmalschutz:</span>
                              <span class="text-gray-900 text-right">{{ formatDisplayValue(buildingData.buildings_assumptions.is_heritage) }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">Versorgung:</span>
                              <span class="text-gray-900">{{ formatDisplayValue(buildingData.buildings_assumptions.versorgung_emis_mp) }}</span>
                            </div>
                          </div>
                        </div>
                        <div v-else class="text-sm text-gray-500">
                          Keine Gebäudedaten verfügbar
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <!-- GML Mapping Info -->
                    <AccordionItem value="gml-mapping">
                      <AccordionTrigger>GML Zuordnung</AccordionTrigger>
                      <AccordionContent>
                        <div v-if="buildingData?.gmlid_gebid_mapping" class="space-y-3">
                          <div v-for="(mapping, index) in buildingData.gmlid_gebid_mapping" :key="index" 
                               class="border rounded-lg p-3 bg-gray-50">
                            <div class="text-sm space-y-1">
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">GML ID:</span>
                                <span class="text-gray-900 font-mono text-xs">{{ mapping.gmlid }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Geprüft:</span>
                                <span class="text-gray-900">{{ mapping.geprueft || 'N/A' }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">Kontrollbedarf:</span>
                                <span class="text-gray-900">{{ mapping.kontrollbedarf || 'N/A' }}</span>
                              </div>
                              <div class="flex justify-between">
                                <span class="font-medium text-gray-600">CityGML konsistent:</span>
                                <span class="text-gray-900">{{ mapping.konsistent_citygml_fdh || 'N/A' }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div v-else class="text-sm text-gray-500">
                          Keine GML Zuordnungsdaten verfügbar
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
        
        <!-- Analysis Tabs -->
        <div class="mt-6">
          <Tabs v-model="activeAnalysisTab" class="w-full">
            <TabsList class="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="energy" class="flex items-center space-x-2">
                <Zap class="h-4 w-4" />
                <span>Energieanalyse</span>
              </TabsTrigger>
              <TabsTrigger value="lifecycle" class="flex items-center space-x-2">
                <Factory class="h-4 w-4" />
                <span>Lebenszyklusanalyse</span>
              </TabsTrigger>
            </TabsList>
            
            <!-- Energy Analysis Tab Content -->
            <TabsContent value="energy" class="mt-6">
              <!-- Energy Metrics Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Energiebedarf Card -->
          <Card class="min-h-32">
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-medium text-foreground">Energiebedarf</CardTitle>
                <HoverCard>
                  <HoverCardTrigger>
                    <Zap class="h-4 w-4 text-muted-foreground cursor-help" />
                  </HoverCardTrigger>
                  <HoverCardContent side="top" class="w-80">
                    <div class="space-y-2">
                      <h4 class="font-medium">Energiebedarf Optionen</h4>
                      
                      <!-- Energy Type Selection -->
                      <div class="space-y-2">
                        <Label class="text-xs">Energietyp</Label>
                        <Select v-model="selectedEnergyType" v-if="energyCardData?.options">
                          <SelectTrigger class="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="type in energyCardData.options.energy_types"
                              :key="type.key"
                              :value="type.key"
                            >
                              {{ type.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <!-- Unit Selection -->
                      <div class="space-y-2">
                        <Label class="text-xs">Einheit</Label>
                        <Select v-model="selectedEnergyUnit" v-if="energyCardData?.options">
                          <SelectTrigger class="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="unit in energyCardData.options.units"
                              :key="unit.key"
                              :value="unit.key"
                            >
                              {{ unit.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="energyCardData" class="space-y-2">
                <!-- Baseline Value -->
                <div class="text-2xl font-bold">
                  {{ formatNumber(energyCardData.baseline.value) }}
                </div>
                <p class="text-xs text-muted-foreground">{{ energyCardData.baseline.unit }}</p>
                
                <!-- Scenario Improvements -->
                <div v-if="energyCardData.scenarios.length > 0" class="space-y-1">
                  <div v-for="scenario in energyCardData.scenarios" :key="scenario.name" 
                       class="flex justify-between text-xs">
                    <span class="truncate">{{ scenario.name }}:</span>
                    <span :class="getImprovementColorClass(scenario.improvement)">
                      {{ scenario.improvement > 0 ? '+' : '' }}{{ formatNumber(scenario.improvement, 1) }}%
                    </span>
                  </div>
                </div>
              </div>
              <div v-else class="text-2xl font-bold">
                <Skeleton class="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
          
          <!-- Emissionen Card -->
          <Card class="min-h-32">
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-medium text-foreground">CO₂-Emissionen</CardTitle>
                <HoverCard>
                  <HoverCardTrigger>
                    <Factory class="h-4 w-4 text-muted-foreground cursor-help" />
                  </HoverCardTrigger>
                  <HoverCardContent side="top" class="w-80">
                    <div class="space-y-2">
                      <h4 class="font-medium">Emissions Optionen</h4>
                      
                      <!-- Emission Type Selection -->
                      <div class="space-y-2">
                        <Label class="text-xs">Emissionstyp</Label>
                        <Select v-model="selectedEmissionType" v-if="emissionCardData?.options">
                          <SelectTrigger class="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="type in emissionCardData.options.emission_types"
                              :key="type.key"
                              :value="type.key"
                            >
                              {{ type.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <!-- Unit Selection -->
                      <div class="space-y-2">
                        <Label class="text-xs">Einheit</Label>
                        <Select v-model="selectedEmissionUnit" v-if="emissionCardData?.options">
                          <SelectTrigger class="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="unit in emissionCardData.options.units"
                              :key="unit.key"
                              :value="unit.key"
                            >
                              {{ unit.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="emissionCardData" class="space-y-2">
                <!-- Baseline Value -->
                <div class="text-2xl font-bold">
                  {{ formatNumber(emissionCardData.baseline.value, 3) }}
                </div>
                <p class="text-xs text-muted-foreground">{{ emissionCardData.baseline.unit }}</p>
                
                <!-- Scenario Improvements -->
                <div v-if="emissionCardData.scenarios.length > 0" class="space-y-1">
                  <div v-for="scenario in emissionCardData.scenarios" :key="scenario.name" 
                       class="flex justify-between text-xs">
                    <span class="truncate">{{ scenario.name }}:</span>
                    <span :class="getImprovementColorClass(scenario.improvement)">
                      {{ scenario.improvement > 0 ? '+' : '' }}{{ formatNumber(scenario.improvement, 1) }}%
                    </span>
                  </div>
                </div>
              </div>
              <div v-else class="text-2xl font-bold">
                <Skeleton class="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
          
          <!-- Stranding Card -->
          <Card class="min-h-32">
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-medium text-foreground">Stranding Risiko</CardTitle>
                <AlertTriangle class="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="strandingCardData" class="space-y-2">
                <!-- Baseline Value -->
                <div class="text-2xl font-bold" :class="getRiskColorClass(strandingCardData.baseline.riskLevel)">
                  {{ formatNumber(strandingCardData.baseline.value, 1) }}
                </div>
                <p class="text-xs text-muted-foreground">{{ strandingCardData.baseline.unit }}</p>
                
                <!-- Risk Status -->
                <div class="text-xs">
                  <Badge 
                    :variant="strandingCardData.baseline.riskLevel === 'low' ? 'default' : 
                             strandingCardData.baseline.riskLevel === 'medium' ? 'secondary' : 'destructive'"
                    class="text-xs"
                  >
                    {{ strandingCardData.baseline.status }}
                  </Badge>
                </div>
                
                <!-- Scenario Improvements -->
                <div v-if="strandingCardData.scenarios.length > 0" class="space-y-1">
                  <div v-for="scenario in strandingCardData.scenarios" :key="scenario.name" 
                       class="flex justify-between text-xs">
                    <span class="truncate">{{ scenario.name }}:</span>
                    <span :class="getImprovementColorClass(scenario.improvement)">
                      {{ scenario.improvement > 0 ? '+' : '' }}{{ formatNumber(scenario.improvement, 1) }}J
                    </span>
                  </div>
                </div>
              </div>
              <div v-else class="text-2xl font-bold">
                <Skeleton class="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
          
          <!-- Betriebskosten Card -->
          <Card class="min-h-32">
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-medium text-foreground">Betriebskosten</CardTitle>
                <HoverCard>
                  <HoverCardTrigger>
                    <Euro class="h-4 w-4 text-muted-foreground cursor-help" />
                  </HoverCardTrigger>
                  <HoverCardContent side="top" class="w-80">
                    <div class="space-y-2">
                      <h4 class="font-medium">Kosten Optionen</h4>
                      
                      <!-- Cost Type Selection -->
                      <div class="space-y-2">
                        <Label class="text-xs">Kostentyp</Label>
                        <Select v-model="selectedCostType" v-if="costCardData?.options">
                          <SelectTrigger class="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="type in costCardData.options.cost_types"
                              :key="type.key"
                              :value="type.key"
                            >
                              {{ type.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <!-- Unit Selection -->
                      <div class="space-y-2">
                        <Label class="text-xs">Einheit</Label>
                        <Select v-model="selectedCostUnit" v-if="costCardData?.options">
                          <SelectTrigger class="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="unit in costCardData.options.units"
                              :key="unit.key"
                              :value="unit.key"
                            >
                              {{ unit.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="costCardData" class="space-y-2">
                <!-- Baseline Value -->
                <div class="text-2xl font-bold">
                  {{ formatNumber(costCardData.baseline.value) }}
                </div>
                <p class="text-xs text-muted-foreground">{{ costCardData.baseline.unit }}</p>
                
                <!-- Scenario Improvements -->
                <div v-if="costCardData.scenarios.length > 0" class="space-y-1">
                  <div v-for="scenario in costCardData.scenarios" :key="scenario.name" 
                       class="flex justify-between text-xs">
                    <span class="truncate">{{ scenario.name }}:</span>
                    <span :class="getImprovementColorClass(scenario.improvement)">
                      {{ scenario.improvement > 0 ? '+' : '' }}{{ formatNumber(scenario.improvement, 1) }}%
                    </span>
                  </div>
                </div>
              </div>
              <div v-else class="text-2xl font-bold">
                <Skeleton class="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <!-- Construction Details Button -->
        <div class="flex justify-center mt-6">
          <Sheet :open="isConstructionDetailsOpen" @update:open="isConstructionDetailsOpen = $event">
            <SheetTrigger as-child>
              <Button variant="outline" class="flex items-center space-x-2">
                <Settings class="h-4 w-4" />
                <span>Konstruktionsdetails anzeigen</span>
              </Button>
            </SheetTrigger>
            
            <SheetContent side="right" class="!w-[480px] sm:!w-[650px] !max-w-none flex flex-col">
              <SheetHeader>
                <SheetTitle>Konstruktionsdetails</SheetTitle>
                <SheetDescription>
                  Detaillierte Auswahl der Konstruktionsmaßnahmen für die Gebäudesanierung.
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
                  
                  <!-- Construction details content -->
                  <div v-else-if="formData" class="space-y-6">
                    <div class="space-y-4">
                      <div>
                        <h3 class="text-lg font-medium">
                          Konstruktionsauswahl
                        </h3>
                        <p class="text-sm text-muted-foreground">Detaillierte Auswahl von 4 Konstruktionsmaßnahmen</p>
                      </div>
                      
                      <!-- 4 Construction Type Selections -->
                      <div class="space-y-4">
                        <div v-for="constructionType in formData.construction_types" :key="constructionType" class="space-y-2">
                          <Label :for="`construction-details-${constructionType}`" class="text-sm font-medium">{{ constructionType }}</Label>
                          <Select>
                            <SelectTrigger :id="`construction-details-${constructionType}`">
                              <SelectValue placeholder="Wählen Sie..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem
                                v-for="item in getConstructionOptions(constructionType)"
                                :key="item.construction_number"
                                :value="item.construction_number"
                              >
                                {{ item.construction_name }}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <SheetFooter class="mt-4 border-t pt-4 px-4">
                <Button 
                  variant="outline" 
                  @click="isConstructionDetailsOpen = false"
                  class="w-full"
                >
                  Schließen
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
            </TabsContent>
            
            <!-- Lifecycle Analysis Tab Content -->
            <TabsContent value="lifecycle" class="mt-6">
              <LifecycleAnalysis 
                v-if="retrofitAnalysisResult?.lca_lcc_results"
                :lca-lcc-data="retrofitAnalysisResult.lca_lcc_results"
              />
              <div v-else class="text-center py-8 text-muted-foreground">
                <p>Keine Lebenszyklusanalysedaten verfügbar</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>