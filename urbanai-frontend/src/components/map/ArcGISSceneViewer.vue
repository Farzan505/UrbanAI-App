<template>
  <div class="scene-viewer-container">
    <!-- API Configuration Panel -->
    <div class="config-panel">
      <div class="config-content">
        <h3>API Configuration</h3>
        <div class="form-group">
          <label for="apiUrl">API Base URL:</label>
          <input 
            id="apiUrl" 
            v-model="apiBaseUrl" 
            type="text" 
            placeholder="http://localhost:8080"
            class="api-input"
          />
        </div>
        <div class="form-group">
          <label for="gmlId">GML ID:</label>
          <input 
            id="gmlId" 
            v-model="gmlId" 
            type="text" 
            placeholder="DEBY_LOD2_4907950"
            class="api-input"
          />
        </div>
        <Button @click="fetchGeometry" :disabled="loading" class="fetch-btn">
          {{ loading ? 'Loading...' : 'Load Geometry' }}
        </Button>
        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
    </div>

    <!-- ArcGIS Scene View Container -->
    <div id="viewDiv" class="map-container"></div>
    
    <!-- Feature Property Picker -->
    <div id="pickerContainer" class="picker-panel" style="display: none;">
      <div class="panel-content">
        <select v-model="selectedProperty" @change="onPropertyChange" class="property-select">
          <option value="">Select a property</option>
          <option v-for="prop in availableProperties" :key="prop" :value="prop">
            {{ prop }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Button } from '@/components/ui/button'

// Reactive variables
const apiBaseUrl = ref('http://localhost:8080')
const gmlId = ref('DEBY_LOD2_4907950')
const loading = ref(false)
const error = ref('')
const selectedProperty = ref('')
const availableProperties = ref<string[]>([])

// ArcGIS related variables
let view: any = null
let map: any = null
let esriModules: any = {}

// API Response interfaces
interface GeometryResponse {
  surfaces_adiabatic: any[]
  shading_surfaces: any[]
}

// Fetch geometry data from API
const fetchGeometry = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch(
      `${apiBaseUrl.value}/api/geometry/get_geometry?gmlids=${gmlId.value}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data: GeometryResponse = await response.json()
    console.log('API Response:', data)
    
    // Process the data for ArcGIS
    await processGeometryData(data)
    
  } catch (err) {
    error.value = `Failed to fetch geometry: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}

