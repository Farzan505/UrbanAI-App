<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import ArcGISSceneViewer from '@/components/map/ArcGISSceneViewer.vue'

// Reactive variables
const gebidSearch = ref('')
const isSearching = ref(false)
const searchError = ref('')
const currentGmlIds = ref<string[]>([])
const showViewer = ref(false)
const apiBaseUrl = ref('http://localhost:8080')

// Interface for the API response
interface BuildingDataResponse {
  gebid: string
  include_gml_mapping: boolean
  status: string
  data: {
    building_assumptions: any
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
const searchBuilding = async () => {
  if (!gebidSearch.value.trim()) {
    searchError.value = 'Please enter a GEBID'
    return
  }

  isSearching.value = true
  searchError.value = ''
  showViewer.value = false

  try {
    const response = await fetch(
      `${apiBaseUrl.value}/api/database/get_building_data/${encodeURIComponent(gebidSearch.value.trim())}`
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseData: BuildingDataResponse = await response.json()
    console.log('Building data response:', responseData)

    // Check if the response is successful and has data
    if (responseData.status === 'success' && responseData.data) {
      const { data } = responseData
      
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

// Handle Enter key in search input
const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    searchBuilding()
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with Search -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-gray-900">UrbanAI Building Viewer</h1>
          </div>
          
          <!-- Search Section -->
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <label for="gebid-search" class="text-sm font-medium text-gray-700 whitespace-nowrap">
                Search GEBID:
              </label>
              <Input
                id="gebid-search"
                v-model="gebidSearch"
                type="text"
                placeholder="e.g., 30100 2000 001 001"
                class="w-64"
                @keydown="handleSearchKeydown"
                :disabled="isSearching"
              />
              <Button 
                @click="searchBuilding" 
                :disabled="isSearching || !gebidSearch.trim()"
                class="whitespace-nowrap"
              >
                {{ isSearching ? 'Searching...' : 'Search' }}
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
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Welcome State -->
      <div v-if="!showViewer && !isSearching" class="text-center py-12">
        <div class="mx-auto max-w-md">
          <div class="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H7m10 0v-2a2 2 0 00-2-2H9a2 2 0 00-2 2v2m10-10V7a2 2 0 00-2-2H9a2 2 0 00-2 2v4m2 4h.01"/>
            </svg>
          </div>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No building selected</h3>
          <p class="mt-1 text-sm text-gray-500">
            Search for a building using its GEBID to view the 3D visualization
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

      <!-- 3D Viewer -->
      <div v-if="showViewer && !isSearching" class="w-full">
        <Card class="w-full">
          <CardHeader>
            <CardTitle class="flex items-center justify-between">
              <span>3D Building Visualization</span>
              <div class="text-sm font-normal text-gray-500">
                GEBID: {{ gebidSearch }}
              </div>
            </CardTitle>
            <CardDescription>
              Found {{ currentGmlIds.length }} building part{{ currentGmlIds.length > 1 ? 's' : '' }} 
              (GML ID{{ currentGmlIds.length > 1 ? 's' : '' }}: {{ currentGmlIds.join(', ') }})
            </CardDescription>
          </CardHeader>
          <CardContent class="p-0">
            <div class="h-[600px] relative">
              <ArcGISSceneViewer 
                :gml-ids="currentGmlIds"
                :api-base-url="apiBaseUrl"
                class="w-full h-full"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>
