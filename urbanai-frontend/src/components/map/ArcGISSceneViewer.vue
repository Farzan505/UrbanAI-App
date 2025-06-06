<template>
  <div class="scene-viewer-container">
    <!-- ArcGIS Scene View Container -->
    <div id="viewDiv" class="map-container"></div>
    
    <!-- Calcite Property Picker Panel (hidden, will be added to ArcGIS UI) -->
    <calcite-panel id="pickerContainer" heading="Select Feature Property" width-scale="l" height-scale="l" style="display: none;">
      <div class="panel-content">
        <calcite-combobox id="featurePicker" placeholder="Pick a Feature Property" selection-mode="single">
        </calcite-combobox>
      </div>
    </calcite-panel>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRefs } from 'vue'

// Props
interface Props {
  gmlIds: string[]
  apiBaseUrl?: string
}

const props = withDefaults(defineProps<Props>(), {
  apiBaseUrl: 'http://localhost:8080'
})

const { gmlIds, apiBaseUrl } = toRefs(props)

// Reactive variables
const loading = ref(false)
const error = ref('')
const selectedProperty = ref('')
const availableProperties = ref<string[]>([])

// ArcGIS related variables
let view: any = null
let map: any = null
let esriModules: any = {}

// Store the current data for re-rendering when property changes
let currentData: { adiabaticData: any, shadingData: any } | null = null

// Color palette for different property values (from original HTML)
const colors = ["#fc3e5aff", "#fce138ff", "#4c81cdff", "#f1983cff", "#48885cff", "#a553b7ff", "#fff799ff", "#b1a9d0ff", "#6ecffcff", "#fc6f84ff", "#6af689ff", "#fcd27eff"]

// API Response interfaces
interface GeometryResponse {
  [key: string]: any // Allow dynamic keys since the structure is nested
}

// Watch for changes in GML IDs and fetch geometry automatically
watch(gmlIds, async (newGmlIds, oldGmlIds) => {
  console.log('👀 GML IDs changed:', { oldGmlIds, newGmlIds })
  console.log('View and map status:', { view: !!view, map: !!map })
  
  if (newGmlIds && newGmlIds.length > 0 && view && map) {
    console.log('🚀 Triggering fetchGeometry from watch...')
    await fetchGeometry()
  } else {
    console.log('⚠️ Not fetching geometry:', {
      hasGmlIds: !!(newGmlIds && newGmlIds.length > 0),
      hasView: !!view,
      hasMap: !!map
    })
  }
}, { immediate: false })

