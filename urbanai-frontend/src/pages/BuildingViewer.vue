<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
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
import { Plus, Settings, X, Zap, Factory, AlertTriangle, Euro } from 'lucide-vue-next'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'vue-sonner'

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

// Store for undo functionality
const deletedScenario = ref<RetrofitScenario | null>(null)
const deletedFormState = ref<{
  selectedConstructions: {[key: string]: string}
  selectedHVACType: string
  selectedHVAC: string
  constructionYear: string
  hvacYear: string
} | null>(null)

// Form state for construction (4 types)
const selectedConstructions = ref<{[key: string]: string}>({
  'Außenwand': '',
  'Boden': '',
  'Dach': '',
  'Fenster': ''
})
const constructionYear = ref<string>('')

// Form state for HVAC
const selectedHVACType = ref<string>('')
const selectedHVAC = ref<string>('')
const hvacYear = ref<string>('')

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

// Interface for retrofit scenario
interface RetrofitScenario {
  construction: {
    [constructionType: string]: {
      construction_number: string
      construction_name: string
      construction_type: string
    }
  }
  construction_year: string
  hvac: {
    hvac_number: string
    hvac_name: string
    hvac_type: string
  }
  hvac_year: string
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
    return [route.params.gebid, route.query.gebid, route.path]
  } catch (err) {
    console.error('Error accessing route in watcher:', err)
    return [null, null, null]
  }
}, ([paramGebid, queryGebid, path], [oldParamGebid, oldQueryGebid, oldPath]) => {
  try {
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
    // Join multiple GML IDs with comma for the API call
    const gmlIdParam = gmlIds.join(',')
    console.log('🔗 API URL:', `${apiBaseUrl.value}/api/geometry/get_geometry?gmlids=${gmlIdParam}`)
    
    const response = await fetch(
      `${apiBaseUrl.value}/api/geometry/get_geometry?gmlids=${gmlIdParam}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data: GeometryResponse = await response.json()
    console.log('✅ Geometry API Response received:', data)
    
    // Store geometry data
    geometryData.value = data
    
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
    
    // Set default years if available
    if (data.year_ranges) {
      if (!constructionYear.value) {
        constructionYear.value = data.year_ranges.construction_retrofit_year.default.toString()
      }
      if (!hvacYear.value) {
        hvacYear.value = data.year_ranges.hvac_retrofit_year.default.toString()
      }
    }
    
  } catch (err) {
    formDataError.value = `Failed to fetch form data: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Form data fetch error:', err)
  } finally {
    isLoadingFormData.value = false
  }
}

// Handle opening retrofit scenario sheet
const openRetrofitSheet = () => {
  try {
    isSheetOpen.value = true
    fetchFormData().catch(err => {
      console.error('Error fetching form data:', err)
    })
  } catch (err) {
    console.error('Error opening retrofit sheet:', err)
  }
}

// Check if all construction types are selected
const isConstructionComplete = computed(() => {
  try {
    return Object.values(selectedConstructions.value).every(val => val !== '')
  } catch (err) {
    console.error('Error in isConstructionComplete computed:', err)
    return false
  }
})

// Get construction options for a specific type
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
    
    const constructionTypes = Object.keys(retrofitScenario.value.construction)
    if (constructionTypes.length === 0) return 'Keine Auswahl'
    
    return constructionTypes.join(', ')
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
    const surfaceLabels = {
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
    if (!isConstructionComplete.value || !selectedHVAC.value || !constructionYear.value || !hvacYear.value) {
      return // Validation failed
    }

    const constructionData: {[key: string]: any} = {}
    
    // Build construction data object
    Object.keys(selectedConstructions.value).forEach(constructionType => {
      const selectedNumber = selectedConstructions.value[constructionType]
      const constructionItem = formData.value?.construction_samples[constructionType]?.find(
        item => item.construction_number === selectedNumber
      )
      if (constructionItem) {
        constructionData[constructionType] = constructionItem
      }
    })

    const hvacItem = getHVACOptions.value.find(item => item.hvac_number === selectedHVAC.value)
    if (!hvacItem) return

    retrofitScenario.value = {
      construction: constructionData,
      construction_year: constructionYear.value,
      hvac: hvacItem,
      hvac_year: hvacYear.value
    }

    isSheetOpen.value = false
    
    // TODO: Send to backend for calculation and storing
    console.log('Saved retrofit scenario:', retrofitScenario.value)
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
      selectedConstructions: { ...selectedConstructions.value },
      selectedHVACType: selectedHVACType.value,
      selectedHVAC: selectedHVAC.value,
      constructionYear: constructionYear.value,
      hvacYear: hvacYear.value
    }
    
    // Clear current scenario
    retrofitScenario.value = null
    selectedConstructions.value = {
      'Außenwand': '',
      'Boden': '',
      'Dach': '',
      'Fenster': ''
    }
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
      selectedConstructions.value = deletedFormState.value.selectedConstructions
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
      // Restore construction selections
      Object.keys(retrofitScenario.value.construction).forEach(constructionType => {
        selectedConstructions.value[constructionType] = retrofitScenario.value!.construction[constructionType].construction_number
      })
      constructionYear.value = retrofitScenario.value.construction_year
      
      // Restore HVAC selections
      selectedHVACType.value = retrofitScenario.value.hvac.hvac_type
      selectedHVAC.value = retrofitScenario.value.hvac.hvac_number
      hvacYear.value = retrofitScenario.value.hvac_year
    }
    isSheetOpen.value = true
    fetchFormData().catch(err => {
      console.error('Error fetching form data:', err)
    })
  } catch (err) {
    console.error('Error modifying retrofit scenario:', err)
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
                                    Konstruktion
                                  </h3>
                                  <p class="text-sm text-muted-foreground">Auswahl von 4 Konstruktionsmaßnahmen</p>
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
                                
                                <!-- 4 Construction Type Selections -->
                                <div class="space-y-4">
                                  <div v-for="constructionType in formData.construction_types" :key="constructionType" class="space-y-2">
                                    <Label :for="`construction-${constructionType}`" class="text-sm font-medium">{{ constructionType }}</Label>
                                    <Select v-model="selectedConstructions[constructionType]">
                                      <SelectTrigger :id="`construction-${constructionType}`">
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
                            <Button 
                              @click="saveRetrofitScenario"
                              :disabled="!isConstructionComplete || !selectedHVAC || !constructionYear || !hvacYear"
                              class="flex-1"
                            >
                              Szenario speichern
                            </Button>
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
                                      Konstruktion
                                    </h3>
                                    <p class="text-sm text-muted-foreground">Auswahl von 4 Konstruktionsmaßnahmen</p>
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
                                  
                                  <!-- 4 Construction Type Selections -->
                                  <div class="space-y-4">
                                    <div v-for="constructionType in formData.construction_types" :key="constructionType" class="space-y-2">
                                      <Label :for="`construction-${constructionType}-modify`" class="text-sm font-medium">{{ constructionType }}</Label>
                                      <Select v-model="selectedConstructions[constructionType]">
                                        <SelectTrigger :id="`construction-${constructionType}-modify`">
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
                                :disabled="!isConstructionComplete || !selectedHVAC || !constructionYear || !hvacYear"
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
                              <div>
                                <span class="font-medium">Konstruktion ({{ retrofitScenario.construction_year }}):</span>
                              </div>
                              <div class="pl-2 text-muted-foreground">
                                {{ constructionSummary }}
                              </div>
                              <div>
                                <span class="font-medium">TGA ({{ retrofitScenario.hvac_year }}):</span> {{ retrofitScenario.hvac.hvac_name }}
                              </div>
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
        
        <!-- Energy Metrics Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <!-- Energiebedarf Card -->
          <Card class="h-32">
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-medium text-foreground">Energiebedarf</CardTitle>
                <Zap class="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">
                <Skeleton class="h-6 w-16" />
              </div>
              <p class="text-xs text-muted-foreground mt-1">kWh/m²·a</p>
            </CardContent>
          </Card>
          
          <!-- Emissionen Card -->
          <Card class="h-32">
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-medium text-foreground">Emissionen</CardTitle>
                <Factory class="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">
                <Skeleton class="h-6 w-16" />
              </div>
              <p class="text-xs text-muted-foreground mt-1">kg CO₂/m²·a</p>
            </CardContent>
          </Card>
          
          <!-- Stranding Card -->
          <Card class="h-32">
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-medium text-foreground">Stranding</CardTitle>
                <AlertTriangle class="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">
                <Skeleton class="h-6 w-16" />
              </div>
              <p class="text-xs text-muted-foreground mt-1">Risiko-Index</p>
            </CardContent>
          </Card>
          
          <!-- Betriebskosten Card -->
          <Card class="h-32">
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <CardTitle class="text-sm font-medium text-foreground">Betriebskosten</CardTitle>
                <Euro class="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">
                <Skeleton class="h-6 w-16" />
              </div>
              <p class="text-xs text-muted-foreground mt-1">€/m²·a</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style> 