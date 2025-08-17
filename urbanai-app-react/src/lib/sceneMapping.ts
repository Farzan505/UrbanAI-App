// sceneMapping.ts - Scene mapping module following Esri patterns
import { Ref } from 'react'

// Store scene view and related objects globally
let sceneView: any = null
let sceneInstance: any = null

// Initialize 3D scene with dynamic imports
export const initializeScene = async (config: {
  container: string | HTMLDivElement
  gmlIds?: string[]
  geometryData?: any
}) => {
  console.log('🏗️ Initializing ArcGIS Scene with config:', config)
  
  try {
    // Dynamic imports for scene modules
    const [
      { default: Map },
      { default: SceneView },
      { default: FeatureLayer },
      { default: Graphic },
      { default: Legend },
      { default: LayerList },
      { default: Expand },
      { default: Fullscreen },
      { default: esriConfig }
    ] = await Promise.all([
      import('@arcgis/core/Map'),
      import('@arcgis/core/views/SceneView'),
      import('@arcgis/core/layers/FeatureLayer'),
      import('@arcgis/core/Graphic'),
      import('@arcgis/core/widgets/Legend'),
      import('@arcgis/core/widgets/LayerList'),
      import('@arcgis/core/widgets/Expand'),
      import('@arcgis/core/widgets/Fullscreen'),
      import('@arcgis/core/config')
    ])

    console.log('✅ ArcGIS Scene modules loaded successfully')

    // Set API key
    esriConfig.apiKey = "AAPK88646347a11d4ca190ec0b00201dc26c8kkfPaCG_kMmrxHsdUiVFuQzgCpecnrd664al4gHRq3VIIKlSV1epDVbEdh7tNJG"

    // Create scene
    sceneInstance = new Map({
      basemap: "arcgis/topographic",
      ground: "world-elevation"
    })

    // Create scene view
    sceneView = new SceneView({
      container: config.container,
      map: sceneInstance,
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

    // Wait for view to be ready
    await sceneView.when()
    console.log('✅ SceneView is ready')

    // Add widgets
    const legend = new Legend({ view: sceneView })
    const layerList = new LayerList({ view: sceneView })
    const fullscreen = new Fullscreen({ view: sceneView })

    const legendExpand = new Expand({
      view: sceneView,
      content: legend,
      expandIcon: "layer-list",
      group: "top-right"
    })

    const layerListExpand = new Expand({
      view: sceneView,
      content: layerList,
      expandIcon: "layers", 
      group: "top-right"
    })

    sceneView.ui.add([legendExpand, layerListExpand, fullscreen], "top-right")

    // Process geometry data if provided
    if (config.geometryData) {
      await processGeometryData(config.geometryData)
    }

    console.log('🎉 Scene initialization completed successfully')
    return sceneView
  } catch (error) {
    console.error('❌ Error initializing scene:', error)
    throw error
  }
}

// Process building geometry data for 3D visualization
export const processGeometryData = async (geometryData: any) => {
  if (!sceneView || !sceneInstance) {
    console.warn('⚠️ Scene not initialized, cannot process geometry data')
    return
  }

  console.log('📐 Processing geometry data for 3D visualization:', geometryData)

  try {
    // Import required modules
    const [{ default: FeatureLayer }, { default: Graphic }] = await Promise.all([
      import('@arcgis/core/layers/FeatureLayer'),
      import('@arcgis/core/Graphic')
    ])

    // Clear existing layers
    sceneInstance.layers.removeAll()

    // Helper functions for ring orientation (from Vue app)
    const isClockwise = (ring: number[][]) => {
      let sum = 0
      for (let i = 0; i < ring.length - 1; i++) {
        sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1])
      }
      return sum > 0
    }

    const reverseRing = (ring: number[][]) => [...ring].reverse()

    const fixRingOrientation = (rings: number[][][]) => {
      return rings.map((ring, index) => {
        const ringIsClockwise = isClockwise(ring)
        
        if (index === 0) {
          // Exterior ring should be clockwise for ArcGIS
          if (!ringIsClockwise) {
            return reverseRing(ring)
          }
        } else {
          // Interior rings (holes) should be counter-clockwise for ArcGIS
          if (ringIsClockwise) {
            return reverseRing(ring)
          }
        }
        
        return ring
      })
    }

    // Extract data structure
    let adiabaticData: any = null
    let shadingData: any = null

    // Check if data is wrapped in 'results'
    let processedData = geometryData
    if (geometryData.results) {
      processedData = geometryData.results
    }

    // Look for visualization_zone (adiabatic data)
    if (processedData.visualization_zone) {
      adiabaticData = processedData.visualization_zone
    } else {
      for (const key in processedData) {
        if (processedData[key] && processedData[key].visualization_zone) {
          adiabaticData = processedData[key].visualization_zone
          break
        }
      }
    }

    // Look for surfaces_adiabatic (shading data)  
    if (processedData.surfaces_adiabatic) {
      shadingData = processedData.surfaces_adiabatic
    } else {
      for (const key in processedData) {
        if (processedData[key] && processedData[key].surfaces_adiabatic) {
          shadingData = processedData[key].surfaces_adiabatic
          break
        }
      }
    }

    console.log('📊 Extracted data - Adiabatic:', !!adiabaticData, 'Shading:', !!shadingData)

    // Add shading surfaces
    if (shadingData && shadingData.features && shadingData.features.length > 0) {
      console.log('🏗️ Adding shading surfaces...')
      
      const shadingFeatures = shadingData.features.map((feature: any, index: number) => new Graphic({
        geometry: {
          type: "polygon",
          rings: fixRingOrientation(feature.geometry.coordinates),
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
            type: "string" as const
          }))
        ],
        renderer: {
          type: "simple",
          symbol: {
            type: "polygon-3d",
            symbolLayers: [{
              type: "fill",
              material: { color: [220, 220, 220, 0.8] },
              edges: {
                type: "solid",
                color: [100, 100, 100, 1],
                size: 1
              }
            }]
          }
        } as any,
        popupTemplate: {
          title: "Shading Surface",
          content: "ObjectID: {ObjectID}"
        }
      })

      sceneInstance.add(shadingLayer)
      console.log('✅ Shading surfaces added')
    }

    // Add adiabatic surfaces
    if (adiabaticData && adiabaticData.features && adiabaticData.features.length > 0) {
      console.log('🔥 Adding adiabatic surfaces...')
      
      const adiabaticFeatures = adiabaticData.features.map((feature: any, index: number) => new Graphic({
        geometry: {
          type: "polygon",
          rings: fixRingOrientation(feature.geometry.coordinates),
          spatialReference: { wkid: 4326 }
        },
        attributes: {
          ObjectID: index,
          ...feature.properties
        }
      }))

      const adiabaticLayer = new FeatureLayer({
        source: adiabaticFeatures,
        objectIdField: "ObjectID",
        title: "Adiabatic Surfaces",
        fields: [
          { name: "ObjectID", alias: "ObjectID", type: "oid" },
          ...Object.keys(adiabaticData.features[0]?.properties || {}).map((prop: string) => ({
            name: prop,
            alias: prop,
            type: "string" as const
          }))
        ],
        renderer: {
          type: "simple",
          symbol: {
            type: "polygon-3d",
            symbolLayers: [{
              type: "fill",
              material: { color: [255, 0, 0, 0.8] },
              edges: {
                type: "solid",
                color: [150, 0, 0, 1],
                size: 1
              }
            }]
          }
        } as any,
        popupTemplate: {
          title: "Adiabatic Surface",
          content: Object.keys(adiabaticData.features[0]?.properties || {})
            .map(key => `${key}: {${key}}`)
            .join("<br/>")
        }
      })

      sceneInstance.add(adiabaticLayer)
      console.log('✅ Adiabatic surfaces added')
    }

  } catch (error) {
    console.error('❌ Error processing geometry data:', error)
    throw error
  }
}

// Clean up scene resources
export const destroyScene = () => {
  if (sceneView) {
    console.log('🧹 Cleaning up scene resources')
    sceneView.destroy()
    sceneView = null
    sceneInstance = null
  }
}

// Get current scene view
export const getSceneView = () => sceneView

// Get current scene instance  
export const getSceneInstance = () => sceneInstance
