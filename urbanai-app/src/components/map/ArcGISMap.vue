<template>
  <div class="flex flex-col gap-4">
    <Card class="w-full">
      <CardHeader class="py-2 border-b">
        <CardTitle class="text-lg">Karte</CardTitle>
        <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
      </CardHeader>
      <CardContent class="p-0 h-[500px]">
        <div v-if="loading" class="w-full h-full">
          <Skeleton class="h-full w-full shadow-none" />
        </div>
        <div v-else ref="mapContainer" id="viewDiv" class="w-full h-full">
          <MapUI
            :available-columns="availableColumns"
            :unique-values="uniqueValues"
            :selected-feature="selectedFeature"
            :selected-values="selectedValues"
            :color-property="colorProperty"
            :map-data="mapData"
            @update:selected-feature="onFeatureChange"
            @update:selected-values="onValueChange"
            @update:color-property="onColorChange"
          />
        </div>
      </CardContent>
    </Card>

    <ChartPanel
      :color-property="colorProperty"
      :filtered-features="filteredFeatures"
      :loading="loading"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, computed, nextTick, onUnmounted } from 'vue'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import MapUI from './MapUI.vue'
import ChartPanel from './ChartPanel.vue'
import { useMapData } from '../../composables/useMapData'
import { useArcGISMap } from '../../composables/useArcGISMap'
import { useMapLayers } from '../../composables/useMapLayers'
import { useMapTheme } from '../../composables/useMapTheme'
import type { Feature } from '../../types/map'

// State
const mapContainer = ref<HTMLElement | null>(null)
const { mapData, loading, fetchMapData } = useMapData()
const { currentBasemap } = useMapTheme()
const colorProperty = ref<string[]>([])

// Initialize composables
const {
  mapView,
  map,
  groupLayer,
  selectedFeature,
  selectedValues,
  availableColumns,
  uniqueValues,
  error,
  loadArcGISModules,
  loadArcGISResources,
  initializeMap,
  cleanup
} = useArcGISMap()

const { updateMapLayers } = useMapLayers()

// Computed
const filteredFeatures = computed(() => {
  if (!mapData.value?.features || !selectedFeature.value[0]) return []

  if (selectedValues.value.length === 0) return mapData.value.features

  return mapData.value.features.filter(feature => 
    selectedValues.value.includes(String(feature.properties[selectedFeature.value[0]]))
  )
})

// Event handlers
const onFeatureChange = (value: string[]) => {
  console.log('Feature changed:', value)
  selectedFeature.value = value
  // Set color property to match selected feature by default if not already set
  if (colorProperty.value.length === 0) {
    colorProperty.value = value
  }
}

const onValueChange = (value: string[]) => {
  console.log('Values changed:', value)
  selectedValues.value = value
}

const onColorChange = (value: string[]) => {
  console.log('Color property changed:', value)
  colorProperty.value = value
}

// Initialize map
const initializeArcGIS = async () => {
  try {
    console.log('Initializing ArcGIS...')
    await loadArcGISResources()
    await loadArcGISModules()
    await nextTick()

    const data = await fetchMapData()
    if (!data || !mapContainer.value) return

    console.log('Map data loaded:', {
      features: data.features.length,
      properties: data.features[0]?.properties
    })

    // Set available columns from the first feature's properties
    if (data.features.length > 0) {
      availableColumns.value = Object.keys(data.features[0].properties)
      
      // Set initial feature selection if none selected
      if (!selectedFeature.value.length) {
        selectedFeature.value = [availableColumns.value[0]]
        colorProperty.value = [availableColumns.value[0]] // Set initial color property
        console.log('Initial feature selected:', selectedFeature.value[0])
      }
      
      // Update unique values
      uniqueValues.value = [...new Set(data.features.map(
        feature => String(feature.properties[selectedFeature.value[0]])
      ))].sort()
      
      console.log('Unique values:', uniqueValues.value)
    }

    const modules = (window as any).arcgisModules
    if (!modules) return

    console.log('Initializing map view...')
    await initializeMap(mapContainer.value, currentBasemap.value, modules)

    // Add picker panel to map UI
    const pickerContainer = document.getElementById("pickerContainer")
    if (pickerContainer && mapView.value) {
      const Expand = modules.Expand
      const pickerExpand = new Expand({
        view: mapView.value,
        content: pickerContainer,
        expandIconClass: "esri-icon-filter",
        group: "top-right"
      })
      mapView.value.ui.add(pickerExpand, "top-right")
    }

    console.log('Updating initial map layers...')
    // Update layers with initial data
    await updateMapLayers(
      modules,
      mapView.value,
      mapData.value,
      selectedFeature.value,
      selectedValues.value,
      filteredFeatures.value,
      groupLayer.value,
      colorProperty.value
    )

  } catch (err) {
    console.error('Error initializing ArcGIS:', err)
    error.value = 'Failed to initialize map'
  }
}

// Watchers
watch(selectedFeature, () => {
  console.log('Selected feature changed:', selectedFeature.value)
  if (mapData.value?.features) {
    uniqueValues.value = [...new Set(mapData.value.features.map(
      feature => String(feature.properties[selectedFeature.value[0]])
    ))].sort()
    console.log('Updated unique values:', uniqueValues.value)
  }
  selectedValues.value = []
  
  const modules = (window as any).arcgisModules
  if (modules) {
    updateMapLayers(
      modules,
      mapView.value,
      mapData.value,
      selectedFeature.value,
      selectedValues.value,
      filteredFeatures.value,
      groupLayer.value,
      colorProperty.value
    )
  }
})

watch(selectedValues, () => {
  console.log('Selected values changed:', selectedValues.value)
  const modules = (window as any).arcgisModules
  if (modules) {
    updateMapLayers(
      modules,
      mapView.value,
      mapData.value,
      selectedFeature.value,
      selectedValues.value,
      filteredFeatures.value,
      groupLayer.value,
      colorProperty.value
    )
  }
})

watch(colorProperty, () => {
  console.log('Color property changed:', colorProperty.value)
  const modules = (window as any).arcgisModules
  if (modules) {
    updateMapLayers(
      modules,
      mapView.value,
      mapData.value,
      selectedFeature.value,
      selectedValues.value,
      filteredFeatures.value,
      groupLayer.value,
      colorProperty.value
    )
  }
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

// Lifecycle hooks
onMounted(() => {
  initializeArcGIS()
})

onUnmounted(() => {
  cleanup()
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
