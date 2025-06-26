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
  geometryData?: any
  geometryLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  apiBaseUrl: 'http://localhost:8080',
  geometryData: null,
  geometryLoading: false
})

const { gmlIds, apiBaseUrl, geometryData, geometryLoading } = toRefs(props)

// Reactive variables
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

// Function to calculate if a ring is clockwise or counter-clockwise
const isClockwise = (ring: number[][]) => {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1])
  }
  return sum > 0
}

// Function to reverse a ring's direction
const reverseRing = (ring: number[][]) => {
  return [...ring].reverse()
}

// Function to fix ring orientation for ArcGIS
// ArcGIS expects: exterior rings clockwise, holes counter-clockwise
// GeoJSON has: exterior rings counter-clockwise, holes clockwise
const fixRingOrientation = (rings: number[][][]) => {
  return rings.map((ring, index) => {
    const ringIsClockwise = isClockwise(ring)
    
    if (index === 0) {
      // Exterior ring should be clockwise for ArcGIS
      if (!ringIsClockwise) {
        console.log(`🔄 Reversing exterior ring to make it clockwise`)
        return reverseRing(ring)
      }
    } else {
      // Interior rings (holes) should be counter-clockwise for ArcGIS
      if (ringIsClockwise) {
        console.log(`🔄 Reversing interior ring ${index} to make it counter-clockwise`)
        return reverseRing(ring)
      }
    }
    
    return ring
  })
}

// API Response interfaces
interface GeometryResponse {
  [key: string]: any // Allow dynamic keys since the structure is nested
}

