<template>
  <Card class="w-full h-full">
    <CardHeader class="py-2 border-b">
      <CardTitle class="text-lg">Karte</CardTitle>
      <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
    </CardHeader>
    <CardContent class="p-0 flex flex-col h-[calc(100%-3.5rem)]">
      <div v-if="loading" class="w-full h-full">
        <Skeleton class="h-full w-full shadow-none" />
      </div>
      <div v-else class="flex flex-col h-full">
        <!-- Map Container -->
        <div ref="mapContainer" id="viewDiv" class="w-full" style="height: 70%;">
          <calcite-panel id="pickerContainer" heading="Filter Features" width-scale="l" height-scale="l">
            <div class="panel-content">
              <calcite-label>Filter Property</calcite-label>
              <calcite-combobox id="featurePicker" placeholder="Pick a Feature Property" selection-mode="single" overlay-positioning="fixed">
              </calcite-combobox>
              
              <calcite-label>Filter Values</calcite-label>
              <calcite-combobox id="valuePicker" placeholder="Select Values" selection-mode="multiple" overlay-positioning="fixed">
              </calcite-combobox>

              <calcite-label>Color By Property</calcite-label>
              <calcite-combobox id="colorPicker" placeholder="Select Property for Colors" selection-mode="single" overlay-positioning="fixed">
              </calcite-combobox>
            </div>
          </calcite-panel>
        </div>

        <!-- Chart Section -->
        <div class="w-full p-4 bg-background" style="height: 30%;">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-lg font-semibold">Category Distribution</h3>
            <div class="text-sm text-muted-foreground">
              {{ colorByProperty ? `Distribution for: ${colorByProperty}` : 'Select a property for visualization' }}
            </div>
          </div>
          <calcite-chart
            id="statsChart"
            type="pie"
            height-scale="l"
            width-scale="l"
            :data="chartData"
            :config="{
              margins: { top: 20, right: 20, bottom: 40, left: 40 },
              colors: chartColors
            }">
          </calcite-chart>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed, nextTick, onUnmounted, shallowRef } from 'vue'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useColorMode } from '@vueuse/core'
import { useMapData } from '../../composables/useMapData'

// Interfaces
interface Feature {
  id: string
  type: "Feature"
  properties: Record<string, any>
  geometry: any
}

interface CalciteCombobox extends HTMLElement {
  value: string
  selectedItems: Array<{ value: string }>
}

interface CalciteComboboxItem extends HTMLElement {
  value: string
  setAttribute(name: string, value: string): void
}

// Define require type
declare function require(
  modules: string[],
  callback: (...modules: any[]) => void
): void;

// Constants
const ARCGIS_API_KEY = import.meta.env.VITE_ARCGIS_API
const ZOOM_THRESHOLD = 14  // Threshold for switching between detailed and overview views
const CHART_COLORS = [
  '#fc3e5aff', '#fce138ff', '#4c81cdff', '#f1983cff', '#48885cff', 
  '#a553b7ff', '#fff799ff', '#b1a9d0ff', '#6ecffcff', '#fc6f84ff', 
  '#6af689ff', '#fcd27eff'
]

// State
const mapContainer = ref<HTMLElement | null>(null)
const mapView = shallowRef<any>(null)
const map = shallowRef<any>(null)
const groupLayer = shallowRef<any>(null)
const selectedFeature = ref<string[]>([])
const selectedValues = ref<string[]>([])
const colorByProperty = ref<string>('')
const availableColumns = ref<string[]>([])
const uniqueValues = ref<string[]>([])
const error = ref<string | null>(null)

const { mapData, loading, fetchMapData } = useMapData()

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

// Computed properties
const chartData = computed(() => {
  if (!mapData.value?.features || !colorByProperty.value) return []

  const features = selectedValues.value.length > 0 ? filteredFeatures.value : mapData.value.features

  const valueCounts = features.reduce((acc: Record<string, number>, feature: Feature) => {
    const value = String(feature.properties[colorByProperty.value])
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})

  return Object.entries(valueCounts).map(([value, count]) => ({
    name: value,
    value: count
  })).sort((a, b) => b.value - a.value) // Sort by count descending
})

