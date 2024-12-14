<template>
  <Card class="w-full h-full">
    <CardHeader class="py-2 border-b">
      <CardTitle class="text-lg">Karte</CardTitle>
      <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
    </CardHeader>
    <CardContent class="p-0 h-[calc(100%-3.5rem)]">
      <div v-if="loading" class="w-full h-full">
        <Skeleton class="h-full w-full shadow-none" />
      </div>
      <div v-else ref="mapContainer" id="viewDiv" class="w-full h-full"></div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed, nextTick, onUnmounted, shallowRef } from 'vue'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useColorMode } from '@vueuse/core'
import { useMapData } from '@/composables/useMapData'

interface Feature {
  id: string
  type: "Feature"
  properties: Record<string, any>
  geometry: any
}

declare const require: {
  (modules: string[], callback: (...args: any[]) => void): void
}

const ARCGIS_API_KEY = import.meta.env.VITE_ARCGIS_API
const selectedFeature = ref<string[]>(['gebort'])
const mapView = shallowRef<any>(null)
const mapContainer = ref<HTMLElement | null>(null)
const map = shallowRef<any>(null)
const groupLayer = shallowRef<any>(null)

const { mapData, error, loading, fetchMapData } = useMapData()

// Theme handling
const colorMode = useColorMode()
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

// Basemap styles
const LIGHT_BASEMAP = "arcgis/light-gray"
const DARK_BASEMAP = "arcgis/dark-gray"

const currentBasemap = computed(() => {
  if (colorMode.value === 'auto') {
    return prefersDark.matches ? DARK_BASEMAP : LIGHT_BASEMAP
  }
  return colorMode.value === 'dark' ? DARK_BASEMAP : LIGHT_BASEMAP
})

