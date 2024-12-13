<template>
  <Card class="w-full h-full">
    <CardHeader class="py-2 border-b">
      <CardTitle class="text-lg">Karte</CardTitle>
      <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
    </CardHeader>
    <CardContent class="p-0 h-[calc(100%-3.5rem)]">
      <div v-if="loading" class="w-full h-full">
        <Skeleton class="h-full w-full" />
      </div>
      <div v-else id="viewDiv" class="w-full h-full"></div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import axios from 'axios'
import { useTheme } from '@/composables/useTheme'
import { Skeleton } from '../ui/skeleton'

// Type definitions
interface Feature {
  id: string
  type: "Feature"
  properties: Record<string, any>
  geometry: any
}

interface FeatureCollection {
  type: "FeatureCollection"
  features: Feature[]
}

declare const require: {
  (modules: string[], callback: (...args: any[]) => void): void
}

const API_URL = import.meta.env.VITE_API_URL
const mapData = ref<FeatureCollection | null>(null)
const selectedFeature = ref<string[]>(['gebort'])
const error = ref<string>('')
const loading = ref(false)
const mapView = ref<any>(null)

// Get theme
const theme = useTheme()

async function fetchMapData() {
  loading.value = true
  error.value = ''
  
  try {
    console.log('Fetching map data...')
    const token = localStorage.getItem('token')
    if (!token) {
      error.value = 'No authentication token found. Please log in again.'
      console.error(error.value)
      return
    }

    console.log('API URL:', API_URL)
    console.log('Making API request with token:', token.substring(0, 10) + '...')
    
    const response = await axios.get(`${API_URL}/frontend/geometry_retrieve`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    
    console.log('API response status:', response.status)
    console.log('API response data type:', typeof response.data)
    
    // Try to parse the response if it's a string
    let parsedData: FeatureCollection
    if (typeof response.data === 'string') {
      try {
        parsedData = JSON.parse(response.data)
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError)
        error.value = 'Error parsing response data'
        return
      }
    } else {
      parsedData = response.data
    }

    console.log('Parsed data type:', parsedData.type)
    console.log('Features array?', Array.isArray(parsedData.features))
    
    if (parsedData.type !== 'FeatureCollection' || !Array.isArray(parsedData.features)) {
      error.value = 'Invalid GeoJSON data received'
      console.error('Invalid data structure:', parsedData)
      return
    }

    mapData.value = parsedData
    console.log('Features count:', parsedData.features.length)
    console.log('First feature preview:', JSON.stringify(parsedData.features[0]).substring(0, 200))
    console.log('Initializing map...')
    initializeMap()
  } catch (err: any) {
    console.error('Full error object:', err)
    if (err.response) {
      console.error('Error response:', {
        status: err.response.status,
        headers: err.response.headers,
        data: err.response.data
      })
      error.value = `API Error (${err.response.status}): ${err.response.data?.message || 'Unknown error'}`
    } else if (err.request) {
      console.error('No response received:', err.request)
      error.value = 'No response from server. Please check your connection.'
    } else {
      console.error('Request setup error:', err.message)
      error.value = err.message || 'Error fetching map data'
    }
  } finally {
    loading.value = false
  }
}

function initializeMap() {
  const data = mapData.value
  if (!data || !data.features || !data.features.length) {
    error.value = 'No valid map data available'
    return
  }

  console.log('Loading ArcGIS modules...')
  require([
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
      console.log('Creating GeoJSON blob...')
      const geojsonBlob = new Blob([JSON.stringify(data)], { type: "application/json" })
      const geojsonUrl = URL.createObjectURL(geojsonBlob)

      // Extract unique values for coloring
      console.log('Processing map data...')
      const uniqueValues = [...new Set(data.features.map(
        (feature) => feature.properties[selectedFeature.value[0]]
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

      // Create renderers for polygons and points
      console.log('Creating renderers...')
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

      // Create layers for different zoom levels
      console.log('Creating map layers...')
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

      // Group layers
      const groupLayer = new GroupLayer({
        layers: [detailedLayer, overviewLayer]
      })

      console.log('Creating map and view...')
      const map = new Map({
        basemap: theme.value === 'dark' ? "dark-gray-vector" : "gray-vector",
        layers: [groupLayer]
      })

      const view = new MapView({
        container: "viewDiv",
        map: map,
        zoom: 12
      })

      // Store view reference for theme updates
      mapView.value = view

      // Add legend
      console.log('Adding legend...')
      const legend = new Legend({
        view: view,
        layerInfos: [{
          layer: groupLayer,
          title: selectedFeature.value[0]
        }]
      })

      const legendExpand = new Expand({
        view: view,
        content: legend,
        expandIconClass: "esri-icon-layer-list",
        group: "top-right"
      })

      view.ui.add(legendExpand, "top-right")

      // Handle click events
      view.on("click", (event: { mapPoint: any }) => {
        view.hitTest(event).then((response: { results: any[] }) => {
          const results = response.results.filter((result: { graphic: any; layer: any }) => 
            result.graphic && result.graphic.layer && 
            (result.graphic.layer === detailedLayer || result.graphic.layer === overviewLayer)
          )
          
          if (results.length > 0) {
            const graphic = results[0].graphic
            const attributes = graphic.attributes
            // Emit selected data to parent component
            window.dispatchEvent(new CustomEvent('mapSelection', { 
              detail: attributes 
            }))
            view.popup.open({
              location: event.mapPoint,
              features: [graphic]
            })
          }
        })
      })

      // Zoom to data extent
      console.log('Setting initial extent...')
      detailedLayer.when(() => {
        detailedLayer.queryExtent().then((response: { extent: any }) => {
          view.goTo(response.extent)
        }).catch((err: Error) => {
          console.error('Error setting extent:', err)
        })
      })

    } catch (err: any) {
      error.value = err.message || 'Error initializing map'
      console.error('Map initialization error:', err)
    }
  })
}

// Watch for theme changes
watch(() => theme.value, (newTheme) => {
  if (mapView.value) {
    mapView.value.map.basemap = newTheme === 'dark' ? "dark-gray-vector" : "gray-vector"
  }
})

onMounted(() => {
  console.log('Component mounted, loading ArcGIS resources...')
  // Load ArcGIS CSS
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css'
  document.head.appendChild(link)

  // Load ArcGIS JavaScript
  const script = document.createElement('script')
  script.src = 'https://js.arcgis.com/4.29/'
  script.onload = () => {
    console.log('ArcGIS script loaded, fetching data...')
    fetchMapData()
  }
  script.onerror = (err) => {
    error.value = 'Failed to load ArcGIS resources'
    console.error('Script load error:', err)
  }
  document.head.appendChild(script)
})
</script>

<style scoped>
#viewDiv {
  padding: 0;
  margin: 0;
  height: 100%;
  width: 100%;
}
</style>