const chartColors = computed(() => {
  return CHART_COLORS.map(color => color.replace(/ff$/, 'cc'))
})

const filteredFeatures = computed(() => {
  if (!mapData.value?.features || !selectedFeature.value[0]) return []

  if (selectedValues.value.length === 0) return mapData.value.features

  return mapData.value.features.filter(feature => 
    selectedValues.value.includes(String(feature.properties[selectedFeature.value[0]]))
  )
})

// Functions
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
      "esri/widgets/Expand",
      "esri/widgets/LayerList"
    ], (...modules) => {
      try {
        const [
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
          Expand,
          LayerList
        ] = modules

        ;(window as any).arcgisModules = {
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
          Expand,
          LayerList
        }
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  })
}

function updateUniqueValues() {
  if (!mapData.value?.features || !selectedFeature.value[0]) return

  uniqueValues.value = [...new Set(mapData.value.features.map(
    feature => String(feature.properties[selectedFeature.value[0]])
  ))].sort()

  const valuePicker = document.getElementById("valuePicker") as CalciteCombobox
  if (valuePicker) {
    valuePicker.innerHTML = ''
    uniqueValues.value.forEach(value => {
      const item = document.createElement("calcite-combobox-item") as CalciteComboboxItem
      item.value = value
      item.setAttribute('text-label', value)
      item.innerHTML = value
      valuePicker.appendChild(item)
    })
  }
}

async function updateMapLayers() {
  if (!mapData.value?.features || !groupLayer.value || !colorByProperty.value) return

  const modules = (window as any).arcgisModules
  if (!modules) return

  try {
    const {
      GeoJSONLayer,
      UniqueValueRenderer,
      SimpleFillSymbol,
      SimpleMarkerSymbol
    } = modules

    // Create filtered GeoJSON
    const filteredData = {
      type: "FeatureCollection",
      features: filteredFeatures.value || []
    }

    // Extract unique values for coloring
    const values = [...new Set(filteredData.features.map(
      (feature: Feature) => feature.properties[colorByProperty.value]
    ))]
    
    // Generate color map
    const colorMap: Record<string, string> = {}
    values.forEach((value, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length]
      const rgbaColor = color.replace(/ff$/, 'cc')
      colorMap[String(value)] = rgbaColor
    })

    // Create renderers with enhanced styling
    const fillRenderer = new UniqueValueRenderer({
      field: colorByProperty.value,
      uniqueValueInfos: values.map(value => ({
        value: value,
        symbol: new SimpleFillSymbol({
          color: colorMap[String(value)],
          outline: {
            color: colorMap[String(value)].replace('cc', 'ff'),
            width: 2
          }
        }),
        label: String(value)
      }))
    })

    const pointRenderer = new UniqueValueRenderer({
      field: colorByProperty.value,
      uniqueValueInfos: values.map(value => ({
        value: value,
        symbol: new SimpleMarkerSymbol({
          color: colorMap[String(value)],
          size: 8,
          outline: {
            color: [255, 255, 255, 0.9],
            width: 1
          }
        }),
        label: String(value)
      }))
    })

    // Create GeoJSON blob
    const geojsonBlob = new Blob([JSON.stringify(filteredData)], { type: "application/json" })
    const geojsonUrl = URL.createObjectURL(geojsonBlob)

    // Create layers with zoom-based visibility
    const detailedLayer = new GeoJSONLayer({
      url: geojsonUrl,
      renderer: fillRenderer,
      outFields: ["*"],
      title: "Detailed View",
      popupTemplate: {
        title: "{gebid}",
        content: [{
          type: "fields",
          fieldInfos: Object.keys(mapData.value.features[0].properties).map(prop => ({
            fieldName: prop,
            label: prop
          }))
        }]
      },
      visible: true  // Will be controlled by zoom level
    })

    const overviewLayer = new GeoJSONLayer({
      url: geojsonUrl,
      renderer: pointRenderer,
      outFields: ["*"],
      title: "Overview",
      popupTemplate: {
        title: "{gebid}",
        content: [{
          type: "fields",
          fieldInfos: Object.keys(mapData.value.features[0].properties).map(prop => ({
            fieldName: prop,
            label: prop
          }))
        }]
      },
      visible: true  // Will be controlled by zoom level
    })

    // Update group layer
    groupLayer.value.removeAll()
    groupLayer.value.add(detailedLayer)
    groupLayer.value.add(overviewLayer)

    // Add zoom change handler to control layer visibility
    if (mapView.value) {
      // Initial visibility based on current zoom
      const currentZoom = mapView.value.zoom;
      detailedLayer.visible = currentZoom >= ZOOM_THRESHOLD;
      overviewLayer.visible = currentZoom < ZOOM_THRESHOLD;

      // Watch for zoom changes
      mapView.value.watch('zoom', (newZoom: number) => {
        detailedLayer.visible = newZoom >= ZOOM_THRESHOLD;
        overviewLayer.visible = newZoom < ZOOM_THRESHOLD;
      });
    }

    // Update legend
    if (mapView.value) {
      const legend = mapView.value.ui.find((widget: any) => widget.container?.className?.includes('esri-legend'))
      if (legend) {
        legend.layerInfos = [{
          layer: groupLayer.value,
          title: colorByProperty.value
        }]
      }
    }

    // Zoom to filtered features extent if needed
    if (selectedValues.value.length > 0 && filteredData.features.length > 0) {
      const layers = groupLayer.value.layers.toArray()
      if (layers.length > 0) {
        await layers[0].when()
        const extent = await layers[0].queryExtent()
        if (extent && extent.extent) {
          mapView.value.goTo(extent.extent, { duration: 1000 })
        }
      }
    }

  } catch (err: any) {
    error.value = err.message || 'Error updating map layers'
    console.error('Map layer update error:', err)
  }
}