// Process geometry data and display in ArcGIS
const processGeometryData = async (data: GeometryResponse) => {
  if (!view || !map) {
    error.value = 'Map not initialized'
    return
  }

  const { FeatureLayer, Extent } = esriModules

  try {
    // Clear existing layers
    map.layers.removeAll()

    // Process adiabatic surfaces
    if (data.surfaces_adiabatic && data.surfaces_adiabatic.length > 0) {
      const adiabaticFeatures = data.surfaces_adiabatic.map((feature: any, index: number) => ({
        geometry: {
          type: "polygon",
          rings: feature.geometry.coordinates,
          spatialReference: { wkid: 4326 }
        },
        attributes: {
          ObjectID: index,
          ...feature.properties
        }
      }))

      // Get property names for picker
      if (data.surfaces_adiabatic[0]?.properties) {
        availableProperties.value = Object.keys(data.surfaces_adiabatic[0].properties)
        if (!selectedProperty.value && availableProperties.value.length > 0) {
          selectedProperty.value = availableProperties.value[0]
        }
      }

      // Create adiabatic surfaces layer
      const adiabaticLayer = new FeatureLayer({
        source: adiabaticFeatures,
        objectIdField: "ObjectID",
        title: "Adiabatic Surfaces",
        fields: [
          { name: "ObjectID", alias: "ObjectID", type: "oid" },
          ...Object.keys(data.surfaces_adiabatic[0]?.properties || {}).map((prop: string) => ({
            name: prop,
            alias: prop,
            type: "string"
          }))
        ],
        renderer: {
          type: "simple",
          symbol: {
            type: "polygon-3d",
            symbolLayers: [{
              type: "fill",
              material: { color: [255, 100, 100, 0.8] },
              outline: {
                color: [255, 255, 255, 0.7],
                size: "2px"
              }
            }]
          }
        },
        popupTemplate: {
          title: "Adiabatic Surface",
          content: [{
            type: "fields",
            fieldInfos: Object.keys(data.surfaces_adiabatic[0]?.properties || {}).map((prop: string) => ({
              fieldName: prop,
              label: prop
            }))
          }]
        }
      })

      map.add(adiabaticLayer)
    }

    // Process shading surfaces
    if (data.shading_surfaces && data.shading_surfaces.length > 0) {
      const shadingFeatures = data.shading_surfaces.map((feature: any, index: number) => ({
        geometry: {
          type: "polygon",
          rings: feature.geometry.coordinates,
          spatialReference: { wkid: 4326 }
        },
        attributes: {
          ObjectID: index + (data.surfaces_adiabatic?.length || 0),
          ...feature.properties
        }
      }))

      // Create shading surfaces layer
      const shadingLayer = new FeatureLayer({
        source: shadingFeatures,
        objectIdField: "ObjectID",
        title: "Shading Surfaces",
        fields: [
          { name: "ObjectID", alias: "ObjectID", type: "oid" },
          ...Object.keys(data.shading_surfaces[0]?.properties || {}).map((prop: string) => ({
            name: prop,
            alias: prop,
            type: "string"
          }))
        ],
        renderer: {
          type: "simple",
          symbol: {
            type: "polygon-3d",
            symbolLayers: [{
              type: "fill",
              material: { color: [128, 128, 128, 0.6] },
              outline: {
                color: [255, 255, 255, 0.7],
                size: "2px"
              }
            }]
          }
        },
        popupTemplate: {
          title: "Shading Surface",
          content: [{
            type: "fields",
            fieldInfos: Object.keys(data.shading_surfaces[0]?.properties || {}).map((prop: string) => ({
              fieldName: prop,
              label: prop
            }))
          }]
        }
      })

      map.add(shadingLayer)
    }

    // Calculate extent and zoom to data
    await zoomToData(data)

  } catch (err) {
    error.value = `Failed to process geometry data: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Processing error:', err)
  }
}

// Calculate extent and zoom to data
const zoomToData = async (data: GeometryResponse) => {
  const { Extent } = esriModules
  
  let allCoordinates: number[][] = []

  // Collect all coordinates
  if (data.surfaces_adiabatic) {
    data.surfaces_adiabatic.forEach((feature: any) => {
      if (feature.geometry?.coordinates?.[0]) {
        allCoordinates = allCoordinates.concat(feature.geometry.coordinates[0])
      }
    })
  }

  if (data.shading_surfaces) {
    data.shading_surfaces.forEach((feature: any) => {
      if (feature.geometry?.coordinates?.[0]) {
        allCoordinates = allCoordinates.concat(feature.geometry.coordinates[0])
      }
    })
  }

  if (allCoordinates.length > 0) {
    const extent = new Extent({
      xmin: Math.min(...allCoordinates.map(coords => coords[0])),
      ymin: Math.min(...allCoordinates.map(coords => coords[1])),
      xmax: Math.max(...allCoordinates.map(coords => coords[0])),
      ymax: Math.max(...allCoordinates.map(coords => coords[1])),
      spatialReference: { wkid: 4326 }
    })

    const expandedExtent = extent.expand(1.5)

    // Animate view to the data
    await view.goTo({
      target: expandedExtent,
      tilt: 45,
      heading: 180
    }, {
      duration: 2000,
      easing: "ease-in-out"
    })
  }
}

// Handle property selection change
const onPropertyChange = () => {
  console.log('Property changed to:', selectedProperty.value)
  // This can be extended to update layer styling based on selected property
}

// Initialize ArcGIS Map
const initializeMap = async () => {
  try {
    // Load ArcGIS modules
    const modules = await new Promise((resolve) => {
      (window as any).require([
        "esri/Map",
        "esri/views/SceneView",
        "esri/config",
        "esri/layers/FeatureLayer",
        "esri/widgets/Legend",
        "esri/widgets/LayerList",
        "esri/widgets/Expand",
        "esri/geometry/Extent",
        "esri/widgets/DirectLineMeasurement3D"
      ], (Map: any, SceneView: any, esriConfig: any, FeatureLayer: any, Legend: any, LayerList: any, Expand: any, Extent: any, DirectLineMeasurement3D: any) => {
        resolve({
          Map,
          SceneView,
          esriConfig,
          FeatureLayer,
          Legend,
          LayerList,
          Expand,
          Extent,
          DirectLineMeasurement3D
        })
      })
    })

    esriModules = modules as any
    const { Map, SceneView, esriConfig, Legend, LayerList, Expand } = esriModules

    // Set API key
    esriConfig.apiKey = "AAPK88646347a11d4ca190ec0b00201dc26c8kkfPaCG_kMmrxHsdUiVFuQzgCpecnrd664al4gHRq3VIIKlSV1epDVbEdh7tNJG"

    // Create map
    map = new Map({
      basemap: "arcgis/topographic",
      ground: "world-elevation"
    })

    // Create scene view
    view = new SceneView({
      container: "viewDiv",
      map: map,
      camera: {
        position: {
          x: 11.5820,
          y: 48.1351,
          z: 1000
        },
        tilt: 45,
        heading: 180
      },
      environment: {
        lighting: {
          directShadowsEnabled: true
        }
      }
    })

    // Add widgets
    const legend = new Legend({ view })
    const layerList = new LayerList({ view })

    const legendExpand = new Expand({
      view,
      content: legend,
      expandIconClass: "esri-icon-layer-list",
      group: "top-right"
    })

    const layerListExpand = new Expand({
      view,
      content: layerList,
      expandIconClass: "esri-icon-layers", 
      group: "top-right"
    })

    view.ui.add([legendExpand, layerListExpand], "top-right")

    // Add click handler for popups
    view.on("click", (event: any) => {
      view.hitTest(event).then((response: any) => {
        const results = response.results.filter((result: any) => {
          return result.graphic.layer.type === "feature"
        })
        if (results.length > 0) {
          const graphic = results[0].graphic
          view.popup.open({
            location: event.mapPoint,
            features: [graphic]
          })
        }
      })
    })

    console.log('ArcGIS Map initialized successfully')

  } catch (err) {
    error.value = `Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Map initialization error:', err)
  }
}

