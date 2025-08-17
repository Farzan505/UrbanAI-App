// mapping.ts - Thin API layer for ArcGIS API for JavaScript
// Following Esri's recommended patterns for Next.js integration

import { Ref } from 'react'

// Types for our mapping module
export interface MapConfig {
  container: string | HTMLDivElement
  center?: [number, number]
  zoom?: number
  basemap?: string
}

export interface BuildingFeature {
  attributes: {
    ObjectID: number
    Name: string
    Efficiency: string
    Status: string
    [key: string]: any
  }
  geometry: {
    type: string
    x?: number
    y?: number
    rings?: number[][][]
    spatialReference: { wkid: number }
  }
}

// Store map instance and related objects globally
let mapView: any = null
let mapInstance: any = null
let currentFeatureLayer: any = null

// Initialize map with dynamic imports (Esri recommended pattern)
export const initializeMap = async (config: MapConfig) => {
  console.log('🗺️ Initializing ArcGIS Map with config:', config)
  
  try {
    // Dynamic imports to avoid SSR issues
    const [
      { default: Map },
      { default: MapView },
      { default: FeatureLayer },
      { default: Graphic },
      { default: Legend },
      { default: LayerList },
      { default: Expand },
      { default: Fullscreen },
      { default: Search },
      { default: esriConfig }
    ] = await Promise.all([
      import('@arcgis/core/Map'),
      import('@arcgis/core/views/MapView'),
      import('@arcgis/core/layers/FeatureLayer'),
      import('@arcgis/core/Graphic'),
      import('@arcgis/core/widgets/Legend'),
      import('@arcgis/core/widgets/LayerList'),
      import('@arcgis/core/widgets/Expand'),
      import('@arcgis/core/widgets/Fullscreen'),
      import('@arcgis/core/widgets/Search'),
      import('@arcgis/core/config')
    ])

    console.log('✅ ArcGIS modules loaded successfully')

    // Set API key
    esriConfig.apiKey = "AAPK88646347a11d4ca190ec0b00201dc26c8kkfPaCG_kMmrxHsdUiVFuQzgCpecnrd664al4gHRq3VIIKlSV1epDVbEdh7tNJG"

    // Create map
    mapInstance = new Map({
      basemap: config.basemap || "gray-vector"
    })

    // Create view
    mapView = new MapView({
      container: config.container,
      map: mapInstance,
      center: config.center || [11.5820, 48.1351], // Munich coordinates
      zoom: config.zoom || 12,
      constraints: {
        minZoom: 8,
        maxZoom: 20
      }
    })

    // Wait for view to be ready
    await mapView.when()
    console.log('✅ MapView is ready')

    // Add widgets
    const search = new Search({ view: mapView })
    const legend = new Legend({ view: mapView })
    const layerList = new LayerList({ view: mapView })
    const fullscreen = new Fullscreen({ view: mapView })

    const legendExpand = new Expand({
      view: mapView,
      content: legend,
      expandIcon: "layer-list",
      group: "top-right"
    })

    const layerListExpand = new Expand({
      view: mapView,
      content: layerList,
      expandIcon: "layers", 
      group: "top-right"
    })

    // Add widgets to UI
    mapView.ui.add(search, "top-left")
    mapView.ui.add([legendExpand, layerListExpand, fullscreen], "top-right")

    // Add sample buildings data
    await addSampleBuildings()

    console.log('🎉 Map initialization completed successfully')
    return mapView
  } catch (error) {
    console.error('❌ Error initializing map:', error)
    throw error
  }
}

