import { ref, shallowRef } from 'vue'
import type { MapModules, MapState } from '../types/map'

const ARCGIS_API_KEY = import.meta.env.VITE_ARCGIS_API

// Define require type more precisely
declare function require(
  modules: string[],
  callback: (...args: any[]) => void
): void;

export function useArcGISMap() {
  // Create refs with proper typing
  const mapView = shallowRef<any>(null)
  const map = shallowRef<any>(null)
  const groupLayer = shallowRef<any>(null)
  const selectedFeature = ref<string[]>([])
  const selectedValues = ref<string[]>([])
  const availableColumns = ref<string[]>([])
  const uniqueValues = ref<string[]>([])
  const error = ref<string | null>(null)

  const loadArcGISModules = (): Promise<void> => {
    console.log('Loading ArcGIS modules...')
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
        Expand: any,
        LayerList: any
      ) {
        try {
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
          console.log('ArcGIS modules loaded successfully')
          resolve()
        } catch (err) {
          console.error('Error loading ArcGIS modules:', err)
          reject(err)
        }
      })
    })
  }

  const loadArcGISResources = async () => {
    console.log('Loading ArcGIS resources...')
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
        script.onload = () => {
          console.log('ArcGIS JavaScript loaded')
          resolve()
        }
        script.onerror = (err) => {
          console.error('Error loading ArcGIS JavaScript:', err)
          reject(err)
        }
        document.head.appendChild(script)
      })

      console.log('ArcGIS resources loaded successfully')
    } catch (err) {
      console.error('Error loading ArcGIS resources:', err)
      throw err
    }
  }

  const initializeMap = async (
    container: HTMLElement,
    basemap: string,
    modules: MapModules
  ) => {
    try {
      console.log('Initializing map with basemap:', basemap)
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

      // Create map instance first
      map.value = new Map({
        basemap: basemap
      })

      // Create view
      mapView.value = new MapView({
        container,
        map: map.value,
        zoom: 12,
        center: [11.5820, 48.1351],
        ui: {
          components: ["zoom", "compass", "attribution"]
        }
      })

      // Create and add group layer
      const newGroupLayer = new GroupLayer({
        title: "Features",
        visibilityMode: "exclusive"
      })
      groupLayer.value = newGroupLayer
      map.value.add(groupLayer.value)

      console.log('Group layer added to map')

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
          title: selectedFeature.value[0]
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

      mapView.value.ui.add([legendExpand, layerListExpand], "top-left")

      // Wait for view to be ready
      await mapView.value.when()
      console.log('Map view initialized successfully')

      return mapView.value
    } catch (err: any) {
      error.value = err.message || 'Error initializing map'
      console.error('Map initialization error:', err)
      throw err
    }
  }

  const cleanup = () => {
    console.log('Cleaning up map resources...')
    try {
      if (mapView.value) {
        mapView.value.container = null
        mapView.value = null
      }
      if (map.value) {
        map.value.removeAll()
        map.value = null
      }
      if (groupLayer.value) {
        groupLayer.value.removeAll()
        groupLayer.value = null
      }
      console.log('Map cleanup completed')
    } catch (err) {
      console.error('Error during cleanup:', err)
    }
  }

  return {
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
  }
}
