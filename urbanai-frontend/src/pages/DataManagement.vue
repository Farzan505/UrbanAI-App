<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'vue-sonner'
import ArcGIS2DMapViewer from '@/components/map/ArcGIS2DMapViewer.vue'
import AuthStatus from '@/components/AuthStatus.vue'
import { useAuth } from '@/composables/useAuth'
import { 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  MapPin, 
  Building, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Database,
  ExternalLink,
  RefreshCw,
  Scissors,
  PenTool,
  Square,
  Play,
  Pause
} from 'lucide-vue-next'

// Router
let route: any
try {
  route = useRoute()
} catch (err) {
  console.error('Error accessing route:', err)
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
const apiBaseUrl = ref('http://localhost:8080')
const buildingData = ref<any>(null)
const geometryData = ref<any>(null)
const isLoadingGeometry = ref(false)

// GMLID management state
const gmlidMappings = ref<any[]>([])
const isLoadingMappings = ref(false)
const mappingsError = ref('')
const editableFields = ref<any>(null)

// Form state for adding new GMLID
const isAddingGmlid = ref(false)
const newGmlid = ref('')
const newGmlidError = ref('')

// Edit state
const editingMapping = ref<any>(null)
const isEditing = ref(false)

// Delete confirmation
const deletingGmlid = ref<string | null>(null)
const isDeleteDialogOpen = ref(false)

// Global comment and building-level fields
const globalComment = ref('')
const isUpdatingComment = ref(false)
const buildingLevelFields = ref<any>({})
const isUpdatingBuildingFields = ref(false)

// Portal items functionality
const { isAuthenticated, queryPortalItems, isLoading: authLoading, error: authError } = useAuth()
const portalItems = ref<any[]>([])
const isLoadingPortalItems = ref(false)
const portalItemsError = ref('')
const selectedPortalItem = ref<any>(null)
const addingPortalItemToMap = ref<string | null>(null)

// Line drawing functionality
const drawnLines = ref<any[]>([])
const isDrawingMode = ref(false)
const selectedLine = ref<any>(null)
const isProcessingLine = ref(false)
const activeTab = ref('gmlid-management')
const mapViewerRef = ref<any>(null)
const lineDrawingMapRef = ref<any>(null)

// Query portal items
const loadPortalItems = async () => {
  try {
    if (!isAuthenticated.value) {
      portalItemsError.value = 'Authentication required to load portal items'
      return
    }

    isLoadingPortalItems.value = true
    portalItemsError.value = ''

    console.log('🔍 Loading portal items...')
    const result = await queryPortalItems('', 20)
    
    portalItems.value = result.results || []
    console.log('✅ Portal items loaded:', portalItems.value.length)
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    portalItemsError.value = `Failed to load portal items: ${errorMessage}`
    console.error('❌ Portal items error:', err)
  } finally {
    isLoadingPortalItems.value = false
  }
}

// Load portal items when authenticated
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    console.log('🔐 User authenticated, loading portal items...')
    loadPortalItems()
  } else {
    console.log('🚪 User not authenticated, clearing portal items')
    portalItems.value = []
    portalItemsError.value = ''
  }
}, { immediate: true })

// Helper function to open URLs
const openUrl = (url: string) => {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank')
  }
}

// Add portal item to map
const addPortalItemToMap = async (item: any) => {
  try {
    addingPortalItemToMap.value = item.id
    console.log('🗺️ Adding portal item to map:', item.title)
    
    // Set the selected portal item - the map will reactively update
    selectedPortalItem.value = item
    
    toast.success(`Portal item "${item.title}" wurde zur Karte hinzugefügt`)
  } catch (err) {
    console.error('❌ Error adding portal item to map:', err)
    toast.error('Fehler beim Hinzufügen des Portal-Items zur Karte')
  } finally {
    addingPortalItemToMap.value = null
  }
}

// Interface for GMLID mapping
interface GmlidMapping {
  gebid: string
  gmlid: string
  epl?: string | null
  babez?: string | null
  gebzabt?: string | null
  ligbez?: string | null
  geprueft?: string | null
  kontrollbedarf?: string | null
  konsistent_citygml_fdh?: string | null
  bearbeitungsbedarf_ldbv?: string | null
  fdh_merge?: string | null
  kommentar?: string | null
  edited_at?: string | null
}

// Interface for API response
interface GmlidMappingResponse {
  status: string
  gebid: string
  count: number
  mappings: GmlidMapping[]
  geometries?: any
  editable_fields?: {
    boolean_fields: string[]
    text_fields: string[]
    boolean_values: string[]
    note: string
  }
  message?: string
}

