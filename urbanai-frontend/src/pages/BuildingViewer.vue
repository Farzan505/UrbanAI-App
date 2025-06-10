<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import ArcGISSceneViewer from '@/components/map/ArcGISSceneViewer.vue'

// Router
const route = useRoute()
const router = useRouter()

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

// Search for building by GEBID
const searchBuilding = async (gebidToSearch: string) => {
  if (!gebidToSearch) {
    searchError.value = 'Please enter a GEBID'
    return
  }

  isSearching.value = true
  searchError.value = ''
  showViewer.value = false

  try {
    const response = await fetch(
      `${apiBaseUrl.value}/api/database/get_building_data/${encodeURIComponent(gebidToSearch)}`
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseData: BuildingDataResponse = await response.json()
    console.log('Building data response:', responseData)
    console.log('Response data keys:', Object.keys(responseData.data || {}))
    console.log('Buildings assumptions:', responseData.data?.buildings_assumptions)
    console.log('GML mapping:', responseData.data?.gmlid_gebid_mapping)

    // Check if the response is successful and has data
    if (responseData.status === 'success' && responseData.data) {
      const { data } = responseData
      
      // Store building data for display
      buildingData.value = data
      console.log('Stored buildingData:', buildingData.value)
      console.log('Building assumptions in stored data:', buildingData.value?.buildings_assumptions)
      
      // Extract GML IDs from the nested data structure
      if (data.gmlid_gebid_mapping && data.gmlid_gebid_mapping.length > 0) {
        currentGmlIds.value = data.gmlid_gebid_mapping.map(item => item.gmlid)
        console.log('Found GML IDs:', currentGmlIds.value)
        
        // Show the viewer immediately (each card will handle its own loading)
        showViewer.value = true
        
        // Fetch geometry data for the GML IDs (non-blocking)
        fetchGeometry(currentGmlIds.value)
      } else {
        searchError.value = 'No GML ID mapping found for this GEBID'
      }
    } else {
      searchError.value = `API returned status: ${responseData.status || 'unknown'}`
    }

  } catch (err) {
    searchError.value = `Search failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Search error:', err)
  } finally {
    isSearching.value = false
  }
}

// Watch for route changes
watch(() => route.params.gebid, (newGebid) => {
  if (newGebid && typeof newGebid === 'string') {
    searchBuilding(newGebid)
  }
}, { immediate: true })

// Initialize from props or route
onMounted(() => {
  const initialGebid = props.gebid || route.params.gebid
  if (initialGebid && typeof initialGebid === 'string') {
    searchBuilding(initialGebid)
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
</script>

<template>
  <div class="h-full bg-gray-50">
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
            <Card class="w-full h-[600px]">
              <CardHeader>
                <CardTitle>Gebäudeinformationen</CardTitle>
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
                  <!-- Debug info -->
                  <div class="mb-4 p-2 bg-blue-50 rounded text-xs">
                    <p>Debug: buildingData exists: {{ !!buildingData }}</p>
                    <p>Debug: buildings_assumptions exists: {{ !!buildingData?.buildings_assumptions }}</p>
                    <p v-if="buildingData?.buildings_assumptions">
                      Debug: GEBID: {{ buildingData.buildings_assumptions.gebid }}
                    </p>
                    <p>Debug: Keys in buildingData: {{ buildingData ? Object.keys(buildingData) : 'none' }}</p>
                    <p v-if="buildingData?.buildings_assumptions">
                      Debug: Keys in buildings_assumptions: {{ Object.keys(buildingData.buildings_assumptions) }}
                    </p>
                  </div>
                  
                  <Accordion type="single" collapsible class="w-full" default-value="building-info">
                    <!-- Building Assumptions -->
                    <AccordionItem value="building-info">
                      <AccordionTrigger>Gebäude Grunddaten</AccordionTrigger>
                      <AccordionContent>
                        <div v-if="buildingData?.buildings_assumptions" class="space-y-3">
                          <div class="grid grid-cols-1 gap-2 text-sm">
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">GEBID:</span>
                              <span class="text-gray-900">{{ buildingData.buildings_assumptions.gebid }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">EPL:</span>
                              <span class="text-gray-900">{{ buildingData.buildings_assumptions.epl || 'N/A' }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">BABEZ:</span>
                              <span class="text-gray-900">{{ buildingData.buildings_assumptions.babez || 'N/A' }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">LIGBEZ:</span>
                              <span class="text-gray-900 text-right">{{ buildingData.buildings_assumptions.ligbez || 'N/A' }}</span>
                            </div>
                            <div class="flex justify-between">
                              <span class="font-medium text-gray-600">GEBZABT:</span>
                              <span class="text-gray-900">{{ buildingData.buildings_assumptions.gebzabt || 'N/A' }}</span>
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
                  </Accordion>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- 3D Scene Viewer -->
          <div class="lg:col-span-1">
            <Card class="w-full h-[600px]">
              <CardHeader>
                <CardTitle>Gebäudevisualisierung</CardTitle>
                <CardDescription v-if="geometryLoading" class="text-sm text-muted-foreground">
                  Geometriedaten werden geladen...
                </CardDescription>
              </CardHeader>
              <CardContent class="p-0 h-full">
                <!-- Loading state for geometry visualization -->
                <div v-if="geometryLoading" class="h-full flex items-center justify-center">
                  <div class="space-y-4 w-full max-w-sm mx-auto p-4">
                    <Skeleton class="h-8 w-3/4 mx-auto" />
                    <Skeleton class="h-64 w-full" />
                    <div class="space-y-2">
                      <Skeleton class="h-4 w-full" />
                      <Skeleton class="h-4 w-5/6" />
                      <Skeleton class="h-4 w-4/6" />
                    </div>
                  </div>
                </div>
                
                <!-- 3D Viewer content -->
                <div v-else class="h-full relative">
                  <ArcGISSceneViewer 
                    :gml-ids="currentGmlIds"
                    :api-base-url="apiBaseUrl"
                    :geometry-data="geometryData"
                    :geometry-loading="geometryLoading"
                    class="w-full h-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style> 