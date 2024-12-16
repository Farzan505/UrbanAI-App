import { ref, computed } from 'vue'
import type { Feature, MapModules } from '../types/map'

const ZOOM_THRESHOLD = 14

export function useMapLayers() {
  const error = ref<string | null>(null)

  const createLayerRenderers = (
    modules: MapModules,
    featureProperty: string,
    colorProperty: string,
    values: string[]
  ) => {
    const { UniqueValueRenderer, SimpleFillSymbol, SimpleMarkerSymbol } = modules

    // Generate color map
    const colors = [
      "#fc3e5aff", "#fce138ff", "#4c81cdff", "#f1983cff", "#48885cff",
      "#a553b7ff", "#fff799ff", "#b1a9d0ff", "#6ecffcff", "#fc6f84ff",
      "#6af689ff", "#fcd27eff"
    ]
    const colorMap: Record<string, string> = {}
    values.forEach((value, index) => {
      const color = colors[index % colors.length]
      const rgbaColor = color.replace(/ff$/, 'cc')
      colorMap[String(value)] = rgbaColor
    })

    console.log('Creating renderers for values:', values)
    console.log('Color map:', colorMap)

    // Create renderers with enhanced styling
    const fillRenderer = new UniqueValueRenderer({
      field: colorProperty,
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
      field: colorProperty,
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

    return { fillRenderer, pointRenderer }
  }

  const createGeoJSONLayers = async (
    modules: MapModules,
    filteredData: { type: string; features: Feature[] },
    selectedFeature: string,
    colorProperty: string,
    mapData: any,
    renderers: { fillRenderer: any; pointRenderer: any }
  ) => {
    console.log('Creating GeoJSON layers with data:', {
      featureCount: filteredData.features.length,
      selectedFeature,
      colorProperty,
      sampleFeature: filteredData.features[0]
    })

    const { GeoJSONLayer } = modules

    // Create GeoJSON blob
    const geojsonBlob = new Blob([JSON.stringify(filteredData)], { type: "application/json" })
    const geojsonUrl = URL.createObjectURL(geojsonBlob)

    console.log('Created GeoJSON URL:', geojsonUrl)

    // Create layers with zoom-based visibility
    const detailedLayer = new GeoJSONLayer({
      url: geojsonUrl,
      renderer: renderers.fillRenderer,
      outFields: ["*"],
      title: "Detailed View",
      popupTemplate: {
        title: "{gebid}",
        content: [{
          type: "fields",
          fieldInfos: Object.keys(mapData.features[0].properties).map(prop => ({
            fieldName: prop,
            label: prop
          }))
        }]
      },
      visible: true
    })

    const overviewLayer = new GeoJSONLayer({
      url: geojsonUrl,
      renderer: renderers.pointRenderer,
      outFields: ["*"],
      title: "Overview",
      popupTemplate: {
        title: "{gebid}",
        content: [{
          type: "fields",
          fieldInfos: Object.keys(mapData.features[0].properties).map(prop => ({
            fieldName: prop,
            label: prop
          }))
        }]
      },
      visible: true
    })

    try {
      console.log('Loading GeoJSON layers...')
      // Wait for layers to load
      await Promise.all([
        detailedLayer.load(),
        overviewLayer.load()
      ])
      console.log('GeoJSON layers loaded successfully')

      // Verify layers have features
      const detailedFeatures = await detailedLayer.queryFeatures()
      const overviewFeatures = await overviewLayer.queryFeatures()
      
      console.log('Layer features count:', {
        detailed: detailedFeatures.features.length,
        overview: overviewFeatures.features.length
      })

      if (!detailedFeatures.features.length || !overviewFeatures.features.length) {
        throw new Error('Layers loaded but no features found')
      }

    } catch (err) {
      console.error('Error loading GeoJSON layers:', err)
      throw err
    }

    return { detailedLayer, overviewLayer }
  }

  const updateMapLayers = async (
    modules: MapModules,
    mapView: any,
    mapData: any,
    selectedFeature: string[],
    selectedValues: string[],
    filteredFeatures: Feature[],
    groupLayer: any,
    colorProperty: string[]
  ) => {
    if (!mapData?.features || !groupLayer || !selectedFeature[0] || !colorProperty[0]) {
      console.log('Missing required data for updating layers:', {
        hasMapData: !!mapData?.features,
        hasGroupLayer: !!groupLayer,
        selectedFeature,
        colorProperty
      })
      return
    }

    try {
      console.log('Updating map layers with:', {
        features: filteredFeatures.length,
        selectedFeature: selectedFeature[0],
        colorProperty: colorProperty[0],
        selectedValues
      })

      // Create filtered GeoJSON
      const filteredData = {
        type: "FeatureCollection",
        features: filteredFeatures
      }

      // Extract unique values for coloring based on colorProperty
      const values = [...new Set(filteredData.features.map(
        (feature: Feature) => feature.properties[colorProperty[0]]
      ))]

      console.log('Unique values for rendering:', values)

      // Create renderers using colorProperty
      const renderers = createLayerRenderers(modules, selectedFeature[0], colorProperty[0], values)

      // Create layers
      const layers = await createGeoJSONLayers(
        modules,
        filteredData,
        selectedFeature[0],
        colorProperty[0],
        mapData,
        renderers
      )

      // Update group layer
      console.log('Removing existing layers from group layer...')
      groupLayer.removeAll()

      console.log('Adding new layers to group layer...')
      await Promise.all([
        groupLayer.add(layers.detailedLayer),
        groupLayer.add(layers.overviewLayer)
      ])

      // Add zoom change handler to control layer visibility
      if (mapView) {
        // Initial visibility based on current zoom
        const currentZoom = mapView.zoom
        layers.detailedLayer.visible = currentZoom >= ZOOM_THRESHOLD
        layers.overviewLayer.visible = currentZoom < ZOOM_THRESHOLD

        // Watch for zoom changes
        mapView.watch('zoom', (newZoom: number) => {
          layers.detailedLayer.visible = newZoom >= ZOOM_THRESHOLD
          layers.overviewLayer.visible = newZoom < ZOOM_THRESHOLD
        })
      }

      // Update legend
      if (mapView) {
        const legend = mapView.ui.find((widget: any) => 
          widget.container?.className?.includes('esri-legend')
        )
        if (legend) {
          legend.layerInfos = [{
            layer: groupLayer,
            title: colorProperty[0]
          }]
        }
      }

      // Zoom to filtered features extent if needed
      if (selectedValues.length > 0 && filteredData.features.length > 0) {
        const layerArray = groupLayer.layers.toArray()
        if (layerArray.length > 0) {
          await layerArray[0].when()
          const extent = await layerArray[0].queryExtent()
          if (extent && extent.extent) {
            mapView.goTo(extent.extent, { duration: 1000 })
          }
        }
      }

      console.log('Map layers updated successfully')

    } catch (err: any) {
      error.value = err.message || 'Error updating map layers'
      console.error('Map layer update error:', err)
      throw err
    }
  }

  return {
    error,
    updateMapLayers
  }
}