// Add sample building data to the map
export const addSampleBuildings = async () => {
  if (!mapView || !mapInstance) {
    console.warn('⚠️ Map not initialized, cannot add buildings')
    return
  }

  try {
    // Import Graphic and FeatureLayer dynamically
    const [{ default: FeatureLayer }, { default: Graphic }] = await Promise.all([
      import('@arcgis/core/layers/FeatureLayer'),
      import('@arcgis/core/Graphic')
    ])

    // Create sample building graphics
    const sampleBuildings = [
      new Graphic({
        geometry: {
          type: "point",
          x: 11.5820,
          y: 48.1351,
          spatialReference: { wkid: 4326 }
        },
        attributes: {
          ObjectID: 1,
          Name: "Sample Building 1",
          Efficiency: "A+",
          Status: "analyzed",
          GMLID: "DEBY_LOD2_4909255"
        }
      }),
      new Graphic({
        geometry: {
          type: "point", 
          x: 11.5850,
          y: 48.1380,
          spatialReference: { wkid: 4326 }
        },
        attributes: {
          ObjectID: 2,
          Name: "Sample Building 2", 
          Efficiency: "B",
          Status: "pending",
          GMLID: "DEBY_LOD2_4909256"
        }
      }),
      new Graphic({
        geometry: {
          type: "point", 
          x: 11.5790,
          y: 48.1320,
          spatialReference: { wkid: 4326 }
        },
        attributes: {
          ObjectID: 3,
          Name: "Sample Building 3", 
          Efficiency: "C+",
          Status: "analyzed",
          GMLID: "DEBY_LOD2_4909257"
        }
      })
    ]

    // Create feature layer
    currentFeatureLayer = new FeatureLayer({
      source: sampleBuildings,
      objectIdField: "ObjectID",
      title: "Buildings",
      fields: [
        { name: "ObjectID", alias: "ID", type: "oid" },
        { name: "Name", alias: "Building Name", type: "string" },
        { name: "Efficiency", alias: "Energy Efficiency", type: "string" },
        { name: "Status", alias: "Analysis Status", type: "string" },
        { name: "GMLID", alias: "GML ID", type: "string" }
      ],
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-marker",
          color: [51, 51, 204, 0.8],
          outline: {
            color: [255, 255, 255],
            width: 2
          },
          size: 14
        }
      },
      popupTemplate: {
        title: "{Name}",
        content: `
          <div class="p-2">
            <div><strong>Energy Efficiency:</strong> {Efficiency}</div>
            <div><strong>Status:</strong> {Status}</div>
            <div><strong>GML ID:</strong> {GMLID}</div>
            <div class="text-sm text-gray-600 mt-2">
              <a href="/building-analysis?gmlid={GMLID}" target="_blank">
                → View Building Analysis
              </a>
            </div>
          </div>
        `
      }
    })

    // Add layer to map
    mapInstance.add(currentFeatureLayer)

    console.log('✅ Sample buildings added to map')
  } catch (error) {
    console.error('❌ Error adding sample buildings:', error)
  }
}

// Add click handler for feature selection (Esri pattern)
export const addMapClickHandler = (onFeatureSelect?: (feature: BuildingFeature) => void) => {
  if (!mapView) {
    console.warn('⚠️ Map not initialized, cannot add click handler')
    return
  }

  mapView.on("click", async (event: any) => {
    try {
      const response = await mapView.hitTest(event)
      if (response.results.length > 0) {
        const hit = response.results[0]
        if (hit.type === "graphic" && hit.graphic && hit.graphic.attributes) {
          console.log('🔍 Feature selected:', hit.graphic.attributes)
          
          // Call callback if provided
          if (onFeatureSelect) {
            onFeatureSelect({
              attributes: hit.graphic.attributes,
              geometry: hit.graphic.geometry
            })
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in click handler:', error)
    }
  })
}

// Update map extent and save to localStorage (Esri pattern)
export const saveMapExtent = () => {
  if (!mapView) return
  
  try {
    const extent = mapView.extent.toJSON()
    localStorage.setItem('mapExtent', JSON.stringify(extent))
    console.log('💾 Map extent saved')
  } catch (error) {
    console.error('❌ Error saving map extent:', error)
  }
}

// Restore saved map extent (Esri pattern)
export const restoreMapExtent = async () => {
  if (!mapView) return
  
  try {
    const savedExtent = localStorage.getItem('mapExtent')
    if (savedExtent) {
      const extent = JSON.parse(savedExtent)
      await mapView.goTo(extent)
      console.log('📍 Map extent restored')
    }
  } catch (error) {
    console.error('❌ Error restoring map extent:', error)
  }
}

// Clean up map resources (Esri pattern)
export const destroyMap = () => {
  if (mapView) {
    console.log('🧹 Cleaning up map resources')
    mapView.destroy()
    mapView = null
    mapInstance = null
    currentFeatureLayer = null
  }
}

// Get current map view (for external access)
export const getMapView = () => mapView

// Get current map instance
export const getMapInstance = () => mapInstance
