<template>
  <div class="flex flex-col gap-4">
    <div class="w-full">
      <div class="py-2 border-b">

        <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
      </div>
      <div class="p-0 h-[600px]">
        <div v-if="isLoading" class="w-full h-full">
          <Skeleton class="h-full w-full shadow-none" />
        </div>
        <div v-else ref="mapContainer" id="viewDiv" class="w-full h-full">
          <!-- Map UI components can be added here if needed -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, nextTick, onUnmounted } from 'vue'
import { Skeleton } from '../ui/skeleton'
import { useAuth } from '@/composables/useAuth'

// Props
interface Props {
  geometryData?: any
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  geometryData: null,
  isLoading: false
})

// State
const mapContainer = ref<HTMLDivElement | null>(null)
const error = ref<string>('')
let mapView: any = null
let map: any = null
let districtFeatureLayer: any = null
let citygmlFeatureLayer: any = null

// Authentication
const { checkAuthStatus, getToken, isAuthenticated, login } = useAuth()

// Environment variables (only need service URLs now)
const ARCGIS_FEATURE_LAYER_ID = import.meta.env.VITE_ARCGIS_FEATURE_LAYER_ID
const ARCGIS_FEATURE_SERVICE_URL = import.meta.env.VITE_ARCGIS_FEATURE_SERVICE_URL

// Load ArcGIS CSS
const loadArcgisCss = () => {
  if (document.querySelector('link[href*="arcgis-js-api"]')) return
  
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://js.arcgis.com/4.33/esri/themes/light/main.css'
  document.head.appendChild(link)
}

