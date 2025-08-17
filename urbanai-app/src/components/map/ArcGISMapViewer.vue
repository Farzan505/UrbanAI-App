<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Loader2 } from 'lucide-vue-next'

// Props
interface Props {
  geometryData?: any
  apiBaseUrl?: string
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  geometryData: null,
  apiBaseUrl: 'http://localhost:8080',
  isLoading: false
})

// Reactive variables
const mapContainer = ref<HTMLElement>()
const map = ref<any>(null)
const isLoadingMap = ref(false)
const mapError = ref('')

// Debug map container
watch(mapContainer, (newContainer) => {
  if (newContainer) {
    console.log('✅ Map container ref set:', newContainer)
    console.log('📏 Container dimensions:', {
      offsetWidth: newContainer.offsetWidth,
      offsetHeight: newContainer.offsetHeight,
      clientWidth: newContainer.clientWidth,
      clientHeight: newContainer.clientHeight
    })
  } else {
    console.log('❌ Map container ref cleared')
  }
})

// Initialize map
const initializeMap = async () => {
  if (!mapContainer.value) {
    console.log('❌ Map container not found')
    return
  }

  try {
    console.log('🗺️ Initializing map...')
    isLoadingMap.value = true
    mapError.value = ''

    // Dynamically import Leaflet
    const L = await import('leaflet')
    console.log('✅ Leaflet imported successfully')
    
    // Import Leaflet CSS
    await import('leaflet/dist/leaflet.css')
    console.log('✅ Leaflet CSS imported')

    // Create map
    map.value = L.map(mapContainer.value).setView([53.5511, 9.9937], 13) // Hamburg coordinates
    console.log('✅ Map created')

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.value)
    console.log('✅ Tiles added')

    // Add geometry data if available
    if (props.geometryData && props.geometryData.features) {
      console.log('📐 Adding geometry data:', props.geometryData)
      await addGeometryToMap(props.geometryData)
    } else {
      console.log('❌ No geometry data available')
    }

  } catch (err) {
    console.error('❌ Error initializing map:', err)
    mapError.value = 'Fehler beim Laden der Karte'
  } finally {
    isLoadingMap.value = false
    console.log('🏁 Map initialization completed')
  }
}

// Add geometry to map
const addGeometryToMap = async (geometryData: any) => {
  if (!map.value || !geometryData.features) {
    console.log('❌ Cannot add geometry: map or features not available')
    return
  }

  try {
    console.log('🗺️ Adding geometry to map...')
    const L = await import('leaflet')

    // Clear existing layers
    map.value.eachLayer((layer: any) => {
      if (layer instanceof L.GeoJSON) {
        map.value.removeLayer(layer)
      }
    })

    // Add GeoJSON layer
    const geoJsonLayer = L.geoJSON(geometryData, {
      style: {
        color: '#3b82f6',
        weight: 2,
        opacity: 0.8,
        fillColor: '#3b82f6',
        fillOpacity: 0.3
      },
      onEachFeature: (feature: any, layer: any) => {
        if (feature.properties) {
          const popupContent = `
            <div class="p-2">
              <h3 class="font-medium">GMLID: ${feature.properties.gmlid || 'N/A'}</h3>
              <p class="text-sm text-gray-600">GEBID: ${feature.properties.gebid || 'N/A'}</p>
            </div>
          `
          layer.bindPopup(popupContent)
        }
      }
    }).addTo(map.value)
    console.log('✅ GeoJSON layer added')

    // Fit map to geometry bounds
    if (geoJsonLayer.getBounds) {
      const bounds = geoJsonLayer.getBounds()
      if (!bounds.isEmpty()) {
        map.value.fitBounds(bounds, { padding: [20, 20] })
        console.log('✅ Map fitted to bounds')
      } else {
        console.log('⚠️ Empty bounds, not fitting map')
      }
    }

  } catch (err) {
    console.error('❌ Error adding geometry to map:', err)
    mapError.value = 'Fehler beim Laden der Geometriedaten'
  }
}

// Watch for geometry data changes
watch(() => props.geometryData, (newGeometryData) => {
  if (map.value && newGeometryData) {
    nextTick(async () => {
      await addGeometryToMap(newGeometryData)
    })
  } else if (newGeometryData && !map.value && mapContainer.value) {
    // If we have geometry data but no map, try to initialize
    console.log('🔄 Geometry data received but no map, initializing...')
    initializeMap()
  }
}, { deep: true })

// Watch for loading state
watch(() => props.isLoading, (isLoading) => {
  if (isLoading) {
    isLoadingMap.value = true
  }
})

// Initialize map on mount
onMounted(() => {
  nextTick(() => {
    // Add a small delay to ensure DOM is fully rendered
    setTimeout(() => {
      if (mapContainer.value) {
        console.log('✅ Map container found, initializing map...')
        initializeMap()
      } else {
        console.log('❌ Map container still not found after delay')
        mapError.value = 'Map container nicht gefunden'
      }
    }, 100)
  })
})
</script>

<template>
  <div class="w-full h-full">
    <!-- Loading state -->
    <div v-if="isLoadingMap || isLoading" class="h-full flex items-center justify-center">
      <div class="text-center">
        <Loader2 class="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
        <p class="text-sm text-gray-600">Karte wird geladen...</p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="mapError" class="h-full flex items-center justify-center">
      <div class="text-center">
        <MapPin class="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p class="text-sm text-red-600">{{ mapError }}</p>
      </div>
    </div>

    <!-- Map container -->
    <div 
      v-else
      ref="mapContainer" 
      class="w-full h-full rounded-lg"
      style="min-height: 400px; height: 100%; width: 100%;"
    ></div>
  </div>
</template>

<style scoped>
/* Ensure map container has proper dimensions */
.leaflet-container {
  height: 100%;
  width: 100%;
}
</style> 