// Fetch geometry data from API
const fetchGeometry = async () => {
  console.log('🌐 Starting fetchGeometry...')
  
  if (!gmlIds.value || gmlIds.value.length === 0) {
    error.value = 'No GML IDs provided'
    console.error('❌ No GML IDs provided')
    return
  }

  console.log('📡 Fetching geometry for GML IDs:', gmlIds.value)
  loading.value = true
  error.value = ''
  
  try {
    // Join multiple GML IDs with comma for the API call
    const gmlIdParam = gmlIds.value.join(',')
    console.log('🔗 API URL:', `${apiBaseUrl.value}/api/geometry/get_geometry?gmlids=${gmlIdParam}`)
    
    const response = await fetch(
      `${apiBaseUrl.value}/api/geometry/get_geometry?gmlids=${gmlIdParam}`
    )
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data: GeometryResponse = await response.json()
    console.log('✅ API Response received:', data)
    
    // Process the data for ArcGIS
    console.log('🔄 Starting processGeometryData...')
    await processGeometryData(data)
    console.log('✅ processGeometryData completed')
    
  } catch (err) {
    error.value = `Failed to fetch geometry: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('❌ Fetch error:', err)
  } finally {
    loading.value = false
    console.log('🏁 fetchGeometry completed, loading:', loading.value)
  }
}

// Process geometry data and display in ArcGIS
const processGeometryData = async (data: GeometryResponse) => {
  console.log('🔄 Starting processGeometryData...')
  
  if (!view || !map) {
    error.value = 'Map not initialized'
    console.error('❌ Map or view not initialized:', { view: !!view, map: !!map })
    return
  }

  if (!view.ready) {
    console.log('⏳ View not ready, waiting...')
    await view.when()
    console.log('✅ View is now ready')
  }

  const { FeatureLayer } = esriModules

  try {
    console.log('🧹 Clearing existing layers...')
    // Clear existing layers
    map.layers.removeAll()

    console.log('Processing geometry data:', data)
    console.log('Data keys:', Object.keys(data))

    // Check if data is wrapped in 'results' property
    let geometryData = data
    if (data.results) {
      console.log('Found data in results property')
      console.log('Results keys:', Object.keys(data.results))
      geometryData = data.results
    }

    // Extract surfaces_adiabatic from nested structure
    let adiabaticData: any = null
    let shadingData: any = null

    // Look for surfaces_adiabatic in the response structure
    if (geometryData.surfaces_adiabatic) {
      adiabaticData = geometryData.surfaces_adiabatic
      console.log('Found surfaces_adiabatic directly')
    } else {
      // Check if it's nested in results or other structure
      for (const key in geometryData) {
        if (geometryData[key] && geometryData[key].surfaces_adiabatic) {
          adiabaticData = geometryData[key].surfaces_adiabatic
          console.log('Found surfaces_adiabatic in key:', key)
          break
        }
      }
    }

    // Look for shading_surfaces in the response structure
    if (geometryData.shading_surfaces) {
      shadingData = geometryData.shading_surfaces
      console.log('Found shading_surfaces directly')
    } else {
      // Check if it's nested in results or other structure
      for (const key in geometryData) {
        if (geometryData[key] && geometryData[key].shading_surfaces) {
          shadingData = geometryData[key].shading_surfaces
          console.log('Found shading_surfaces in key:', key)
          break
        }
      }
    }

    console.log('Final adiabatic data:', adiabaticData)
    console.log('Final shading data:', shadingData)

    // If no data found, let's see what's available
    if (!adiabaticData && !shadingData) {
      console.log('No expected data found. Available keys in geometryData:', Object.keys(geometryData))
      for (const key in geometryData) {
        console.log(`Key: ${key}, Type: ${typeof geometryData[key]}, Value:`, geometryData[key])
      }
    }

    // Store current data for property visualization
    currentData = { adiabaticData, shadingData }

    // Set up property picker if we have adiabatic data
    if (adiabaticData && adiabaticData.features && adiabaticData.features.length > 0) {
      // Get property names for picker
      availableProperties.value = Object.keys(adiabaticData.features[0].properties)
      
      // Set up Calcite UI components
      setupPropertyPicker()
      
      // Set default property
      if (!selectedProperty.value && availableProperties.value.length > 0) {
        selectedProperty.value = availableProperties.value[0]
      }
    }

    // Add shading surfaces (always visible)
    if (shadingData && shadingData.features && shadingData.features.length > 0) {
      console.log('Processing shading surfaces...')
      const shadingFeatures = shadingData.features.map((feature: any, index: number) => {
        console.log('Processing shading feature:', index, feature.geometry)
        
        return {
          geometry: {
            type: "polygon",
            rings: feature.geometry.coordinates,
            spatialReference: { wkid: 4326 }
          },
          attributes: {
            ObjectID: index,
            ...feature.properties
          }
        }
      })

      try {
        const shadingLayer = new FeatureLayer({
          source: shadingFeatures,
          objectIdField: "ObjectID",
          title: "Shading Surfaces",
          fields: [
            { name: "ObjectID", alias: "ObjectID", type: "oid" },
            ...Object.keys(shadingData.features[0]?.properties || {}).map((prop: string) => ({
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
                material: { 
                  color: [128, 128, 128, 0.7],
                  colorMixMode: "replace"
                },
                outline: {
                  color: [255, 255, 255, 1.0],
                  size: "2px"
                }
              }]
            }
          },
          popupTemplate: {
            title: "Shading Surface",
            content: [{
              type: "fields",
              fieldInfos: Object.keys(shadingData.features[0]?.properties || {}).map((prop: string) => ({
                fieldName: prop,
                label: prop
              }))
            }]
          }
        })

        map.add(shadingLayer)
        console.log('✅ Successfully added shading layer with', shadingFeatures.length, 'features')
      } catch (layerError) {
        console.error('❌ Error creating shading layer:', layerError)
      }
    } else {
      console.log('No shading data available')
    }

    // If we have a selected property, visualize by that property
    if (selectedProperty.value && adiabaticData) {
      console.log('Visualizing by property:', selectedProperty.value)
      visualizeByProperty(selectedProperty.value)
    } else if (adiabaticData && adiabaticData.features && adiabaticData.features.length > 0) {
      console.log('Processing adiabatic surfaces...')
      // Otherwise show default red adiabatic surfaces
      const adiabaticFeatures = adiabaticData.features.map((feature: any, index: number) => {
        console.log('Processing adiabatic feature:', index, feature.geometry)
        
        return {
          geometry: {
            type: "polygon",
            rings: feature.geometry.coordinates,
            spatialReference: { wkid: 4326 }
          },
          attributes: {
            ObjectID: index,
            ...feature.properties
          }
        }
      })

      try {
        const adiabaticLayer = new FeatureLayer({
          source: adiabaticFeatures,
          objectIdField: "ObjectID",
          title: "Adiabatic Surfaces",
          fields: [
            { name: "ObjectID", alias: "ObjectID", type: "oid" },
            ...Object.keys(adiabaticData.features[0]?.properties || {}).map((prop: string) => ({
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
                material: { 
                  color: [255, 100, 100, 0.8],
                  colorMixMode: "replace"
                },
                outline: {
                  color: [255, 255, 255, 1.0],
                  size: "2px"
                }
              }]
            }
          },
          popupTemplate: {
            title: "Adiabatic Surface",
            content: [{
              type: "fields",
              fieldInfos: Object.keys(adiabaticData.features[0]?.properties || {}).map((prop: string) => ({
                fieldName: prop,
                label: prop
              }))
            }]
          }
        })

        map.add(adiabaticLayer)
        console.log('✅ Successfully added adiabatic layer with', adiabaticFeatures.length, 'features')
      } catch (layerError) {
        console.error('❌ Error creating adiabatic layer:', layerError)
      }
    } else {
      console.log('No adiabatic data available')
    }

    // Calculate extent and zoom to data
    console.log('Attempting to zoom to data...')
    try {
      await zoomToData({ adiabaticData, shadingData })
      console.log('✅ Successfully zoomed to data')
    } catch (zoomError) {
      console.error('❌ Error zooming to data:', zoomError)
    }

  } catch (err) {
    error.value = `Failed to process geometry data: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Processing error:', err)
  }
}