// Initialize ArcGIS map
const initializeMap = async () => {
  if (!mapContainer.value) return
  loadArcgisCss()

  try {
    console.log('🔄 Loading ArcGIS modules...')
    
    // Import modules with better error handling
    const [MapModule, MapViewModule, GeoJSONLayerModule, FeatureLayerModule, IdentityManagerModule] = await Promise.all([
      import('@arcgis/core/Map').catch(err => {
        console.error('Failed to load Map module:', err)
        throw err
      }),
      import('@arcgis/core/views/MapView').catch(err => {
        console.error('Failed to load MapView module:', err)
        throw err
      }),
      import('@arcgis/core/layers/GeoJSONLayer').catch(err => {
        console.error('Failed to load GeoJSONLayer module:', err)
        throw err
      }),
      import('@arcgis/core/layers/FeatureLayer').catch(err => {
        console.error('Failed to load FeatureLayer module:', err)
        throw err
      }),
      import('@arcgis/core/identity/IdentityManager').catch(err => {
        console.error('Failed to load IdentityManager module:', err)
        throw err
      })
    ])

    const Map = MapModule.default
    const MapView = MapViewModule.default
    const GeoJSONLayer = GeoJSONLayerModule.default
    const FeatureLayer = FeatureLayerModule.default
    const esriId = IdentityManagerModule.default

    console.log('✅ ArcGIS modules loaded successfully')

    // Check authentication status with backend
    const authStatus = await checkAuthStatus()
    console.log('🔐 Backend auth status:', authStatus)

    // If authenticated, get the token from backend
    let accessToken = null
    if (authStatus.authenticated) {
      const tokenResponse = await getToken()
      if (tokenResponse) {
        accessToken = tokenResponse.access_token
        console.log('✅ Got access token from backend')
        
        // Set the token in ArcGIS Identity Manager for authenticated requests
        esriId.registerToken({
          server: 'https://gisportal-stmb.bayern.de',
          token: accessToken,
          expires: Date.now() + (tokenResponse.expires_in * 1000)
        })
      }
    } else {
      console.log('🔑 Not authenticated with backend, some layers may not be accessible')
    }

    // Remove previous view if any
    if (mapView) {
      mapView.destroy()
      mapView = null
    }

    // Create district feature layer with authentication handling
    // Use proxy URL during development to avoid CORS issues
    const serviceUrl = import.meta.env.DEV 
      ? "/gisportal/server/rest/services/Hosted/citygml_data/FeatureServer/0"
      : "https://gisportal-stmb.bayern.de/server/rest/services/Hosted/citygml_data/FeatureServer/0"
    
    districtFeatureLayer = new FeatureLayer({
      url: serviceUrl,
      visible: false, // Initially hidden
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [255, 128, 0, 0.3], // Orange with transparency
          outline: {
            color: [255, 128, 0, 1],
            width: 2
          }
        }
      },
      popupTemplate: {
        title: "District Information",
        content: "District: {*}"
      }
    })

    // Create CityGML feature layer using the specific layer ID
    const citygmlServiceUrl = import.meta.env.DEV 
      ? `/gisportal/server/rest/services/Hosted/citygml_data/FeatureServer`
      : ARCGIS_FEATURE_SERVICE_URL

    citygmlFeatureLayer = new FeatureLayer({
      url: citygmlServiceUrl,
      layerId: ARCGIS_FEATURE_LAYER_ID ? parseInt(ARCGIS_FEATURE_LAYER_ID) : 0,
      visible: true, // Make it visible by default
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [0, 122, 194, 0.4], // Blue with transparency
          outline: {
            color: [0, 122, 194, 1],
            width: 1.5
          }
        }
      },
      popupTemplate: {
        title: "CityGML Building",
        content: [
          {
            type: "fields",
            fieldInfos: [
              {
                fieldName: "gmlid",
                label: "GML ID"
              },
              {
                fieldName: "function",
                label: "Function"
              },
              {
                fieldName: "usage",
                label: "Usage"
              },
              {
                fieldName: "yearOfConstruction",
                label: "Year of Construction"
              },
              {
                fieldName: "storeysAboveGround",
                label: "Storeys Above Ground"
              },
              {
                fieldName: "storeysBelowGround",
                label: "Storeys Below Ground"
              }
            ]
          }
        ]
      },
      outFields: ["*"] // Fetch all fields for popup
    })

    // Create map with both feature layers
    map = new Map({
      basemap: "gray-vector",
      layers: [districtFeatureLayer, citygmlFeatureLayer]
    })

    // Add error handling for the district layer with authentication
    districtFeatureLayer.when(() => {
      console.log('✅ District feature layer loaded successfully')
    }).catch(async (err: any) => {
      console.warn('⚠️ District feature layer failed to load:', err)
      
      // If it's an authentication error, redirect to backend login
      if (err.details && err.details.httpStatus === 401) {
        console.log('🔑 Authentication required for district layer')
        if (!isAuthenticated.value) {
          console.log('🔄 Redirecting to backend login...')
          await login()
        } else {
          console.log('❌ Already authenticated but still getting 401, removing layer')
          if (map.layers.includes(districtFeatureLayer)) {
            map.remove(districtFeatureLayer)
          }
        }
      } else {
        // For other errors, just remove the layer
        console.error('❌ District layer error (non-auth):', err)
        if (map.layers.includes(districtFeatureLayer)) {
          map.remove(districtFeatureLayer)
        }
      }
    })

    // Add error handling for the CityGML feature layer with authentication
    citygmlFeatureLayer.when(() => {
      console.log('✅ CityGML feature layer loaded successfully')
    }).catch(async (err: any) => {
      console.warn('⚠️ CityGML feature layer failed to load:', err)
      
      // If it's an authentication error, redirect to backend login
      if (err.details && err.details.httpStatus === 401) {
        console.log('🔑 Authentication required for CityGML layer')
        if (!isAuthenticated.value) {
          console.log('🔄 Redirecting to backend login...')
          await login()
        } else {
          console.log('❌ Already authenticated but still getting 401, removing layer')
          if (map.layers.includes(citygmlFeatureLayer)) {
            map.remove(citygmlFeatureLayer)
          }
        }
      } else {
        // For other errors, just remove the layer
        console.error('❌ CityGML layer error (non-auth):', err)
        if (map.layers.includes(citygmlFeatureLayer)) {
          map.remove(citygmlFeatureLayer)
        }
      }
    })

    // Create map view
    mapView = new MapView({
      container: mapContainer.value,
      map: map,
      center: [11.5820, 48.1351], // Munich coordinates
      zoom: 12,
      constraints: {
        minZoom: 8,
        maxZoom: 20
      }
    })

    // Watch for zoom level changes to show/hide district layer
    mapView.watch("zoom", (zoom: number) => {
      const shouldShowDistrict = zoom >= 10 && zoom <= 14 // District level zoom range
      if (districtFeatureLayer) {
        districtFeatureLayer.visible = shouldShowDistrict
        console.log(`🔍 Zoom level: ${zoom}, District layer visible: ${shouldShowDistrict}`)
      }
    })

    // Wait for the view to be fully ready
    await mapView.when()
    console.log('✅ MapView is ready')

    // Add small delay to ensure all initialization is complete
    await new Promise(resolve => setTimeout(resolve, 200))

    // Add geometry layer if data exists
    if (props.geometryData) {
      await addGeometryLayer(GeoJSONLayer)
    }

    console.log('✅ ArcGIS 2D Map initialized successfully')

  } catch (err) {
    console.error('❌ Error initializing ArcGIS 2D map:', err)
    error.value = `Map initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// Add geometry layer to map
const addGeometryLayer = async (GeoJSONLayer: any) => {
  try {
    if (!props.geometryData || !mapView) return

    console.log('🗺️ Adding geometry data to 2D map:', props.geometryData)

    // Convert geometry data to GeoJSON blob URL
    const geojsonBlob = new Blob([JSON.stringify(props.geometryData)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(geojsonBlob)

    // Create GeoJSON layer
    const geoJSONLayer = new GeoJSONLayer({
      url: url,
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-fill",
          color: [51, 51, 204, 0.6],
          outline: {
            color: "white",
            width: 1
          }
        }
      },
      popupTemplate: {
        title: "Building",
        content: "GML ID: {gmlid}"
      }
    })

    // Add layer to map
    map.add(geoJSONLayer)

    // Wait for both layer and view to be ready before zooming
    await Promise.all([
      geoJSONLayer.when(),
      mapView.when()
    ])

    console.log('✅ GeoJSON layer loaded successfully')
    
    // Add a small delay to ensure the animation manager is ready
    setTimeout(async () => {
      try {
        if (geoJSONLayer.fullExtent && mapView.ready) {
          await mapView.goTo(geoJSONLayer.fullExtent, {
            animate: false // Disable animation to avoid timing issues
          })
          console.log('✅ Zoomed to layer extent successfully')
        }
      } catch (zoomErr) {
        console.warn('⚠️ Could not zoom to layer extent:', zoomErr)
        // Fallback: try simple center/zoom approach
        try {
          const center = geoJSONLayer.fullExtent?.center
          if (center) {
            await mapView.goTo({
              center: center,
              zoom: 16
            }, { animate: false })
            console.log('✅ Fallback zoom to center successful')
          }
        } catch (fallbackErr) {
          console.warn('⚠️ Fallback zoom also failed:', fallbackErr)
        }
      }
    }, 500)

    // Clean up blob URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 2000)

  } catch (err) {
    console.error('❌ Error adding geometry layer:', err)
    error.value = `Failed to add geometry: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// Update geometry when prop changes
const updateGeometry = async () => {
  if (!mapView || !map) {
    console.log('⚠️ Map not ready for geometry update')
    return
  }

  try {
    // Remove existing geometry layers
    const layersToRemove = map.layers.filter((layer: any) => 
      layer.type === 'geojson'
    )
    layersToRemove.forEach((layer: any) => map.remove(layer))

    // Add new geometry if available
    if (props.geometryData) {
      const GeoJSONLayer = (await import('@arcgis/core/layers/GeoJSONLayer')).default
      await addGeometryLayer(GeoJSONLayer)
    }
  } catch (err) {
    console.error('❌ Error updating geometry:', err)
    error.value = `Failed to update geometry: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// Watch for geometry data changes
watch(() => props.geometryData, async (newData) => {
  console.log('👀 Geometry data changed in 2D map:', { hasData: !!newData })
  
  if (mapView && map) {
    await updateGeometry()
  } else {
    console.log('⚠️ Map not ready, will update when initialized')
  }
}, { deep: true })

// Initialize map on mount
onMounted(async () => {
  console.log('🚀 ArcGIS2DMapViewer mounted')
  
  // Wait for next tick to ensure DOM is ready
  await nextTick()
  
  // Add retry mechanism for map initialization
  let retryCount = 0
  const maxRetries = 3
  
  while (retryCount < maxRetries) {
    try {
      await initializeMap()
      break
    } catch (err) {
      retryCount++
      console.error(`❌ Map initialization attempt ${retryCount} failed:`, err)
      
      if (retryCount >= maxRetries) {
        error.value = `Map initialization failed after ${maxRetries} attempts`
      } else {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
      }
    }
  }
})

// Cleanup on unmount
onUnmounted(() => {
  console.log('🧹 Cleaning up ArcGIS2DMapViewer')
  
  if (mapView) {
    mapView.destroy()
    mapView = null
  }
  
  if (districtFeatureLayer) {
    districtFeatureLayer.destroy()
    districtFeatureLayer = null
  }
  
  if (citygmlFeatureLayer) {
    citygmlFeatureLayer.destroy()
    citygmlFeatureLayer = null
  }
  
  map = null
})
</script>

<style>
#viewDiv {
  padding: 0;
  margin: 0;
  height: 100%;
  width: 100%;
}

.esri-view .esri-view-surface--touch-none:focus::after {
  outline: none !important;
}

.esri-view *:focus {
  outline: none !important;
}

.esri-widget *:focus {
  outline: none !important;
}

.esri-view-surface--inset-outline {
  outline: none !important;
}
</style>