// Search for building by GEBID
const searchBuilding = async (gebidToSearch: string) => {
  try {
    console.log('🔍 searchBuilding called with:', gebidToSearch)
    
    if (!gebidToSearch) {
      searchError.value = 'Bitte geben Sie eine GEBID ein'
      console.log('❌ No gebidToSearch provided')
      return
    }

    console.log('🚀 Starting search for building:', gebidToSearch)
    isSearching.value = true
    searchError.value = ''
    buildingData.value = null
    gmlidMappings.value = []
    geometryData.value = null

    try {
      const url = `${apiBaseUrl.value}/api/gmlid-mapping/get_gmlid_mapping/${encodeURIComponent(gebidToSearch)}`
      console.log('📡 Fetching from URL:', url)
      
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData: GmlidMappingResponse = await response.json()
      console.log('✅ GMLID mapping response received:', responseData)

      if (responseData.status === 'success') {
        buildingData.value = { gebid: responseData.gebid }
        gmlidMappings.value = responseData.mappings || []
        geometryData.value = responseData.geometries
        editableFields.value = responseData.editable_fields
        
        // Initialize building-level fields from first mapping (they should be the same across all mappings)
        if (responseData.mappings && responseData.mappings.length > 0) {
          const firstMapping = responseData.mappings[0]
          buildingLevelFields.value = {
            konsistent_citygml_fdh: firstMapping.konsistent_citygml_fdh,
            bearbeitungsbedarf_ldbv: firstMapping.bearbeitungsbedarf_ldbv,
            fdh_merge: firstMapping.fdh_merge
          }
          globalComment.value = firstMapping.kommentar || ''
        }
        
        console.log('💾 Stored building data:', buildingData.value)
        console.log('🗺️ GMLID mappings:', gmlidMappings.value)
        console.log('📐 Geometry data:', geometryData.value)
        console.log('📐 Geometry features count:', geometryData.value?.features?.length || 0)
        console.log('🏢 Building-level fields:', buildingLevelFields.value)
        
      } else {
        searchError.value = `API returned status: ${responseData.status || 'unknown'}`
        console.log('❌ API returned unsuccessful status:', responseData.status)
      }

    } catch (err) {
      searchError.value = `Suche fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
      console.error('❌ Search error:', err)
    } finally {
      isSearching.value = false
      console.log('🏁 Search completed')
    }
  } catch (err) {
    console.error('❌ Outer search error:', err)
    searchError.value = 'Ein unerwarteter Fehler ist aufgetreten'
    isSearching.value = false
  }
}

// Watch for route changes
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
      const currentGebid = buildingData.value?.gebid
      if (currentGebid !== newGebid) {
        console.log('Triggering searchBuilding from route watcher for:', newGebid)
        searchBuilding(newGebid)
      }
    } else if (!newGebid && oldGebid) {
      console.log('Route changed to no gebid, resetting view')
      buildingData.value = null
      gmlidMappings.value = []
      geometryData.value = null
      searchError.value = ''
    }
  } catch (err) {
    console.error('Error in route watcher callback:', err)
  }
}, { immediate: true })

// Initialize from props or route
onMounted(() => {
  try {
    console.log('DataManagement mounted with route info:', { 
      propsGebid: props.gebid, 
      routeGebid: route.params.gebid, 
      routePath: route.path
    })
    
    const initialGebid = props.gebid || route.params.gebid
    if (initialGebid && typeof initialGebid === 'string') {
      console.log('Initializing with gebid:', initialGebid)
      searchBuilding(initialGebid)
    } else if (route.query.gebid && typeof route.query.gebid === 'string') {
      console.log('Found gebid in query parameters:', route.query.gebid)
      searchBuilding(route.query.gebid)
    }
  } catch (err) {
    console.error('Error in onMounted:', err)
    searchError.value = 'Initialisierungsfehler aufgetreten'
  }
})

// Computed properties
const hasMappings = computed(() => gmlidMappings.value.length > 0)
const mappingCount = computed(() => gmlidMappings.value.length)

// Debug geometry data
watch(geometryData, (newGeometryData) => {
  console.log('🔄 Geometry data changed in DataManagement:', {
    hasData: !!newGeometryData,
    hasFeatures: !!newGeometryData?.features,
    featureCount: newGeometryData?.features?.length || 0,
    data: newGeometryData
  })
}, { deep: true })

// Add new GMLID mapping
const addGmlidMapping = async () => {
  try {
    if (!newGmlid.value.trim()) {
      newGmlidError.value = 'Bitte geben Sie eine GMLID ein'
      return
    }

    // Check if GMLID already exists
    const existingMapping = gmlidMappings.value.find(m => m.gmlid === newGmlid.value.trim())
    if (existingMapping) {
      newGmlidError.value = 'Diese GMLID existiert bereits für dieses Gebäude'
      return
    }

    isAddingGmlid.value = true
    newGmlidError.value = ''

    const mappingsData = {
      additions: [{
        gmlid: newGmlid.value.trim(),
        kommentar: globalComment.value || null
      }],
      comment: globalComment.value || null
    }

    const requestBody = {
      mappings_data: mappingsData
    }

    console.log('📤 Sending add GMLID request:', requestBody)

    const response = await fetch(`${apiBaseUrl.value}/api/gmlid-mapping/update_gmlid_mapping/${buildingData.value.gebid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Add GMLID error response:', errorText)
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Add GMLID result:', result)

    if (result.status === 'success') {
      // Refresh the data
      await searchBuilding(buildingData.value.gebid)
      
      // Reset form
      newGmlid.value = ''
      isAddingGmlid.value = false
      
      toast.success('GMLID hinzugefügt', {
        description: `GMLID ${newGmlid.value} wurde erfolgreich hinzugefügt.`
      })
    } else {
      throw new Error(result.message || 'Unknown error')
    }

  } catch (err) {
    console.error('Error adding GMLID:', err)
    newGmlidError.value = `Fehler beim Hinzufügen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
    toast.error('Fehler beim Hinzufügen', {
      description: newGmlidError.value
    })
  } finally {
    isAddingGmlid.value = false
  }
}

// Start editing a mapping
const startEditing = (mapping: GmlidMapping) => {
  editingMapping.value = { ...mapping }
  isEditing.value = true
}

// Cancel editing
const cancelEditing = () => {
  editingMapping.value = null
  isEditing.value = false
}

// Save mapping changes
const saveMappingChanges = async () => {
  try {
    if (!editingMapping.value) return

    isEditing.value = true

    const mappingsData = {
      updates: [editingMapping.value],
      comment: globalComment.value || null
    }

    const requestBody = {
      mappings_data: mappingsData
    }

    console.log('📤 Sending update mapping request:', requestBody)

    const response = await fetch(`${apiBaseUrl.value}/api/gmlid-mapping/update_gmlid_mapping/${buildingData.value.gebid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Update mapping error response:', errorText)
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Update mapping result:', result)

    if (result.status === 'success') {
      // Refresh the data
      await searchBuilding(buildingData.value.gebid)
      
      // Reset editing state
      editingMapping.value = null
      isEditing.value = false
      
      toast.success('Änderungen gespeichert', {
        description: 'Die GMLID-Zuordnung wurde erfolgreich aktualisiert.'
      })
    } else {
      throw new Error(result.message || 'Unknown error')
    }

  } catch (err) {
    console.error('Error updating mapping:', err)
    toast.error('Fehler beim Speichern', {
      description: `Fehler beim Aktualisieren: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
    })
  } finally {
    isEditing.value = false
  }
}

// Helper functions for delete dialog
const openDeleteDialog = (gmlid: string) => {
  deletingGmlid.value = gmlid
  isDeleteDialogOpen.value = true
}

const closeDeleteDialog = () => {
  deletingGmlid.value = null
  isDeleteDialogOpen.value = false
}

const confirmDelete = () => {
  if (deletingGmlid.value) {
    deleteGmlidMapping(deletingGmlid.value)
  }
}

// Delete GMLID mapping
const deleteGmlidMapping = async (gmlid: string) => {
  try {
    console.log('🗑️ Attempting to delete GMLID:', gmlid, 'for building:', buildingData.value.gebid)
    
    const url = `${apiBaseUrl.value}/api/gmlid-mapping/delete_gmlid_mapping/${encodeURIComponent(buildingData.value.gebid)}/${encodeURIComponent(gmlid)}`
    console.log('📡 Delete URL:', url)
    
    const response = await fetch(url, {
      method: 'DELETE'
    })

    console.log('📡 Delete response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Delete error response:', errorText)
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Delete GMLID result:', result)

    if (result.status === 'success') {
      // Refresh the data
      await searchBuilding(buildingData.value.gebid)
      
      // Reset delete state
      closeDeleteDialog()
      
      toast.success('GMLID gelöscht', {
        description: `GMLID ${gmlid} wurde erfolgreich gelöscht.`
      })
    } else {
      throw new Error(result.message || 'Unknown error')
    }

  } catch (err) {
    console.error('❌ Error deleting GMLID:', err)
    toast.error('Fehler beim Löschen', {
      description: `Fehler beim Löschen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
    })
  }
}

// Update building-level fields
const updateBuildingFields = async () => {
  try {
    isUpdatingBuildingFields.value = true

    const mappingsData = {
      updates: gmlidMappings.value.map(mapping => ({
        ...mapping,
        ...buildingLevelFields.value,
        kommentar: globalComment.value || null
      })),
      comment: globalComment.value || null
    }

    const requestBody = {
      mappings_data: mappingsData
    }

    console.log('📤 Sending update building fields request:', requestBody)

    const response = await fetch(`${apiBaseUrl.value}/api/gmlid-mapping/update_gmlid_mapping/${buildingData.value.gebid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Update building fields error response:', errorText)
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Update building fields result:', result)

    if (result.status === 'success') {
      // Refresh the data
      await searchBuilding(buildingData.value.gebid)
      
      toast.success('Gebäudedaten aktualisiert', {
        description: 'Die gebäudespezifischen Felder wurden erfolgreich aktualisiert.'
      })
    } else {
      throw new Error(result.message || 'Unknown error')
    }

  } catch (err) {
    console.error('Error updating building fields:', err)
    toast.error('Fehler beim Aktualisieren', {
      description: `Fehler beim Aktualisieren der Gebäudedaten: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
    })
  } finally {
    isUpdatingBuildingFields.value = false
  }
}

// Update global comment
const updateGlobalComment = async () => {
  try {
    isUpdatingComment.value = true

    const mappingsData = {
      comment: globalComment.value || null
    }

    const requestBody = {
      mappings_data: mappingsData
    }

    console.log('📤 Sending update comment request:', requestBody)

    const response = await fetch(`${apiBaseUrl.value}/api/gmlid-mapping/update_gmlid_mapping/${buildingData.value.gebid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Update comment error response:', errorText)
      throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Update comment result:', result)

    if (result.status === 'success') {
      // Refresh the data
      await searchBuilding(buildingData.value.gebid)
      
      toast.success('Kommentar aktualisiert', {
        description: 'Der globale Kommentar wurde erfolgreich aktualisiert.'
      })
    } else {
      throw new Error(result.message || 'Unknown error')
    }

  } catch (err) {
    console.error('Error updating comment:', err)
    toast.error('Fehler beim Aktualisieren', {
      description: `Fehler beim Aktualisieren des Kommentars: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
    })
  } finally {
    isUpdatingComment.value = false
  }
}

// Format display values
const formatDisplayValue = (value: any) => {
  if (value === null || value === undefined || value === '') return 'Nicht angegeben'
  return value
}

// Get status badge variant
const getStatusBadgeVariant = (value: string | null) => {
  if (value === 'Ja') return 'default'
  if (value === 'Nein') return 'destructive'
  return 'secondary'
}

// Handle feature selection from map
const handleFeatureSelected = (feature: { gmlid: string; attributes: any }) => {
  console.log('🎯 Feature selected from map:', feature)
  
  // Check if GMLID already exists
  const existingMapping = gmlidMappings.value.find(m => m.gmlid === feature.gmlid)
  if (existingMapping) {
    console.log('⚠️ GMLID already exists, not adding to input field')
    toast.warning('GMLID bereits vorhanden', {
      description: `GMLID ${feature.gmlid} ist bereits für dieses Gebäude zugeordnet.`
    })
    return
  }
  
  // Populate the new GMLID input field
  newGmlid.value = feature.gmlid
  console.log('✅ Auto-populated GMLID input field with:', feature.gmlid)
  
  // Clear any previous error
  newGmlidError.value = ''
  
  // Show success toast
  toast.success('GMLID aus Karte übernommen', {
    description: `GMLID ${feature.gmlid} wurde in das Eingabefeld eingefügt. Klicken Sie auf + zum Hinzufügen.`
  })
}

// Handle line drawing from map
const handleLineDrawn = (lineData: { geometry: any; id: string }) => {
  console.log('✏️ Line drawn on map:', lineData)
  
  // Add the line to our collection
  const newLine = {
    id: lineData.id,
    geometry: lineData.geometry,
    gebid: buildingData.value?.gebid,
    createdAt: new Date().toISOString(),
    processed: false
  }
  
  drawnLines.value.push(newLine)
  
  toast.success('Linie gezeichnet', {
    description: 'Die Schnittlinie wurde erfolgreich erstellt und kann nun verarbeitet werden.'
  })
  
  console.log('✅ Added line to collection:', newLine)
}

// Toggle drawing mode
const toggleDrawingMode = () => {
  isDrawingMode.value = !isDrawingMode.value
  console.log('🖊️ Drawing mode toggled:', isDrawingMode.value)
  
  toast.info(isDrawingMode.value ? 'Zeichenmodus aktiviert' : 'Zeichenmodus deaktiviert', {
    description: isDrawingMode.value 
      ? 'Klicken Sie auf die Karte, um eine Schnittlinie zu zeichnen.'
      : 'Zeichenmodus wurde deaktiviert.'
  })
}

// Process line for 3D cutting
const processLineFor3DCutting = async (line: any) => {
  try {
    isProcessingLine.value = true
    selectedLine.value = line
    
    console.log('🔄 Processing line for 3D cutting:', line)
    
    // Prepare the payload for the backend
    const payload = {
      gebid: line.gebid,
      lineGeometry: line.geometry,
      lineId: line.id,
      operation: '3d_cut',
      timestamp: new Date().toISOString()
    }
    
    console.log('📤 Sending line geometry to backend:', payload)
    
    // TODO: Replace with actual backend endpoint
    // const response = await fetch(`${apiBaseUrl.value}/api/3d-cutting/process-line`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(payload)
    // })
    
    // For now, simulate the request
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Mark line as processed
    line.processed = true
    line.processedAt = new Date().toISOString()
    
    toast.success('Linie verarbeitet', {
      description: 'Die Schnittlinie wurde erfolgreich für das 3D-Schneiden verarbeitet.'
    })
    
    console.log('✅ Line processed successfully:', line)
    
  } catch (err) {
    console.error('❌ Error processing line:', err)
    toast.error('Fehler bei der Verarbeitung', {
      description: `Fehler beim Verarbeiten der Linie: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`
    })
  } finally {
    isProcessingLine.value = false
    selectedLine.value = null
  }
}

// Delete a drawn line
const deleteLine = (lineId: string) => {
  const index = drawnLines.value.findIndex(line => line.id === lineId)
  if (index > -1) {
    // Remove from local array
    drawnLines.value.splice(index, 1)
    
    // Remove from map
    if (lineDrawingMapRef.value && lineDrawingMapRef.value.deleteLine) {
      lineDrawingMapRef.value.deleteLine(lineId)
    }
    
    toast.success('Linie gelöscht', {
      description: 'Die Schnittlinie wurde erfolgreich entfernt.'
    })
  }
}

// Clear all drawn lines
const clearAllLines = () => {
  // Clear from local array
  drawnLines.value = []
  
  // Clear from map (use the line drawing map ref)
  if (lineDrawingMapRef.value && lineDrawingMapRef.value.clearDrawnLines) {
    lineDrawingMapRef.value.clearDrawnLines()
  }
  
  toast.success('Alle Linien gelöscht', {
    description: 'Alle Schnittlinien wurden erfolgreich entfernt.'
  })
}
</script>

<template>
  <div class="h-full bg-white">
    <main class="w-full px-4 sm:px-6 lg:px-8 py-8 h-full overflow-auto">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Datenbearbeitung</h1>
        
        <!-- Authentication Status -->
        <div class="mt-4">
          <AuthStatus />
        </div>
        
        <!-- Portal Items Section -->
        <div class="mt-6">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <Database class="h-5 w-5 text-blue-600" />
                  <CardTitle>Portal Items</CardTitle>
                </div>
                <Button 
                  v-if="isAuthenticated" 
                  @click="loadPortalItems" 
                  :disabled="isLoadingPortalItems"
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw :class="{ 'animate-spin': isLoadingPortalItems }" class="h-4 w-4 mr-2" />
                  Aktualisieren
                </Button>
              </div>
              <CardDescription>
                {{ isAuthenticated ? 'Ihre Portal-Items aus dem ArcGIS Portal' : 'Melden Sie sich an, um Portal-Items anzuzeigen' }}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <!-- Not authenticated state -->
              <div v-if="!isAuthenticated" class="text-center py-8">
                <Database class="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 class="text-lg font-medium text-gray-900 mb-2">Authentifizierung erforderlich</h3>
                <p class="text-gray-600">
                  Melden Sie sich an, um Ihre Portal-Items anzuzeigen.
                </p>
              </div>

              <!-- Loading state -->
              <div v-else-if="isLoadingPortalItems" class="text-center py-8">
                <Loader2 class="mx-auto h-8 w-8 text-blue-600 animate-spin mb-4" />
                <p class="text-gray-600">Portal-Items werden geladen...</p>
              </div>

              <!-- Error state -->
              <div v-else-if="portalItemsError" class="bg-red-50 border border-red-200 rounded-md p-4">
                <div class="flex items-center space-x-2">
                  <AlertCircle class="h-5 w-5 text-red-600" />
                  <p class="text-sm text-red-600">{{ portalItemsError }}</p>
                </div>
              </div>

              <!-- Portal items list -->
              <div v-else-if="portalItems.length > 0">
                <div class="mb-4">
                  <p class="text-sm text-gray-600">{{ portalItems.length }} Portal-Items gefunden</p>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card v-for="item in portalItems" :key="item.id" class="hover:shadow-md transition-shadow">
                    <CardContent class="p-4">
                      <!-- Item thumbnail -->
                      <div v-if="item.thumbnailUrl" class="mb-3">
                        <img 
                          :src="item.thumbnailUrl" 
                          :alt="item.title"
                          class="w-full h-32 object-cover rounded"
                          @error="(e) => ((e.target as HTMLImageElement)?.style && ((e.target as HTMLImageElement).style.display = 'none'))"
                        />
                      </div>
                      
                      <!-- Item details -->
                      <div>
                        <h4 class="font-semibold text-sm mb-1 line-clamp-2">{{ item.title || 'Untitled' }}</h4>
                        <p class="text-xs text-gray-600 mb-2">{{ item.type || 'Unknown type' }}</p>
                        
                        <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
                          <span>{{ item.numViews || 0 }} Aufrufe</span>
                          <span>{{ new Date(item.created).toLocaleDateString('de-DE') }}</span>
                        </div>
                        
                        <p v-if="item.snippet" class="text-xs text-gray-600 mb-3 line-clamp-2">{{ item.snippet }}</p>
                        
                        <!-- Action buttons -->
                        <div class="flex gap-2">
                          <Button 
                            @click="() => addPortalItemToMap(item)"
                            size="sm"
                            variant="default"
                            class="flex-1"
                            :disabled="addingPortalItemToMap === item.id"
                          >
                            <MapPin class="h-3 w-3 mr-1" />
                            <span v-if="addingPortalItemToMap === item.id">Wird hinzugefügt...</span>
                            <span v-else>Zu Karte hinzufügen</span>
                          </Button>
                          <Button 
                            v-if="item.itemPageUrl" 
                            @click="() => openUrl(item.itemPageUrl)"
                            size="sm"
                            variant="outline"
                            class="flex-shrink-0"
                          >
                            <ExternalLink class="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <!-- No items state -->
              <div v-else class="text-center py-8">
                <Database class="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 class="text-lg font-medium text-gray-900 mb-2">Keine Portal-Items gefunden</h3>
                <p class="text-gray-600">
                  Es wurden keine Portal-Items in Ihrem Account gefunden.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="searchError" class="mb-6">
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex items-center space-x-2">
            <AlertCircle class="h-5 w-5 text-red-600" />
            <p class="text-sm text-red-600">{{ searchError }}</p>
          </div>
        </div>
      </div>

      <div v-if="buildingData && !isSearching" class="space-y-6">
        <!-- Tabs for different management tools -->
        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="gmlid-management">
              <MapPin class="h-4 w-4 mr-2" />
              GMLID-Verwaltung
            </TabsTrigger>
            <TabsTrigger value="line-drawing">
              <Scissors class="h-4 w-4 mr-2" />
              3D-Schneiden
            </TabsTrigger>
          </TabsList>

          <!-- GMLID Management Tab -->
          <TabsContent value="gmlid-management" class="mt-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Left: GMLID Management Card -->
              <Card class="h-full flex flex-col">
          <CardHeader>
            <CardTitle class="flex items-center space-x-2">
              <MapPin class="h-5 w-5" />
              <span>GMLID-Zuordnungen</span>
            </CardTitle>
            <CardDescription>
              Verwalten Sie die GMLID-Zuordnungen für dieses Gebäude.
            </CardDescription>
          </CardHeader>
          <CardContent class="flex-1 flex flex-col">
            <div class="mb-4">
              <Label class="text-sm font-medium text-gray-600">GEBID</Label>
              <p class="text-lg font-mono">{{ buildingData.gebid }}</p>
            </div>
            <!-- Building-level fields section -->
            <div v-if="editableFields && gmlidMappings.length > 0" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Label class="text-sm font-medium text-blue-800 mb-3 block">Gebäudespezifische Felder (gelten für alle GMLID-Zuordnungen)</Label>
              
              <!-- Building-level boolean fields -->
              <div class="grid grid-cols-1 gap-3 mb-4">
                <div v-for="field in ['konsistent_citygml_fdh', 'bearbeitungsbedarf_ldbv', 'fdh_merge']" :key="field" class="flex items-center gap-2">
                  <Label class="text-xs font-medium min-w-[120px]">{{ field }}:</Label>
                  <Select v-model="buildingLevelFields[field]">
                    <SelectTrigger class="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="val in editableFields.boolean_values" :key="val" :value="val">{{ val }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <!-- Global comment -->
              <div class="mb-3">
                <Label class="text-xs font-medium text-blue-800">Globaler Kommentar:</Label>
                <Textarea v-model="globalComment" placeholder="Kommentar für alle GMLID-Zuordnungen..." rows="2" class="w-full mt-1" />
              </div>
              
              <Button :disabled="isUpdatingBuildingFields" @click="updateBuildingFields" class="w-full">
                <Save class="h-4 w-4 mr-1" /> Gebäudedaten speichern
              </Button>
            </div>
            <div class="flex flex-col gap-2 flex-1 overflow-y-auto min-h-0">
              <div v-for="mapping in gmlidMappings" :key="mapping.gmlid" class="flex flex-col bg-gray-50 border rounded px-3 py-2 mb-2">
                <div class="flex items-center gap-2 mb-2">
                  <Badge variant="outline" class="font-mono">{{ mapping.gmlid }}</Badge>
                  <span class="text-xs text-gray-500">{{ mapping.babez || '—' }}</span>
                  <Button size="icon" variant="ghost" @click="() => openDeleteDialog(mapping.gmlid)" class="text-red-600 hover:text-red-700 ml-auto">
                    <Trash2 class="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" @click="() => startEditing(mapping)" class="ml-1">
                    <Edit class="h-4 w-4" />
                  </Button>
                </div>
                <div v-if="editingMapping && editingMapping.gmlid === mapping.gmlid" class="space-y-2">
                  <div v-for="field in editableFields?.boolean_fields || []" :key="field" class="flex items-center gap-2">
                    <Label class="text-xs font-medium">{{ field }}</Label>
                    <Select v-model="editingMapping[field]">
                      <SelectTrigger class="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="val in editableFields.boolean_values" :key="val" :value="val">{{ val }}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div v-for="field in editableFields?.text_fields || []" :key="field" class="flex items-center gap-2">
                    <Label class="text-xs font-medium">{{ field }}</Label>
                    <Input v-model="editingMapping[field]" class="w-full" />
                  </div>
                  <div class="flex gap-2 mt-2">
                    <Button size="sm" @click="saveMappingChanges">
                      <Save class="h-4 w-4 mr-1" /> Speichern
                    </Button>
                    <Button size="sm" variant="outline" @click="cancelEditing">Abbrechen</Button>
                  </div>
                </div>
                <div v-else class="flex flex-wrap gap-2 text-xs">
                  <!-- Only show GMLID-specific fields, not building-level fields -->
                  <div v-for="field in (editableFields?.boolean_fields || []).filter((f: string) => !['konsistent_citygml_fdh', 'bearbeitungsbedarf_ldbv', 'fdh_merge'].includes(f))" :key="field" class="flex items-center gap-1">
                    <span class="font-medium">{{ field }}:</span>
                    <Badge :variant="getStatusBadgeVariant(mapping[field])">{{ mapping[field] || '—' }}</Badge>
                  </div>
                  <div v-for="field in (editableFields?.text_fields || []).filter((f: string) => f !== 'kommentar')" :key="field" class="flex items-center gap-1">
                    <span class="font-medium">{{ field }}:</span>
                    <span>{{ mapping[field] || '—' }}</span>
                  </div>
                  <!-- Show other GMLID-specific fields -->
                  <div v-if="mapping.epl" class="flex items-center gap-1">
                    <span class="font-medium">EPL:</span>
                    <span>{{ mapping.epl }}</span>
                  </div>
                  <div v-if="mapping.gebzabt" class="flex items-center gap-1">
                    <span class="font-medium">GEBZABT:</span>
                    <span>{{ mapping.gebzabt }}</span>
                  </div>
                  <div v-if="mapping.ligbez" class="flex items-center gap-1">
                    <span class="font-medium">LIGBEZ:</span>
                    <span>{{ mapping.ligbez }}</span>
                  </div>
                </div>
              </div>
              <div v-if="gmlidMappings.length === 0" class="text-center text-gray-400 py-8">
                Keine GMLID-Zuordnungen vorhanden.
              </div>
            </div>
            <div class="mt-4 flex gap-2">
              <div class="flex-1">
                <Input
                  id="new-gmlid"
                  v-model="newGmlid"
                  placeholder="Neue GMLID hinzufügen oder Gebäude in der Karte auswählen..."
                  :class="{ 
                    'border-red-500': newGmlidError,
                    'border-green-500 bg-green-50': newGmlid && !newGmlidError
                  }"
                  @keyup.enter="addGmlidMapping"
                />
                <p v-if="newGmlid && !newGmlidError" class="text-xs text-green-600 mt-1">
                  💡 GMLID bereit zum Hinzufügen - drücken Sie Enter oder klicken Sie auf +
                </p>
              </div>
              <Button @click="addGmlidMapping" :disabled="isAddingGmlid || !newGmlid.trim()">
                <Plus class="h-4 w-4" />
              </Button>
            </div>
            <p v-if="newGmlidError" class="text-sm text-red-600 mt-1">{{ newGmlidError }}</p>
          </CardContent>
        </Card>

        <!-- Right: Map Card -->
        <Card class="h-full flex flex-col">


            <ArcGIS2DMapViewer 
              ref="mapViewerRef"
              :geometry-data="geometryData"
              :is-loading="isLoadingGeometry"
              :portal-items="selectedPortalItem ? [selectedPortalItem] : []"
              @feature-selected="handleFeatureSelected"
            />

              </Card>
            </div>
          </TabsContent>

          <!-- Line Drawing Tab -->
          <TabsContent value="line-drawing" class="mt-6">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Left: Line Drawing Controls -->
              <Card class="h-full flex flex-col">
                <CardHeader>
                  <CardTitle class="flex items-center space-x-2">
                    <Scissors class="h-5 w-5" />
                    <span>3D-Schnittlinien</span>
                  </CardTitle>
                  <CardDescription>
                    Zeichnen Sie Linien auf dem Gebäudegrundriss, um das 3D-Gebäude zu schneiden.
                  </CardDescription>
                </CardHeader>
                <CardContent class="flex-1 flex flex-col">
                  <!-- Drawing Controls -->
                  <div class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="flex items-center justify-between mb-4">
                      <Label class="text-sm font-medium text-blue-800">Zeichenmodus</Label>
                      <Button 
                        @click="toggleDrawingMode" 
                        :variant="isDrawingMode ? 'default' : 'outline'"
                        size="sm"
                      >
                        <PenTool class="h-4 w-4 mr-2" />
                        {{ isDrawingMode ? 'Deaktivieren' : 'Aktivieren' }}
                      </Button>
                    </div>
                    <p class="text-sm text-blue-700">
                      {{ isDrawingMode 
                        ? '✏️ Zeichenmodus aktiv - Klicken Sie auf die Karte, um eine Linie zu zeichnen.' 
                        : '📍 Aktivieren Sie den Zeichenmodus, um Schnittlinien zu erstellen.' 
                      }}
                    </p>
                  </div>

                  <!-- Drawn Lines List -->
                  <div class="flex-1">
                    <div class="flex items-center justify-between mb-4">
                      <Label class="text-sm font-medium">Gezeichnete Linien ({{ drawnLines.length }})</Label>
                      <Button 
                        v-if="drawnLines.length > 0" 
                        @click="clearAllLines" 
                        variant="outline" 
                        size="sm"
                      >
                        <Trash2 class="h-4 w-4 mr-2" />
                        Alle löschen
                      </Button>
                    </div>

                    <div v-if="drawnLines.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
                      <div 
                        v-for="line in drawnLines" 
                        :key="line.id" 
                        class="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg"
                      >
                        <div class="flex-1">
                          <div class="flex items-center gap-2 mb-1">
                            <Badge variant="outline" class="font-mono text-xs">{{ line.id.substring(0, 8) }}...</Badge>
                            <Badge :variant="line.processed ? 'default' : 'secondary'">
                              {{ line.processed ? 'Verarbeitet' : 'Ausstehend' }}
                            </Badge>
                          </div>
                          <p class="text-xs text-gray-600">
                            Erstellt: {{ new Date(line.createdAt).toLocaleString('de-DE') }}
                          </p>
                          <p v-if="line.processedAt" class="text-xs text-green-600">
                            Verarbeitet: {{ new Date(line.processedAt).toLocaleString('de-DE') }}
                          </p>
                        </div>
                        
                        <div class="flex gap-1">
                          <Button 
                            v-if="!line.processed"
                            @click="processLineFor3DCutting(line)" 
                            :disabled="isProcessingLine && selectedLine?.id === line.id"
                            size="sm"
                            variant="default"
                          >
                            <Play v-if="!(isProcessingLine && selectedLine?.id === line.id)" class="h-3 w-3 mr-1" />
                            <Loader2 v-else class="h-3 w-3 mr-1 animate-spin" />
                            {{ isProcessingLine && selectedLine?.id === line.id ? 'Verarbeitung...' : 'Verarbeiten' }}
                          </Button>
                          
                          <Button 
                            @click="deleteLine(line.id)" 
                            size="sm" 
                            variant="outline"
                            class="text-red-600 hover:text-red-700"
                          >
                            <Trash2 class="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div v-else class="text-center text-gray-400 py-12">
                      <Square class="mx-auto h-12 w-12 mb-4" />
                      <h3 class="text-lg font-medium text-gray-900 mb-2">Keine Linien gezeichnet</h3>
                      <p class="text-gray-600">
                        Aktivieren Sie den Zeichenmodus und zeichnen Sie eine Linie auf dem Gebäudegrundriss.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <!-- Right: Map Card (same as GMLID tab) -->
              <Card class="h-full flex flex-col">
                <ArcGIS2DMapViewer 
                  ref="lineDrawingMapRef"
                  :geometry-data="geometryData"
                  :is-loading="isLoadingGeometry"
                  :portal-items="selectedPortalItem ? [selectedPortalItem] : []"
                  :drawing-mode="isDrawingMode"
                  @feature-selected="handleFeatureSelected"
                  @line-drawn="handleLineDrawn"
                />
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Welcome State -->
      <div v-if="!buildingData && !isSearching && !searchError" class="text-center py-12">
        <div class="mx-auto max-w-md">
          <Building class="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 class="text-lg font-medium text-gray-900 mb-2">Kein Gebäude ausgewählt</h3>
          <p class="text-gray-600">
            Suchen Sie nach einem Gebäude anhand seiner GEBID, um die GMLID-Zuordnungen zu verwalten.
          </p>
        </div>
      </div>

      <!-- Delete Confirmation Dialog -->
      <AlertDialog :open="isDeleteDialogOpen" @update:open="isDeleteDialogOpen = $event">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>GMLID-Zuordnung löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie die GMLID-Zuordnung "{{ deletingGmlid }}" löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="closeDeleteDialog">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              @click="confirmDelete"
              class="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>