async function initializeMap() {
  const data = await fetchMapData()
  if (!data || !mapContainer.value) return

  // Set available columns from the first feature's properties
  if (data.features.length > 0) {
    availableColumns.value = Object.keys(data.features[0].properties)
    updateUniqueValues()
  }

  const modules = (window as any).arcgisModules
  if (!modules) return

  try {
    const {
      esriConfig,
      Map,
      MapView,
      GroupLayer,
      Legend,
      Expand,
      LayerList
    } = modules

    esriConfig.apiKey = ARCGIS_API_KEY

    const newGroupLayer = new GroupLayer({
      title: "Features",
      visibilityMode: "exclusive"
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
        center: [11.5820, 48.1351],
        ui: {
          components: ["zoom", "compass", "attribution"]
        }
      })

      // Handle click events
      mapView.value.on("click", (event: { mapPoint: any }) => {
        mapView.value.hitTest(event).then((response: { results: any[] }) => {
          const results = response.results.filter((result: { graphic: any; layer: any }) => 
            result.graphic && result.graphic.layer && 
            result.graphic.layer.parent === groupLayer.value
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

      // Add legend
      const legend = new Legend({
        view: mapView.value,
        layerInfos: [{
          layer: groupLayer.value,
          title: colorByProperty.value
        }]
      })

      const legendExpand = new Expand({
        view: mapView.value,
        content: legend,
        expandIconClass: "esri-icon-legend",
        group: "top-left"
      })

      // Add layer list
      const layerList = new LayerList({
        view: mapView.value,
        listItemCreatedFunction: (event: any) => {
          const item = event.item
          if (item.layer.type === "group") {
            item.panel = {
              content: "legend",
              open: true
            }
          }
        }
      })

      const layerListExpand = new Expand({
        view: mapView.value,
        content: layerList,
        expandIconClass: "esri-icon-layer-list",
        group: "top-left"
      })

      // Add feature picker panel
      const pickerContainer = document.getElementById("pickerContainer")
      const pickerExpand = new Expand({
        view: mapView.value,
        content: pickerContainer,
        expandIconClass: "esri-icon-filter",
        group: "top-left"
      })

      mapView.value.ui.add([legendExpand, layerListExpand, pickerExpand], "top-left")

      // Initialize feature picker
      const featurePicker = document.getElementById("featurePicker") as CalciteCombobox
      if (featurePicker && data.features.length > 0) {
        const propertyNames = Object.keys(data.features[0].properties)
        propertyNames.forEach(prop => {
          const item = document.createElement("calcite-combobox-item") as CalciteComboboxItem
          item.value = prop
          item.setAttribute('text-label', prop)
          item.innerHTML = prop
          featurePicker.appendChild(item)
        })

        featurePicker.addEventListener("calciteComboboxChange", (event: any) => {
          const selectedProp = event.target.selectedItems[0]?.value
          if (selectedProp) {
            selectedFeature.value = [selectedProp]
            selectedValues.value = []
            updateUniqueValues()
            updateMapLayers()
          }
        })
      }

      // Initialize color picker
      const colorPicker = document.getElementById("colorPicker") as CalciteCombobox
      if (colorPicker && data.features.length > 0) {
        const propertyNames = Object.keys(data.features[0].properties)
        propertyNames.forEach(prop => {
          const item = document.createElement("calcite-combobox-item") as CalciteComboboxItem
          item.value = prop
          item.setAttribute('text-label', prop)
          item.innerHTML = prop
          colorPicker.appendChild(item)
        })

        colorPicker.addEventListener("calciteComboboxChange", (event: any) => {
          const selectedProp = event.target.selectedItems[0]?.value
          if (selectedProp) {
            colorByProperty.value = selectedProp
            updateMapLayers()
          }
        })

        // Set initial color property
        if (!colorByProperty.value && selectedFeature.value[0]) {
          colorByProperty.value = selectedFeature.value[0]
          colorPicker.value = colorByProperty.value
        }
      }

      // Initialize value picker
      const valuePicker = document.getElementById("valuePicker") as CalciteCombobox
      if (valuePicker) {
        valuePicker.addEventListener("calciteComboboxChange", (event: any) => {
          selectedValues.value = event.target.selectedItems.map((item: any) => item.value)
          updateMapLayers()
        })
      }
    }

    // Update layers with initial data
    await updateMapLayers()

    // Wait for layers to load and zoom to extent
    await mapView.value.when()
    const layers = groupLayer.value.layers.toArray()
    if (layers.length > 0) {
      await layers[0].when()
      const extent = await layers[0].queryExtent()
      if (extent && extent.extent) {
        mapView.value.goTo(extent.extent, { duration: 1000 })
      }
    }

  } catch (err: any) {
    error.value = err.message || 'Error initializing map'
    console.error('Map initialization error:', err)
  }
}

async function initializeArcGIS() {
  try {
    // Load ArcGIS CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://js.arcgis.com/4.29/esri/themes/light/main.css'
    document.head.appendChild(link)

    // Load Calcite Components CSS
    const calciteLink = document.createElement('link')
    calciteLink.rel = 'stylesheet'
    calciteLink.href = 'https://js.arcgis.com/calcite-components/2.9.0/calcite.css'
    document.head.appendChild(calciteLink)

    // Load Calcite Components JS
    const calciteScript = document.createElement('script')
    calciteScript.type = 'module'
    calciteScript.src = 'https://js.arcgis.com/calcite-components/2.9.0/calcite.esm.js'
    document.head.appendChild(calciteScript)

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

// Watchers
watch(selectedFeature, () => {
  updateUniqueValues()
  selectedValues.value = []
  if (!colorByProperty.value) {
    colorByProperty.value = selectedFeature.value[0]
    const colorPicker = document.getElementById("colorPicker") as CalciteCombobox
    if (colorPicker) {
      colorPicker.value = colorByProperty.value
    }
  }
  updateMapLayers()
})

watch([selectedValues, colorByProperty], () => {
  updateMapLayers()
})

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

// Lifecycle hooks
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

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  width: 330px;
  height: 500px;
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

.panel-content {
  overflow-y: auto;
  padding-bottom: 12px;
}
</style>