// Setup Calcite property picker UI
const setupPropertyPicker = () => {
  const featurePicker = document.getElementById("featurePicker") as any
  const pickerContainer = document.getElementById("pickerContainer")
  
  if (!featurePicker || !pickerContainer) return

  // Clear existing items
  featurePicker.innerHTML = ''

  // Add property options
  availableProperties.value.forEach(prop => {
    const item = document.createElement("calcite-combobox-item") as any
    item.value = prop
    item.setAttribute('text-label', prop)
    item.innerHTML = prop
    featurePicker.appendChild(item)
  })

  // Add event listener for property changes
  featurePicker.addEventListener("calciteComboboxChange", (event: any) => {
    const selectedValue = event.target.selectedItems[0]?.value
    if (selectedValue) {
      selectedProperty.value = selectedValue
      onPropertyChange()
    }
  })

  // Show the picker container
  pickerContainer.style.display = 'block'
}

// Calculate extent and zoom to data
const zoomToData = async (data: { adiabaticData: any, shadingData: any }) => {
  const { Extent, Point } = esriModules
  
  let allCoordinates: number[][] = []

  // Collect all coordinates from GeoJSON features
  if (data.adiabaticData?.features) {
    data.adiabaticData.features.forEach((feature: any) => {
      if (feature.geometry?.coordinates) {
        // Handle different geometry types
        if (feature.geometry.type === 'Polygon') {
          // For polygons, coordinates[0] is the exterior ring
          allCoordinates = allCoordinates.concat(feature.geometry.coordinates[0])
        } else if (feature.geometry.type === 'MultiPolygon') {
          // For multipolygons, iterate through all polygons
          feature.geometry.coordinates.forEach((polygon: any) => {
            allCoordinates = allCoordinates.concat(polygon[0])
          })
        }
      }
    })
  }

  if (data.shadingData?.features) {
    data.shadingData.features.forEach((feature: any) => {
      if (feature.geometry?.coordinates) {
        // Handle different geometry types
        if (feature.geometry.type === 'Polygon') {
          // For polygons, coordinates[0] is the exterior ring
          allCoordinates = allCoordinates.concat(feature.geometry.coordinates[0])
        } else if (feature.geometry.type === 'MultiPolygon') {
          // For multipolygons, iterate through all polygons
          feature.geometry.coordinates.forEach((polygon: any) => {
            allCoordinates = allCoordinates.concat(polygon[0])
          })
        }
      }
    })
  }

  console.log('Total coordinates found:', allCoordinates.length)
  if (allCoordinates.length > 0) {
    console.log('Sample coordinate:', allCoordinates[0])
  }

  if (allCoordinates.length > 0) {
    const xCoords = allCoordinates.map(coords => coords[0])
    const yCoords = allCoordinates.map(coords => coords[1])
    
    const extent = new Extent({
      xmin: Math.min(...xCoords),
      ymin: Math.min(...yCoords),
      xmax: Math.max(...xCoords),
      ymax: Math.max(...yCoords),
      spatialReference: { wkid: 4326 }
    })

    console.log('Calculated extent:', extent)

    // Calculate center point for better camera positioning
    const centerX = (extent.xmin + extent.xmax) / 2
    const centerY = (extent.ymin + extent.ymax) / 2
    
    // Calculate appropriate zoom level based on extent size
    const extentWidth = extent.xmax - extent.xmin
    const extentHeight = extent.ymax - extent.ymin
    const maxExtent = Math.max(extentWidth, extentHeight)
    
    // For building-level viewing, use a closer zoom
    const altitude = maxExtent < 0.001 ? 200 : maxExtent * 50000
    
    // Animate view to the building
    await view.goTo({
      target: new Point({
        x: centerX,
        y: centerY,
        spatialReference: { wkid: 4326 }
      }),
      tilt: 45,
      heading: 0,
      zoom: maxExtent < 0.001 ? 18 : 16
    }, {
      duration: 3000,
      easing: "ease-in-out"
    })

    console.log('Zoomed to building extent')
  } else {
    console.warn('No coordinates found to zoom to')
  }
}