// Load ArcGIS API
const loadArcGISAPI = () => {
  return new Promise((resolve, reject) => {
    if ((window as any).require) {
      resolve(true)
      return
    }

    // Load CSS
    const cssLink = document.createElement('link')
    cssLink.rel = 'stylesheet'
    cssLink.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css'
    document.head.appendChild(cssLink)

    // Load Calcite CSS
    const calciteCss = document.createElement('link')
    calciteCss.rel = 'stylesheet'
    calciteCss.href = 'https://js.arcgis.com/calcite-components/2.9.0/calcite.css'
    document.head.appendChild(calciteCss)

    // Load JavaScript
    const script = document.createElement('script')
    script.src = 'https://js.arcgis.com/4.29/'
    script.onload = () => resolve(true)
    script.onerror = () => reject(new Error('Failed to load ArcGIS API'))
    document.head.appendChild(script)

    // Load Calcite Components
    const calciteScript = document.createElement('script')
    calciteScript.type = 'module'
    calciteScript.src = 'https://js.arcgis.com/calcite-components/2.9.0/calcite.esm.js'
    document.head.appendChild(calciteScript)
  })
}

// Component lifecycle
onMounted(async () => {
  try {
    await loadArcGISAPI()
    await initializeMap()
  } catch (err) {
    error.value = `Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
})

onUnmounted(() => {
  if (view) {
    view.destroy()
  }
})
</script>

<style scoped>
.scene-viewer-container {
  position: relative;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.config-panel {
  background: white;
  border-bottom: 1px solid #ddd;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 1000;
}

.config-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.config-content h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.form-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
  white-space: nowrap;
}

.api-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  min-width: 200px;
}

.api-input:focus {
  outline: none;
  border-color: #0079c1;
  box-shadow: 0 0 0 2px rgba(0, 121, 193, 0.2);
}

.fetch-btn {
  margin-left: 1rem;
}

.error-message {
  color: #d32f2f;
  font-size: 0.9rem;
  padding: 0.5rem;
  background-color: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 4px;
}

.map-container {
  flex: 1;
  width: 100%;
  min-height: 500px;
}

.picker-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 1000;
}

.panel-content {
  padding: 1rem;
  min-width: 250px;
}

.property-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.property-select:focus {
  outline: none;
  border-color: #0079c1;
  box-shadow: 0 0 0 2px rgba(0, 121, 193, 0.2);
}

/* Global styles for ArcGIS */
:global(.esri-widget) {
  font-family: inherit;
}
</style> 