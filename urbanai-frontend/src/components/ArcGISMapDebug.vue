<template>
  <div class="p-4">
    <h2 class="text-xl font-bold mb-4">ArcGIS Map Debug</h2>
    
    <!-- Debug Info -->
    <div class="mb-4 p-2 bg-gray-100 rounded text-sm">
      <div>🔍 Debug Info:</div>
      <div>- ArcGIS SDK Available: {{ arcgisSdkAvailable ? 'Yes' : 'No' }}</div>
      <div>- Authentication Status: {{ isAuthenticated ? 'Authenticated' : 'Not Authenticated' }}</div>
      <div>- Map Container: {{ mapContainer ? 'Available' : 'Not Available' }}</div>
      <div>- Map View: {{ mapView ? 'Created' : 'Not Created' }}</div>
      <div>- Error: {{ error || 'None' }}</div>
    </div>
    
    <!-- Auth Status -->
    <div class="mb-4">
      <button 
        v-if="!isAuthenticated"
        @click="login" 
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Sign In to ArcGIS
      </button>
      <div v-else class="text-green-600">✅ Authenticated</div>
    </div>
    
    <!-- Test Map -->
    <div class="border-2 border-dashed border-gray-300 h-96 relative">
      <div 
        ref="mapContainer" 
        class="w-full h-full bg-gray-50"
        id="debug-map-view"
      >
        <div class="flex items-center justify-center h-full text-gray-500">
          Map Container Ready
        </div>
      </div>
    </div>
    
    <!-- Test Button -->
    <button 
      @click="testMapCreation" 
      class="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
    >
      Test Map Creation
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'

// Auth composable
const { isAuthenticated, login, initializeArcGISModules } = useAuth()

// State
const mapContainer = ref<HTMLDivElement | null>(null)
const error = ref<string>('')
const mapView = ref<any>(null)

// Computed
const arcgisSdkAvailable = computed(() => {
  return !!(window as any).$arcgis
})

// Test map creation
const testMapCreation = async () => {
  error.value = ''
  
  try {
    console.log('🧪 Testing map creation...')
    
    if (!mapContainer.value) {
      throw new Error('Map container not available')
    }
    
    if (!(window as any).$arcgis) {
      throw new Error('ArcGIS SDK not available')
    }
    
    // Initialize modules
    await initializeArcGISModules()
    
    // Load required modules
    const [Map, MapView] = await (window as any).$arcgis.import([
      "@arcgis/core/Map.js",
      "@arcgis/core/views/MapView.js"
    ])
    
    console.log('✅ ArcGIS modules loaded')
    
    // Create simple map
    const map = new Map({
      basemap: "streets-vector"
    })
    
    console.log('✅ Map created')
    
    // Create map view
    const view = new MapView({
      container: mapContainer.value,
      map: map,
      center: [11.5820, 48.1351], // Munich
      zoom: 10
    })
    
    console.log('✅ MapView created')
    
    // Wait for view to be ready
    await view.when()
    console.log('✅ MapView is ready!')
    
    mapView.value = view
    
  } catch (err) {
    console.error('❌ Map creation test failed:', err)
    error.value = err instanceof Error ? err.message : 'Unknown error'
  }
}

onMounted(() => {
  console.log('🧪 Map debug component mounted')
  console.log('- ArcGIS SDK:', (window as any).$arcgis ? 'Available' : 'Not Available')
  console.log('- Map Container:', mapContainer.value)
})
</script>
