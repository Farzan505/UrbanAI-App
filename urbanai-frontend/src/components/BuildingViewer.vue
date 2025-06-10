<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
const gebidSearch = ref('')
const isSearching = ref(false)
const searchError = ref('')
const currentGmlIds = ref<string[]>([])
const showViewer = ref(false)
const apiBaseUrl = ref('http://localhost:8080')
const buildingData = ref<any>(null)

// Interface for the API response
interface BuildingDataResponse {
  gebid: string
  include_gml_mapping: boolean
  status: string
  data: {
    building_assumptions: {
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

// Search for building by GEBID
const searchBuilding = async (gebidToSearch?: string) => {
  // Always use the input value if no specific GEBID is provided
  const searchValue = gebidToSearch || gebidSearch.value.trim()
  
  if (!searchValue) {
    searchError.value = 'Please enter a GEBID'
    return
  }

  // Update URL
  if (searchValue !== route.params.gebid) {
    await router.push(`/gebid=${searchValue}`)
  }

  isSearching.value = true
  searchError.value = ''
  showViewer.value = false

  try {
    const response = await fetch(
      `${apiBaseUrl.value}/api/database/get_building_data/${encodeURIComponent(searchValue)}`
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseData: BuildingDataResponse = await response.json()
    console.log('Building data response:', responseData)

    // Check if the response is successful and has data
    if (responseData.status === 'success' && responseData.data) {
      const { data } = responseData
      
      // Store building data for display
      buildingData.value = data
      
      // Extract GML IDs from the nested data structure
      if (data.gmlid_gebid_mapping && data.gmlid_gebid_mapping.length > 0) {
        currentGmlIds.value = data.gmlid_gebid_mapping.map(item => item.gmlid)
        console.log('Found GML IDs:', currentGmlIds.value)
        
        // Show the viewer
        showViewer.value = true
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

// Handle button click - don't pass any parameters
const handleSearchClick = () => {
  searchBuilding()
}

// Handle Enter key in search input
const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    searchBuilding()
  }
}

// Watch for route changes
watch(() => route.params.gebid, (newGebid) => {
  if (newGebid && typeof newGebid === 'string') {
    gebidSearch.value = newGebid
    searchBuilding(newGebid)
  }
}, { immediate: true })

// Initialize from props or route
onMounted(() => {
  const initialGebid = props.gebid || route.params.gebid
  if (initialGebid && typeof initialGebid === 'string') {
    gebidSearch.value = initialGebid
    searchBuilding(initialGebid)
  }
})
</script>

<template>
  <div class="h-full bg-gray-50">
    <!-- Search Section -->
    <div class="bg-white border-b border-gray-200 shadow-sm">
      <div class="w-full px-4 sm:px-6 lg:px-8">
        <div class="flex justify-end items-center py-4">
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <Input
                id="gebid-search"
                v-model="gebidSearch"
                type="text"
                placeholder="Gebäude Nr. eingeben"
                class="w-64"
                @keydown="handleSearchKeydown"
                :disabled="isSearching"
              />
              <Button 
                @click="handleSearchClick" 
                :disabled="isSearching || !gebidSearch.trim()"
                class="whitespace-nowrap"
              >
                {{ isSearching ? 'Searching...' : 'Suchen' }}
              </Button>
            </div>
          </div>
        </div>
        
        <!-- Error Message -->
        <div v-if="searchError" class="pb-4">
          <div class="bg-red-50 border border-red-200 rounded-md p-3">
            <p class="text-sm text-red-600">{{ searchError }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <main class="w-full px-4 sm:px-6 lg:px-8 py-8 h-full overflow-auto">
      <!-- Welcome State -->
      <div v-if="!showViewer && !isSearching" class="text-center py-12">
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
        <Card class="w-full">
          <CardHeader>
            <CardTitle class="flex items-center space-x-2">
              <Skeleton class="h-6 w-48" />
            </CardTitle>
            <CardDescription>
              <Skeleton class="h-4 w-32" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <Skeleton class="h-8 w-full" />
              <Skeleton class="h-96 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 3D Viewer and Building Info -->
      <div v-if="showViewer && !isSearching" class="w-full">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Building Information -->
          <div class="lg:col-span-1">
            <Card class="w-full h-[600px]">
              <CardHeader>
                <CardTitle>Gebäudeinformationen</CardTitle>
              </CardHeader>
              <CardContent class="h-full overflow-y-auto">
                <!-- Debug info -->
                <div class="mb-4 p-2 bg-blue-50 rounded text-xs">
                  <p>Debug: buildingData exists: {{ !!buildingData }}</p>
                  <p>Debug: building_assumptions exists: {{ !!buildingData?.building_assumptions }}</p>
                  <p v-if="buildingData?.building_assumptions">
                    Debug: GEBID: {{ buildingData.building_assumptions.gebid }}
                  </p>
                </div>
                
                <Accordion type="single" collapsible class="w-full" default-value="building-info">
                  <!-- Building Assumptions -->
                  <AccordionItem value="building-info">
                    <AccordionTrigger>Gebäude Grunddaten</AccordionTrigger>
                    <AccordionContent>
                      <div v-if="buildingData?.building_assumptions" class="space-y-3">
                        <div class="grid grid-cols-1 gap-2 text-sm">
                          <div class="flex justify-between">
                            <span class="font-medium text-gray-600">GEBID:</span>
                            <span class="text-gray-900">{{ buildingData.building_assumptions.gebid }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="font-medium text-gray-600">EPL:</span>
                            <span class="text-gray-900">{{ buildingData.building_assumptions.epl || 'N/A' }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="font-medium text-gray-600">BABEZ:</span>
                            <span class="text-gray-900">{{ buildingData.building_assumptions.babez || 'N/A' }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="font-medium text-gray-600">LIGBEZ:</span>
                            <span class="text-gray-900 text-right">{{ buildingData.building_assumptions.ligbez || 'N/A' }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="font-medium text-gray-600">GEBZABT:</span>
                            <span class="text-gray-900">{{ buildingData.building_assumptions.gebzabt || 'N/A' }}</span>
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
              </CardContent>
            </Card>
          </div>

          <!-- 3D Scene Viewer -->
          <div class="lg:col-span-1">
            <Card class="w-full h-[600px]">
              <CardHeader>
                <CardTitle>Gebäudevisualisierung</CardTitle>
              </CardHeader>
              <CardContent class="p-0 h-full">
                <div class="h-full relative">
                  <ArcGISSceneViewer 
                    :gml-ids="currentGmlIds"
                    :api-base-url="apiBaseUrl"
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