function loadArcGISModules(): Promise<void> {
  return new Promise((resolve, reject) => {
    require([
      "esri/config",
      "esri/Map",
      "esri/views/MapView",
      "esri/layers/GeoJSONLayer",
      "esri/layers/GroupLayer",
      "esri/renderers/UniqueValueRenderer",
      "esri/renderers/SimpleRenderer",
      "esri/symbols/SimpleFillSymbol",
      "esri/symbols/SimpleMarkerSymbol",
      "esri/widgets/Legend",
      "esri/widgets/Expand"
    ], function(
      esriConfig: any,
      Map: any,
      MapView: any,
      GeoJSONLayer: any,
      GroupLayer: any,
      UniqueValueRenderer: any,
      SimpleRenderer: any,
      SimpleFillSymbol: any,
      SimpleMarkerSymbol: any,
      Legend: any,
      Expand: any
    ) {
      try {
        (window as any).arcgisModules = {
          esriConfig,
          Map,
          MapView,
          GeoJSONLayer,
          GroupLayer,
          UniqueValueRenderer,
          SimpleRenderer,
          SimpleFillSymbol,
          SimpleMarkerSymbol,
          Legend,
          Expand
        }
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  })
}

async function initializeMap() {
  const data = await fetchMapData()
  if (!data || !mapContainer.value) return

  const modules = (window as any).arcgisModules
  if (!modules) return

  try {
    const {
      esriConfig,
      Map,
      MapView,
      GeoJSONLayer,
      GroupLayer,
      UniqueValueRenderer,
      SimpleFillSymbol,
      SimpleMarkerSymbol,
      Legend,
      Expand
    } = modules

    esriConfig.apiKey = ARCGIS_API_KEY

    const geojsonBlob = new Blob([JSON.stringify(data)], { type: "application/json" })
    const geojsonUrl = URL.createObjectURL(geojsonBlob)

    // Extract unique values for coloring
    const uniqueValues = [...new Set(data.features.map(
      (feature: Feature) => feature.properties[selectedFeature.value[0]]
    ))]
    
    // Generate color map
    const colors = ["#fc3e5aff", "#fce138ff", "#4c81cdff", "#f1983cff", "#48885cff", 
                   "#a553b7ff", "#fff799ff", "#b1a9d0ff", "#6ecffcff", "#fc6f84ff", 
                   "#6af689ff", "#fcd27eff"]
    const colorMap: Record<string, string> = {}
    uniqueValues.forEach((value, index) => {
      const color = colors[index % colors.length]
      const rgbaColor = color.replace(/ff$/, 'cc')
      colorMap[String(value)] = rgbaColor
    })

    // Create renderers
    const fillRenderer = new UniqueValueRenderer({
      field: selectedFeature.value[0],
      uniqueValueInfos: uniqueValues.map(value => ({
        value: value,
        symbol: new SimpleFillSymbol({
          color: colorMap[String(value)],
          outline: {
            color: colorMap[String(value)].replace('cc', 'ff'),
            width: 1
          }
        }),
        label: String(value)
      }))
    })

    const pointRenderer = new UniqueValueRenderer({
      field: selectedFeature.value[0],
      uniqueValueInfos: uniqueValues.map(value => ({
        value: value,
        symbol: new SimpleMarkerSymbol({
          color: colorMap[String(value)],
          size: 6,
          outline: {
            color: [255, 255, 255, 0.7],
            width: 0.5
          }
        }),
        label: String(value)
      }))
    })

    // Create layers
    const detailedLayer = new GeoJSONLayer({
      url: geojsonUrl,
      renderer: fillRenderer,
      outFields: ["*"],
      popupTemplate: {
        title: "{gebid}",
        content: [{
          type: "fields",
          fieldInfos: Object.keys(data.features[0].properties).map(prop => ({
            fieldName: prop,
            label: prop
          }))
        }]
      },
      minScale: 10000,
      maxScale: 0
    })

    const overviewLayer = new GeoJSONLayer({
      url: geojsonUrl,
      renderer: pointRenderer,
      outFields: ["*"],
      popupTemplate: {
        title: "{gebid}",
        content: [{
          type: "fields",
          fieldInfos: Object.keys(data.features[0].properties).map(prop => ({
            fieldName: prop,
            label: prop
          }))
        }]
      },
      minScale: 0,
      maxScale: 10000
    })

    const newGroupLayer = new GroupLayer({
      layers: [detailedLayer, overviewLayer]
    })

    groupLayer.value = newGroupLayer

    // Create or update map instance
    if (!map.value) {
      map.value = new Map({
        basemap: currentBasemap.value
      })
    } else {
      map.value.basemap = currentBasemap.value
    }

    map.value.layers.removeAll()
    map.value.add(groupLayer.value)

    // Create or update view
    if (!mapView.value) {
      mapView.value = new MapView({
        container: mapContainer.value,
        map: map.value,
        zoom: 12,
        center: [11.5820, 48.1351]
      })

      // Handle click events
      mapView.value.on("click", (event: { mapPoint: any }) => {
        mapView.value.hitTest(event).then((response: { results: any[] }) => {
          const results = response.results.filter((result: { graphic: any; layer: any }) => 
            result.graphic && result.graphic.layer && 
            (result.graphic.layer === detailedLayer || result.graphic.layer === overviewLayer)
          )
          
          if (results.length > 0) {
            const graphic = results[0].graphic
            const attributes = graphic.attributes
            window.dispatchEvent(new CustomEvent('mapSelection', { 
              detail: attributes 
            }))
            mapView.value.popup.open({
              location: event.mapPoint,
              features: [graphic]
            })
          }
        })
      })
    }

    // Wait for the view to be ready
    await mapView.value.when()

    // Add legend
    const legend = new Legend({
      view: mapView.value,
      layerInfos: [{
        layer: groupLayer.value,
        title: selectedFeature.value[0]
      }]
    })

    const legendExpand = new Expand({
      view: mapView.value,
      content: legend,
      expandIconClass: "esri-icon-layer-list",
      group: "top-right"
    })

    // Clear existing UI components
    mapView.value.ui.empty("top-right")
    mapView.value.ui.add(legendExpand, "top-right")

    // Zoom to data extent
    await detailedLayer.when()
    const extent = await detailedLayer.queryExtent()
    if (extent && extent.extent) {
      mapView.value.goTo(extent.extent, { duration: 1000 })
    }

  } catch (err: any) {
    error.value = err.message || 'Error initializing map'
    console.error('Map initialization error:', err)
  }
}

// Handle theme changes
watch(currentBasemap, async () => {
  try {
    if (map.value) {
      map.value.basemap = currentBasemap.value
    }
  } catch (err) {
    console.error('Error updating theme:', err)
  }
})

// System theme change listener
prefersDark.addEventListener('change', (e) => {
  if (colorMode.value === 'auto') {
    console.log('System theme changed:', e.matches ? 'dark' : 'light')
  }
})

async function initializeArcGIS() {
  try {
    // Load ArcGIS CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css'
    document.head.appendChild(link)

    // Load ArcGIS JavaScript
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://js.arcgis.com/4.29/'
      script.onload = () => resolve()
      script.onerror = reject
      document.head.appendChild(script)
    })

    await loadArcGISModules()
    await nextTick()
    await initializeMap()
  } catch (err) {
    console.error('Error initializing ArcGIS:', err)
    error.value = 'Failed to initialize map'
  }
}

onMounted(() => {
  initializeArcGIS()
})

onUnmounted(() => {
  try {
    if (mapView.value) {
      mapView.value.container = null
      mapView.value = null
    }
    if (mapContainer.value) {
      mapContainer.value.innerHTML = ''
    }
    map.value = null
    groupLayer.value = null
  } catch (err) {
    console.error('Error during cleanup:', err)
  }
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