// Watch for changes in geometry data and process it automatically
watch(geometryData, async (newGeometryData) => {
  console.log('👀 Geometry data changed:', { hasData: !!newGeometryData })
  console.log('View and map status:', { view: !!view, map: !!map })
  
  if (newGeometryData && view && map) {
    console.log('🚀 Triggering processGeometryData from watch...')
    await processGeometryData(newGeometryData)
  } else {
    console.log('⚠️ Not processing geometry:', {
      hasData: !!newGeometryData,
      hasView: !!view,
      hasMap: !!map
    })
  }
}, { immediate: false })

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

    // Extract visualization_zone and surfaces_adiabatic from nested structure
    let adiabaticData: any = null
    let shadingData: any = null

    // Look for visualization_zone in the response structure (as adiabatic data)
    if (geometryData.visualization_zone) {
      adiabaticData = geometryData.visualization_zone
      console.log('Found visualization_zone directly')
    } else {
      // Check if it's nested in results or other structure
      for (const key in geometryData) {
        if (geometryData[key] && geometryData[key].visualization_zone) {
          adiabaticData = geometryData[key].visualization_zone
          console.log('Found visualization_zone in key:', key)
          break
        }
      }
    }

    // Look for surfaces_adiabatic in the response structure (as shading data)
    if (geometryData.surfaces_adiabatic) {
      shadingData = geometryData.surfaces_adiabatic
      console.log('Found surfaces_adiabatic directly')
    } else {
      // Check if it's nested in results or other structure
      for (const key in geometryData) {
        if (geometryData[key] && geometryData[key].surfaces_adiabatic) {
          shadingData = geometryData[key].surfaces_adiabatic
          console.log('Found surfaces_adiabatic in key:', key)
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
      const shadingFeatures = shadingData.features.map((feature: any, index: number) => ({
        geometry: {
          type: "polygon",
          rings: (() => {
            let rings = feature.geometry.coordinates
            if (feature.geometry.type === 'Polygon') {
              rings = feature.geometry.coordinates
              console.log(`🔍 Polygon ${index} coordinates structure:`, {
                type: feature.geometry.type,
                coordinatesLength: feature.geometry.coordinates.length,
                firstRingLength: feature.geometry.coordinates[0]?.length,
                allRings: feature.geometry.coordinates.map((ring: any, ringIndex: number) => ({
                  ringIndex,
                  ringLength: ring.length,
                  firstCoord: ring[0],
                  lastCoord: ring[ring.length - 1]
                }))
              })
              if (rings.length > 1) {
                console.log(`🕳️ Shading Polygon ${index} has ${rings.length - 1} interior ring(s) (holes)`)
                console.log(`🕳️ Interior rings:`, rings.slice(1))
              }
            } else if (feature.geometry.type === 'MultiPolygon') {
              rings = feature.geometry.coordinates.flat()
              console.log(`🔗 Shading MultiPolygon ${index} flattened to ${rings.length} rings`)
            }
            
            // Fix ring orientation for ArcGIS
            rings = fixRingOrientation(rings)
            
            return rings
          })(),
          spatialReference: { wkid: 4326 }
        },
        attributes: {
          ObjectID: index,
          ...feature.properties
        }
      }))

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
        
        // Handle GeoJSON polygon coordinates properly
        let rings = feature.geometry.coordinates
        if (feature.geometry.type === 'Polygon') {
          rings = feature.geometry.coordinates
          console.log(`🔍 Property Polygon ${index} coordinates structure:`, {
            type: feature.geometry.type,
            coordinatesLength: feature.geometry.coordinates.length,
            firstRingLength: feature.geometry.coordinates[0]?.length,
            allRings: feature.geometry.coordinates.map((ring: any, ringIndex: number) => ({
              ringIndex,
              ringLength: ring.length,
              firstCoord: ring[0],
              lastCoord: ring[ring.length - 1]
            }))
          })
          if (rings.length > 1) {
            console.log(`🕳️ Property Adiabatic Polygon ${index} has ${rings.length - 1} interior ring(s) (holes)`)
            console.log(`🕳️ Interior rings:`, rings.slice(1))
          }
        } else if (feature.geometry.type === 'MultiPolygon') {
          rings = feature.geometry.coordinates.flat()
          console.log(`🔗 Property Adiabatic MultiPolygon ${index} flattened to ${rings.length} rings`)
        }
        
        // Fix ring orientation for ArcGIS
        rings = fixRingOrientation(rings)
        
        console.log(`📐 Final rings for adiabatic feature ${index}:`, {
          ringsCount: rings.length,
          rings: rings.map((ring: any, ringIndex: number) => ({
            ringIndex,
            pointCount: ring.length,
            isHole: ringIndex > 0,
            firstPoint: ring[0],
            lastPoint: ring[ring.length - 1]
          }))
        })
        
        return {
          geometry: {
            type: "polygon",
            rings: rings,
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
    
    // For building-level viewing, use a much closer zoom
    const altitude = maxExtent < 0.001 ? 50 : maxExtent * 12000
    
    // Animate view to the building with closer zoom
    await view.goTo({
      target: new Point({
        x: centerX,
        y: centerY,
        spatialReference: { wkid: 4326 }
      }),
      tilt: 60,
      heading: 45,
      zoom: maxExtent < 0.001 ? 19 : 18
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
          rings: (() => {
            let rings = feature.geometry.coordinates
            if (feature.geometry.type === 'Polygon') {
              rings = feature.geometry.coordinates
              console.log(`🔍 Polygon ${index} coordinates structure:`, {
                type: feature.geometry.type,
                coordinatesLength: feature.geometry.coordinates.length,
                firstRingLength: feature.geometry.coordinates[0]?.length,
                allRings: feature.geometry.coordinates.map((ring: any, ringIndex: number) => ({
                  ringIndex,
                  ringLength: ring.length,
                  firstCoord: ring[0],
                  lastCoord: ring[ring.length - 1]
                }))
              })
              if (rings.length > 1) {
                console.log(`🕳️ Shading Polygon ${index} has ${rings.length - 1} interior ring(s) (holes)`)
                console.log(`🕳️ Interior rings:`, rings.slice(1))
              }
            } else if (feature.geometry.type === 'MultiPolygon') {
              rings = feature.geometry.coordinates.flat()
              console.log(`🔗 Shading MultiPolygon ${index} flattened to ${rings.length} rings`)
            }
            
            // Fix ring orientation for ArcGIS
            rings = fixRingOrientation(rings)
            
            return rings
          })(),
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
          rings: (() => {
            let rings = feature.geometry.coordinates
            if (feature.geometry.type === 'Polygon') {
              rings = feature.geometry.coordinates
            } else if (feature.geometry.type === 'MultiPolygon') {
              rings = feature.geometry.coordinates.flat()
            }
            
            // Fix ring orientation for ArcGIS
            rings = fixRingOrientation(rings)
            
            return rings
          })(),
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
    
    const modules = await new Promise((resolve) => {
      (window as any).require([
        "esri/Map",
        "esri/views/SceneView", 
        "esri/config",
        "esri/layers/FeatureLayer",
        "esri/widgets/Legend",
        "esri/widgets/LayerList",
        "esri/widgets/Expand",
        "esri/widgets/Fullscreen",
        "esri/geometry/Extent",
        "esri/geometry/Point",
        "esri/widgets/DirectLineMeasurement3D"
      ], (
        Map: any, 
        SceneView: any, 
        esriConfig: any, 
        FeatureLayer: any,
        Legend: any, 
        LayerList: any,
        Expand: any,
        Fullscreen: any,
        Extent: any,
        Point: any,
        DirectLineMeasurement3D: any
      ) => {
        resolve({
          Map,
          SceneView,
          esriConfig,
          FeatureLayer,
          Legend,
          LayerList,
          Expand,
          Fullscreen,
          Extent,
          Point,
          DirectLineMeasurement3D
        })
      })
    })

    esriModules = modules as any
    const { Map, SceneView, esriConfig, Legend, LayerList, Expand, Fullscreen } = esriModules

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
    const fullscreen = new Fullscreen({ view })

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

    view.ui.add([legendExpand, layerListExpand, pickerExpand, fullscreen], "top-right")

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
    
    // Auto-process geometry if data is available
    if (geometryData.value) {
      console.log('🎯 Geometry data available on mount, processing...')
      await processGeometryData(geometryData.value)
    } else {
      console.log('ℹ️ No geometry data available on mount')
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
  overflow: hidden;
}

.map-container {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
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

/* Ensure calcite dropdowns can extend outside container */
:global(.calcite-combobox-list) {
  z-index: 9999 !important;
}

:global(.calcite-popover) {
  z-index: 9999 !important;
}

:global(.esri-expand__content) {
  z-index: 1000 !important;
}

/* Allow overflow for dropdowns */
:global(.esri-expand__content-panel) {
  overflow: visible !important;
}
</style>
