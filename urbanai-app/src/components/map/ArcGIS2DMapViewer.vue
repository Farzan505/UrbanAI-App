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
import { useAuth } from '../../composables/useAuth'

// Props
interface Props {
  geometryData?: any
  isLoading?: boolean
  portalItems?: any[]
  drawingMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  geometryData: null,
  isLoading: false,
  portalItems: () => [],
  drawingMode: false
})

// Emits
const emit = defineEmits<{
  featureSelected: [feature: { gmlid: string; attributes: any }]
  lineDrawn: [lineData: { geometry: any; id: string }]
  clearDrawnLines: []
}>()

// State
const mapContainer = ref<HTMLElement | null>(null)
const error = ref<string>('')
let mapView: any = null
let map: any = null
let sketchViewModel: any = null
let drawingLayer: any = null

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
    const [MapModule, MapViewModule, GeoJSONLayerModule, GraphicsLayerModule, SketchViewModelModule] = await Promise.all([
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
      import('@arcgis/core/layers/GraphicsLayer').catch(err => {
        console.error('Failed to load GraphicsLayer module:', err)
        throw err
      }),
      import('@arcgis/core/widgets/Sketch/SketchViewModel').catch(err => {
        console.error('Failed to load SketchViewModel module:', err)
        throw err
      })
    ])

    const Map = MapModule.default
    const MapView = MapViewModule.default
    const GeoJSONLayer = GeoJSONLayerModule.default
    const GraphicsLayer = GraphicsLayerModule.default
    const SketchViewModel = SketchViewModelModule.default

    console.log('✅ ArcGIS modules loaded successfully')

    // Remove previous view if any
    if (mapView) {
      mapView.destroy()
      mapView = null
    }

    // Create drawing layer for line sketches
    drawingLayer = new GraphicsLayer({
      title: 'Drawing Layer'
    })

    // Create map with simple basemap
    map = new Map({
      basemap: "gray-vector", // Use a simple predefined basemap
      layers: [drawingLayer]
    })

    // Create map view
    mapView = new MapView({
      container: mapContainer.value as HTMLDivElement,
      map: map,
      center: [11.5820, 48.1351], // Munich coordinates
      zoom: 12,
      constraints: {
        minZoom: 8,
        maxZoom: 20 // Allow zooming to higher levels to see buildings
      }
    })

    // Wait for the view to be fully ready
    await mapView.when()
    console.log('✅ MapView is ready')

    // Initialize sketch functionality
    setupSketchViewModel(SketchViewModel)

    // Add small delay to ensure all initialization is complete
    await new Promise(resolve => setTimeout(resolve, 200))

    // Add geometry layer if data exists
    if (props.geometryData) {
      await addGeometryLayer(GeoJSONLayer)
    }

    // Add portal items as CityGML layers if available
    if (props.portalItems && props.portalItems.length > 0) {
      await addCityGmlFeatureLayer()
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

// Add CityGML portal item as FeatureLayer
const addCityGmlFeatureLayer = async () => {
  try {
    if (!props.portalItems || props.portalItems.length === 0 || !mapView || !map) {
      console.log('ℹ️ No portal items to add or map not ready')
      return
    }

    console.log('🏢 Adding CityGML portal items as FeatureLayer:', props.portalItems.length)

    const { getToken } = useAuth()
    
    // Import FeatureLayer module
    const FeatureLayerModule = await import('@arcgis/core/layers/FeatureLayer')
    const FeatureLayer = FeatureLayerModule.default

    for (const item of props.portalItems) {
      try {
        console.log('🔍 Processing CityGML portal item:', item.title, 'Type:', item.type)
        
        // Check if this is a CityGML item (by title or type)
        const isCityGML = item.title?.toLowerCase().includes('citygml') || 
                         item.title?.toLowerCase().includes('cityml') ||
                         item.type === 'Feature Service'
        
        if (!isCityGML) {
          console.log(`⚠️ Skipping non-CityGML item: ${item.title}`)
          continue
        }

        // Get authentication token
        const token = await getToken()
        
        // Create the FeatureLayer URL (use proxy in development)
        const baseUrl = item.url || `https://gisportal-stmb.bayern.de/server/rest/services/Hosted/citygml_data/FeatureServer`
        const layerUrl = import.meta.env.DEV 
          ? baseUrl.replace('https://gisportal-stmb.bayern.de', '/gisportal')
          : baseUrl

        console.log('🌐 Creating FeatureLayer from URL:', layerUrl)

        // Create the FeatureLayer
        const featureLayer = new FeatureLayer({
          url: layerUrl + '/0', // Default to first layer
          title: `${item.title} (CityGML)`,
          apiKey: token,
          visible: false, // Start hidden, will show based on zoom
          minScale: 0, // No min scale limit
          maxScale: 3000, // Only visible when zoomed in (approximately zoom level 15+)
          
          // Custom renderer for CityGML buildings
          renderer: {
            type: "simple",
            symbol: {
              type: "simple-fill",
              color: [255, 165, 0, 0.7], // Orange color for CityGML buildings
              outline: {
                color: [255, 140, 0, 1],
                width: 1
              }
            }
          },
          
          // Enhanced popup template with comprehensive data logging
          popupTemplate: {
            title: "CityGML Building - {gmlid}",
            content: (feature: any) => {
              // Log all available feature data to console
              console.log('🏢 Building clicked! Full feature data:', feature)
              console.log('🏢 Feature attributes:', feature.graphic?.attributes)
              console.log('🏢 Feature geometry:', feature.graphic?.geometry)
              console.log('🏢 Feature layer:', feature.graphic?.layer)
              
              // Emit feature selection event if gmlid is available
              const attributes = feature.graphic?.attributes || {}
              if (attributes.gmlid) {
                console.log('📤 Emitting feature selected event with gmlid:', attributes.gmlid)
                emit('featureSelected', { 
                  gmlid: attributes.gmlid, 
                  attributes: attributes 
                })
              }
              
              // Create detailed content
              let content = '<div style="max-height: 300px; overflow-y: auto;">'
              content += '<h3>🏢 Building Information</h3>'
              content += '<p style="background-color: #e3f2fd; padding: 8px; border-radius: 4px; margin-bottom: 12px;">💡 Das GMLID wurde automatisch in das Eingabefeld übernommen!</p>'
              
              // Display all available attributes
              if (Object.keys(attributes).length > 0) {
                content += '<table style="width: 100%; border-collapse: collapse;">'
                for (const [key, value] of Object.entries(attributes)) {
                  content += `<tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 4px; font-weight: bold; vertical-align: top;">${key}:</td>
                    <td style="padding: 4px;">${value || 'N/A'}</td>
                  </tr>`
                }
                content += '</table>'
              } else {
                content += '<p>No attribute data available</p>'
              }
              
              content += '</div>'
              return content
            }
          }
        })

        console.log('🔍 Loading CityGML FeatureLayer...')
        await featureLayer.load()
        console.log('✅ CityGML FeatureLayer loaded successfully:', featureLayer.title)

        // Add layer to map
        map.add(featureLayer)
        console.log('✅ Added CityGML FeatureLayer to map')

        // Watch for zoom changes to show/hide the CityGML layer
        mapView.watch('zoom', (newZoom: number) => {
          // Show layer only at zoom level 15 or higher (detailed building level)
          const shouldShow = newZoom >= 15
          if (featureLayer && featureLayer.visible !== shouldShow) {
            featureLayer.visible = shouldShow
            console.log(`🔍 CityGML FeatureLayer visibility: ${shouldShow} (zoom: ${newZoom})`)
          }
        })

        // Set initial visibility based on current zoom
        const currentZoom = mapView.zoom
        featureLayer.visible = currentZoom >= 15
        console.log(`🔍 Initial CityGML visibility: ${featureLayer.visible} (zoom: ${currentZoom})`)

        // Add click event listener to log additional data
        mapView.on('click', (event: any) => {
          console.log('🖱️ Map clicked at:', event.mapPoint)
          console.log('🖱️ Screen coordinates:', event.x, event.y)
          
          // Perform a hit test to see what features are at the click location
          mapView.hitTest(event).then((response: any) => {
            console.log('🎯 Hit test results:', response)
            if (response.results.length > 0) {
              response.results.forEach((result: any, index: number) => {
                console.log(`🎯 Hit result ${index}:`, result)
                if (result.graphic) {
                  console.log(`🎯 Graphic ${index} attributes:`, result.graphic.attributes)
                  console.log(`🎯 Graphic ${index} geometry:`, result.graphic.geometry)
                  console.log(`🎯 Graphic ${index} layer:`, result.graphic.layer?.title)
                }
              })
            }
          }).catch((error: any) => {
            console.warn('⚠️ Hit test failed:', error)
          })
        })

        // Note: Removed automatic zoom to prevent map from jumping to layer extent
        // Users can manually zoom to see the layer data at zoom level 15+

      } catch (itemErr) {
        console.error(`❌ Error processing CityGML item ${item.title}:`, itemErr)
        
        // Show user-friendly error
        if (itemErr instanceof Error) {
          if (itemErr.message.includes('token') || itemErr.message.includes('auth')) {
            error.value = `Authentifizierung für CityGML-Daten fehlgeschlagen`
          } else if (itemErr.message.includes('CORS')) {
            error.value = `CORS-Fehler beim Laden der CityGML-Daten`
          } else {
            error.value = `Fehler beim Laden der CityGML-Daten: ${itemErr.message}`
          }
        }
      }
    }

  } catch (err) {
    console.error('❌ Error adding CityGML FeatureLayer:', err)
    error.value = `Failed to add CityGML data: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// Setup sketch functionality for line drawing
const setupSketchViewModel = (SketchViewModel: any) => {
  try {
    if (!mapView || !drawingLayer) {
      console.warn('⚠️ MapView or drawing layer not ready for sketch setup')
      return
    }

    console.log('🖊️ Setting up sketch functionality')

    // Create SketchViewModel
    sketchViewModel = new SketchViewModel({
      view: mapView,
      layer: drawingLayer,
      creationMode: 'single', // Only allow one line at a time
      updateOnGraphicClick: false, // Disable editing after creation
      pointSymbol: {
        type: 'simple-marker',
        color: [255, 0, 0],
        size: 8,
        outline: {
          color: [255, 255, 255],
          width: 2
        }
      },
      polylineSymbol: {
        type: 'simple-line',
        color: [255, 0, 0, 0.8],
        width: 3,
        cap: 'round',
        join: 'round'
      }
    })

    // Listen for create events
    sketchViewModel.on('create', (event: any) => {
      if (event.state === 'complete') {
        console.log('✏️ Line drawing completed:', event)
        
        const graphic = event.graphic
        if (graphic && graphic.geometry) {
          // Generate unique ID for the line
          const lineId = `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          
          // Store the line ID in the graphic's attributes for later deletion
          graphic.attributes = {
            lineId: lineId,
            createdAt: new Date().toISOString()
          }
          
          // Emit the line data
          emit('lineDrawn', {
            geometry: graphic.geometry.toJSON(),
            id: lineId
          })
          
          console.log('✅ Line emitted with ID:', lineId)
        }
      }
    })

    console.log('✅ Sketch functionality setup complete')

  } catch (err) {
    console.error('❌ Error setting up sketch functionality:', err)
    error.value = `Failed to setup drawing: ${err instanceof Error ? err.message : 'Unknown error'}`
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

// Watch for portal items changes
watch(() => props.portalItems, async (newPortalItems) => {
  console.log('👀 Portal items changed in 2D map:', { count: newPortalItems?.length || 0 })
  
  if (mapView && map) {
    // Remove existing CityGML layers
    const layersToRemove = map.layers.filter((layer: any) => 
      layer.title?.includes('(CityGML)')
    )
    layersToRemove.forEach((layer: any) => map.remove(layer))
    
    // Add new CityGML portal items if available
    if (newPortalItems && newPortalItems.length > 0) {
      await addCityGmlFeatureLayer()
    }
  } else {
    console.log('⚠️ Map not ready, will update when initialized')
  }
}, { deep: true })

// Clear all drawn lines from the map
const clearDrawnLinesFromMap = () => {
  if (drawingLayer) {
    console.log('🧹 Clearing all drawn lines from map')
    drawingLayer.removeAll()
    console.log('✅ All drawn lines removed from map')
  } else {
    console.warn('⚠️ Drawing layer not available for clearing')
  }
}

// Delete a specific line from the map by ID
const deleteLineFromMap = (lineId: string) => {
  if (drawingLayer) {
    console.log('🗑️ Attempting to delete line from map:', lineId)
    // Find and remove the graphic with the matching line ID
    const graphicsToRemove = drawingLayer.graphics.filter((graphic: any) => {
      return graphic.attributes && graphic.attributes.lineId === lineId
    })
    
    if (graphicsToRemove.length > 0) {
      drawingLayer.removeMany(graphicsToRemove)
      console.log('✅ Line removed from map:', lineId)
    } else {
      console.warn('⚠️ Line not found on map:', lineId)
    }
  } else {
    console.warn('⚠️ Drawing layer not available for line deletion')
  }
}

// Expose functions to parent component
defineExpose({
  clearDrawnLines: clearDrawnLinesFromMap,
  deleteLine: deleteLineFromMap
})

// Watch for drawing mode changes
watch(() => props.drawingMode, (newDrawingMode) => {
  console.log('👀 Drawing mode changed:', newDrawingMode)
  
  if (sketchViewModel) {
    if (newDrawingMode) {
      console.log('✏️ Activating line drawing mode')
      sketchViewModel.create('polyline')
    } else {
      console.log('🚫 Deactivating line drawing mode')
      sketchViewModel.cancel()
    }
  } else {
    console.warn('⚠️ SketchViewModel not ready for drawing mode change')
  }
})

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