// Handle property selection change
const onPropertyChange = () => {
  console.log('Property changed to:', selectedProperty.value)
  if (selectedProperty.value && currentData) {
    visualizeByProperty(selectedProperty.value)
  }
}

// Visualize adiabatic surfaces by selected property with different colors
const visualizeByProperty = (selectedProperty: string) => {
  if (!currentData || !view || !map) return

  const { FeatureLayer } = esriModules
  const { adiabaticData, shadingData } = currentData

  try {
    // Clear existing layers
    map.layers.removeAll()

    // Re-add shading surfaces (unchanged)
    if (shadingData && shadingData.features && shadingData.features.length > 0) {
      const shadingFeatures = shadingData.features.map((feature: any, index: number) => ({
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

      const shadingLayer = new FeatureLayer({
        source: shadingFeatures,
        objectIdField: "ObjectID",
        title: "Shading Surfaces",
        fields: [
          { name: "ObjectID", alias: "ObjectID", type: "oid" },
          ...Object.keys(shadingData.features[0]?.properties || {}).map((prop: string) => ({
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
              material: { 
                color: [128, 128, 128, 0.7],
                colorMixMode: "replace"
              },
              outline: {
                color: [255, 255, 255, 1.0],
                size: "2px"
              }
            }]
          }
        },
        popupTemplate: {
          title: "Shading Surface",
          content: [{
            type: "fields",
            fieldInfos: Object.keys(shadingData.features[0]?.properties || {}).map((prop: string) => ({
              fieldName: prop,
              label: prop
            }))
          }]
        }
      })

      map.add(shadingLayer)
    }

    // Process adiabatic surfaces by property value
    if (adiabaticData && adiabaticData.features && adiabaticData.features.length > 0) {
      // Create base features with selected property
      const features = adiabaticData.features.map((feature: any, index: number) => ({
        geometry: {
          type: "polygon",
          rings: feature.geometry.coordinates,
          spatialReference: { wkid: 4326 }
        },
        attributes: {
          ObjectID: index,
          featureProp: feature.properties[selectedProperty],
          ...feature.properties
        }
      }))

      // Get unique values for the selected property
      const uniqueValues = [...new Set(features.map((f: any) => f.attributes.featureProp))].filter((val: any) => val != null)
      console.log('Unique values for', selectedProperty, ':', uniqueValues)

      // Create a separate layer for each unique value
      const sublayers = uniqueValues.map((value, index) => {
        const sublayerFeatures = features.filter((f: any) => f.attributes.featureProp === value)

        return new FeatureLayer({
          source: sublayerFeatures,
          objectIdField: "ObjectID",
          title: String(value),
          fields: [
            { name: "ObjectID", alias: "ObjectID", type: "oid" },
            { name: "featureProp", alias: "featureProp", type: "string" },
            ...Object.keys(adiabaticData.features[0].properties).map((prop: string) => ({
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
                material: { 
                  color: colors[index % colors.length],
                  colorMixMode: "replace"
                },
                outline: {
                  color: [255, 255, 255, 0.7],
                  size: "2px"
                }
              }]
            }
          },
          popupTemplate: {
            title: `{${selectedProperty}}`,
            content: [{
              type: "fields",
              fieldInfos: Object.keys(adiabaticData.features[0].properties).map((prop: string) => ({
                fieldName: prop,
                label: prop
              }))
            }]
          }
        })
      })

      // Add all sublayers to the map
      sublayers.forEach(layer => map.add(layer))
      console.log('Added', sublayers.length, 'property-based layers')
    }

  } catch (err) {
    error.value = `Failed to visualize by property: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Property visualization error:', err)
  }
}

// Initialize ArcGIS Map
const initializeMap = async () => {
  try {
    console.log('🗺️ Starting map initialization...')
    
    // Check if the container exists and has proper dimensions
    const container = document.getElementById("viewDiv")
    if (!container) {
      throw new Error('Map container not found')
    }
    
    const containerRect = container.getBoundingClientRect()
    console.log('📐 Map container dimensions:', {
      width: containerRect.width,
      height: containerRect.height,
      visible: containerRect.width > 0 && containerRect.height > 0
    })
    
    if (containerRect.width === 0 || containerRect.height === 0) {
      console.warn('⚠️ Map container has zero dimensions!')
    }

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
        "esri/geometry/Point",
        "esri/widgets/DirectLineMeasurement3D"
      ], (Map: any, SceneView: any, esriConfig: any, FeatureLayer: any, Legend: any, LayerList: any, Expand: any, Extent: any, Point: any, DirectLineMeasurement3D: any) => {
        resolve({
          Map,
          SceneView,
          esriConfig,
          FeatureLayer,
          Legend,
          LayerList,
          Expand,
          Extent,
          Point,
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
    console.log('✅ Map created')

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
    console.log('✅ SceneView created')

    // Wait for view to be ready
    await view.when()
    console.log('✅ SceneView is ready')

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

    // Add property picker expand widget
    const pickerContainer = document.getElementById("pickerContainer")
    const pickerExpand = new Expand({
      view,
      content: pickerContainer,
      expandIconClass: "esri-icon-filter",
      group: "top-right"
    })

    view.ui.add([legendExpand, layerListExpand, pickerExpand], "top-right")

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

    console.log('✅ ArcGIS Map initialized successfully')

  } catch (err) {
    error.value = `Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('❌ Map initialization error:', err)
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
    console.log('🚀 Component mounted, initializing...')
    await loadArcGISAPI()
    console.log('✅ ArcGIS API loaded')
    await initializeMap()
    console.log('✅ Map initialized')
    
    // Auto-load geometry if GML IDs are provided
    if (gmlIds.value && gmlIds.value.length > 0) {
      console.log('🎯 GML IDs available on mount, fetching geometry:', gmlIds.value)
      await fetchGeometry()
    } else {
      console.log('ℹ️ No GML IDs available on mount')
    }
  } catch (err) {
    error.value = `Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('❌ Initialization error:', err)
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
  height: 100%;
  display: flex;
  flex-direction: column;
}

.map-container {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px;
  width: 330px;
  height: 300px;
}

calcite-combobox {
  --calcite-ui-height: 10rem;
}

calcite-combobox-item {
  height: 3rem;
  line-height: 3rem;
}

calcite-combobox-item::part(container) {
  max-height: 400px;
  overflow-y: auto;
}

/* Global styles for ArcGIS */
:global(.esri-widget) {
  font-family: inherit;
}
</style> 