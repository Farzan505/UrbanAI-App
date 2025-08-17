"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArcGISSceneViewerProps,
  EsriModules,
  GeometryResponse,
  VisualizationData,
  ProcessedFeature,
  ColorValue,
  ARCGIS_CONFIG,
  PROPERTY_COLORS,
  SURFACE_COLORS
} from '@/types/arcgis';

export default function ArcGISSceneViewer({
  gmlIds,
  apiBaseUrl = 'https://api.decotwo.com',
  geometryData,
  geometryLoading = false,
  className = ''
}: ArcGISSceneViewerProps) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const esriModulesRef = useRef<EsriModules | null>(null);
  const currentDataRef = useRef<VisualizationData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [availableProperties, setAvailableProperties] = useState<string[]>([]);

  // Utility functions for ring orientation
  const isClockwise = (ring: number[][]) => {
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
    }
    return sum > 0;
  };

  const reverseRing = (ring: number[][]) => [...ring].reverse();

  const fixRingOrientation = (rings: number[][][]) => {
    return rings.map((ring, index) => {
      const ringIsClockwise = isClockwise(ring);
      if (index === 0) {
        return !ringIsClockwise ? reverseRing(ring) : ring;
      } else {
        return ringIsClockwise ? reverseRing(ring) : ring;
      }
    });
  };

  // Load ArcGIS API
  const loadArcGISAPI = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).require) {
        resolve();
        return;
      }

      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://js.arcgis.com/4.33/esri/themes/light/main.css';
      document.head.appendChild(cssLink);

      const script = document.createElement('script');
      script.src = 'https://js.arcgis.com/4.33/';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load ArcGIS API'));
      document.head.appendChild(script);
    });
  };

  // Initialize ArcGIS modules and map
  const initializeMap = async () => {
    if (!mapDiv.current) return;

    // Ensure container has proper dimensions before initializing
    const containerRect = mapDiv.current.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      console.warn('Container has zero dimensions, waiting for proper sizing...');
      setTimeout(() => initializeMap(), 100);
      return;
    }

    try {
      const modules = await new Promise((resolve) => {
        (window as any).require([
          "esri/Map", "esri/views/SceneView", "esri/config", "esri/layers/FeatureLayer",
          "esri/widgets/Legend", "esri/widgets/LayerList", "esri/widgets/Expand", 
          "esri/widgets/Fullscreen", "esri/geometry/Extent", "esri/geometry/Point"
        ], (...loadedModules: any[]) => {
          resolve({
            Map: loadedModules[0], SceneView: loadedModules[1], esriConfig: loadedModules[2],
            FeatureLayer: loadedModules[3], Legend: loadedModules[4], LayerList: loadedModules[5],
            Expand: loadedModules[6], Fullscreen: loadedModules[7], Extent: loadedModules[8], Point: loadedModules[9]
          });
        });
      });

      esriModulesRef.current = modules as EsriModules;
      const { Map, SceneView, esriConfig, Legend, LayerList, Expand, Fullscreen } = esriModulesRef.current;

      esriConfig.apiKey = ARCGIS_CONFIG.API_KEY;

      mapRef.current = new Map({
        basemap: "arcgis/topographic",
        ground: "world-elevation"
      });

      viewRef.current = new SceneView({
        container: mapDiv.current,
        map: mapRef.current,
        camera: {
          position: { x: 11.5820, y: 48.1351, z: 1000 },
          tilt: 45,
          heading: 180
        },
        environment: {
          lighting: { directShadowsEnabled: true }
        }
      });

      await viewRef.current.when();

      // Add widgets (removed deprecated Fullscreen widget)
      const legend = new Legend({ view: viewRef.current });
      const layerList = new LayerList({ view: viewRef.current });

      const legendExpand = new Expand({
        view: viewRef.current,
        content: legend,
        expandIconClass: "esri-icon-layer-list",
        group: "top-right"
      });

      const layerListExpand = new Expand({
        view: viewRef.current,
        content: layerList,
        expandIconClass: "esri-icon-layers", 
        group: "top-right"
      });

      viewRef.current.ui.add([legendExpand, layerListExpand], "top-right");

      // Add click handler for popups
      viewRef.current.on("click", (event: any) => {
        viewRef.current.hitTest(event).then((response: any) => {
          const results = response.results.filter((result: any) => 
            result.graphic.layer.type === "feature"
          );
          if (results.length > 0) {
            viewRef.current.popup.open({
              location: event.mapPoint,
              features: [results[0].graphic]
            });
          }
        });
      });

      setIsLoading(false);
    } catch (err) {
      setError(`Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  // Zoom to data extent
  const zoomToData = async (data: { adiabaticData: any, shadingData: any }) => {
    if (!viewRef.current || !esriModulesRef.current) return;

    const { Extent, Point } = esriModulesRef.current;
    let allCoordinates: number[][] = [];

    [data.adiabaticData, data.shadingData].forEach(dataset => {
      dataset?.features?.forEach((feature: any) => {
        if (feature.geometry?.coordinates) {
          if (feature.geometry.type === 'Polygon') {
            allCoordinates = allCoordinates.concat(feature.geometry.coordinates[0]);
          } else if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon: any) => {
              allCoordinates = allCoordinates.concat(polygon[0]);
            });
          }
        }
      });
    });

    if (allCoordinates.length > 0) {
      const xCoords = allCoordinates.map(coords => coords[0]);
      const yCoords = allCoordinates.map(coords => coords[1]);
      
      const extent = new Extent({
        xmin: Math.min(...xCoords), ymin: Math.min(...yCoords),
        xmax: Math.max(...xCoords), ymax: Math.max(...yCoords),
        spatialReference: { wkid: 4326 }
      });

      const centerX = (extent.xmin + extent.xmax) / 2;
      const centerY = (extent.ymin + extent.ymax) / 2;
      const maxExtent = Math.max(extent.xmax - extent.xmin, extent.ymax - extent.ymin);
      
      await viewRef.current.goTo({
        target: new Point({
          x: centerX, y: centerY,
          spatialReference: { wkid: 4326 }
        }),
        tilt: 60, heading: 45,
        zoom: maxExtent < 0.001 ? 19 : 18
      }, { duration: 3000, easing: "ease-in-out" });
    }
  };

  // Create feature layer
  const createFeatureLayer = (features: any[], title: string, color: string | number[], properties: any) => {
    if (!esriModulesRef.current) return null;
    const { FeatureLayer } = esriModulesRef.current;
    
    return new FeatureLayer({
      source: features,
      objectIdField: "ObjectID",
      title,
      fields: [
        { name: "ObjectID", alias: "ObjectID", type: "oid" },
        ...Object.keys(properties || {}).map((prop: string) => ({
          name: prop, alias: prop, type: "string"
        }))
      ],
      renderer: {
        type: "simple",
        symbol: {
          type: "polygon-3d",
          symbolLayers: [{
            type: "fill",
            material: { color, colorMixMode: "replace" },
            outline: { color: [255, 255, 255, 1.0], size: "2px" }
          }]
        }
      },
      popupTemplate: {
        title,
        content: [{
          type: "fields",
          fieldInfos: Object.keys(properties || {}).map((prop: string) => ({
            fieldName: prop, label: prop
          }))
        }]
      }
    });
  };

  // Process geometry data
  const processGeometryData = async (data: any) => {
    if (!viewRef.current || !mapRef.current || !esriModulesRef.current) {
      console.error('Scene not properly initialized');
      return;
    }

    try {
      console.log('Processing geometry data:', data);
      
      // Ensure view is ready
      if (!viewRef.current.ready) {
        await viewRef.current.when();
      }

      // Clear existing layers safely
      try {
        mapRef.current.layers.removeAll();
      } catch (layerError) {
        console.warn('Error removing layers:', layerError);
      }

      let geometryData = data.results || data;
      let adiabaticData: any = null;
      let shadingData: any = null;

      // Extract data from nested structure
      if (geometryData.surfaces_adiabatic) {
        adiabaticData = geometryData.surfaces_adiabatic;
      } else {
        for (const key in geometryData) {
          if (geometryData[key]?.surfaces_adiabatic) {
            adiabaticData = geometryData[key].surfaces_adiabatic;
            break;
          }
        }
      }

      if (geometryData.shading_surfaces) {
        shadingData = geometryData.shading_surfaces;
      } else {
        for (const key in geometryData) {
          if (geometryData[key]?.shading_surfaces) {
            shadingData = geometryData[key].shading_surfaces;
            break;
          }
        }
      }

      console.log('Extracted data:', { adiabaticData, shadingData });
      currentDataRef.current = { adiabaticData, shadingData };

      // Set up property picker
      if (adiabaticData?.features?.length > 0) {
        const properties = Object.keys(adiabaticData.features[0].properties);
        setAvailableProperties(properties);
        if (!selectedProperty && properties.length > 0) {
          setSelectedProperty(properties[0]);
        }
      }

      // Add shading surfaces
      if (shadingData?.features?.length > 0) {
        console.log('Processing shading surfaces:', shadingData.features.length);
        try {
          const shadingFeatures = shadingData.features.map((feature: any, index: number) => {
            let rings = feature.geometry.coordinates;
            if (feature.geometry.type === 'Polygon') {
              rings = feature.geometry.coordinates;
            } else if (feature.geometry.type === 'MultiPolygon') {
              rings = feature.geometry.coordinates.flat();
            }
            
            return {
              geometry: {
                type: "polygon",
                rings: fixRingOrientation(rings),
                spatialReference: { wkid: 4326 }
              },
              attributes: { ObjectID: index, ...feature.properties }
            };
          });

          const shadingLayer = createFeatureLayer(
            shadingFeatures, 
            "Shading Surfaces", 
            [128, 128, 128, 0.7], 
            shadingData.features[0]?.properties
          );
          
          if (shadingLayer) {
            mapRef.current.add(shadingLayer);
            console.log('Added shading layer successfully');
          }
        } catch (shadingError) {
          console.error('Error processing shading surfaces:', shadingError);
        }
      }

      // Add adiabatic surfaces
      if (adiabaticData?.features?.length > 0) {
        console.log('Processing adiabatic surfaces:', adiabaticData.features.length);
        try {
          if (selectedProperty) {
            visualizeByProperty(selectedProperty);
          } else {
            const adiabaticFeatures = adiabaticData.features.map((feature: any, index: number) => {
              let rings = feature.geometry.coordinates;
              if (feature.geometry.type === 'Polygon') {
                rings = feature.geometry.coordinates;
              } else if (feature.geometry.type === 'MultiPolygon') {
                rings = feature.geometry.coordinates.flat();
              }
              
              return {
                geometry: {
                  type: "polygon",
                  rings: fixRingOrientation(rings),
                  spatialReference: { wkid: 4326 }
                },
                attributes: { ObjectID: index, ...feature.properties }
              };
            });

            const adiabaticLayer = createFeatureLayer(
              adiabaticFeatures, 
              "Adiabatic Surfaces", 
              [255, 100, 100, 0.8], 
              adiabaticData.features[0]?.properties
            );
            
            if (adiabaticLayer) {
              mapRef.current.add(adiabaticLayer);
              console.log('Added adiabatic layer successfully');
            }
          }
        } catch (adiabaticError) {
          console.error('Error processing adiabatic surfaces:', adiabaticError);
        }
      }

      // Only zoom if we have data
      if (adiabaticData || shadingData) {
        try {
          await zoomToData({ adiabaticData, shadingData });
        } catch (zoomError) {
          console.warn('Error zooming to data:', zoomError);
        }
      }
      
      console.log('Geometry processing completed successfully');
    } catch (err) {
      console.error('Error in processGeometryData:', err);
      throw err; // Re-throw to be handled by the calling useEffect
    }
  };

  // Visualize by property
  const visualizeByProperty = (property: string) => {
    if (!currentDataRef.current?.adiabaticData || !mapRef.current) return;

    const { adiabaticData } = currentDataRef.current;
    
    // Clear and re-add shading surfaces first
    mapRef.current.layers.removeAll();
    
    if (currentDataRef.current.shadingData?.features && currentDataRef.current.shadingData.features.length > 0) {
      const shadingFeatures = currentDataRef.current.shadingData.features.map((feature: any, index: number) => ({
        geometry: {
          type: "polygon",
          rings: fixRingOrientation(
            feature.geometry.type === 'Polygon' 
              ? feature.geometry.coordinates 
              : feature.geometry.coordinates.flat()
          ),
          spatialReference: { wkid: 4326 }
        },
        attributes: { ObjectID: index, ...feature.properties }
      }));

      const shadingLayer = createFeatureLayer(
        shadingFeatures, 
        "Shading Surfaces", 
        [...SURFACE_COLORS.SHADING], 
        currentDataRef.current.shadingData.features[0]?.properties
      );
      if (shadingLayer) {
        mapRef.current.add(shadingLayer);
      }
    }

    // Group adiabatic features by property value
    const features = adiabaticData.features.map((feature: any, index: number) => ({
      geometry: {
        type: "polygon",
        rings: fixRingOrientation(
          feature.geometry.type === 'Polygon' 
            ? feature.geometry.coordinates 
            : feature.geometry.coordinates.flat()
        ),
        spatialReference: { wkid: 4326 }
      },
      attributes: {
        ObjectID: index,
        featureProp: feature.properties[property],
        ...feature.properties
      }
    }));

    const uniqueValues = [...new Set(features.map((f: any) => f.attributes.featureProp))].filter(val => val != null);

    uniqueValues.forEach((value, index) => {
      const sublayerFeatures = features.filter((f: any) => f.attributes.featureProp === value);
      const layer = createFeatureLayer(
        sublayerFeatures, 
        String(value), 
        PROPERTY_COLORS[index % PROPERTY_COLORS.length], 
        adiabaticData.features[0].properties
      );
      if (layer) {
        mapRef.current.add(layer);
      }
    });
  };

  // Handle property change
  const handlePropertyChange = (property: string) => {
    setSelectedProperty(property);
    if (currentDataRef.current) {
      visualizeByProperty(property);
    }
  };

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      try {
        await loadArcGISAPI();
        await initializeMap();
      } catch (err) {
        setError(`Initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, []);

  // Process geometry data when it changes
  useEffect(() => {
    const processData = async () => {
      if (geometryData && viewRef.current && mapRef.current && !isLoading && esriModulesRef.current) {
        try {
          // Ensure view is fully ready before processing
          await viewRef.current.when();
          await processGeometryData(geometryData);
        } catch (err) {
          console.error('Error processing geometry data:', err);
          setError(`Failed to process geometry data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    };

    processData();
  }, [geometryData, isLoading]);

  if (error) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center text-red-600">
          <h3 className="text-lg font-semibold mb-2">Error Loading Scene</h3>
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`flex flex-col ${className}`}>
      {/* Property Selector */}
      {availableProperties.length > 0 && (
        <div className="p-4 border-b">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Property:</span>
            {availableProperties.map((property) => (
              <Badge
                key={property}
                variant={selectedProperty === property ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handlePropertyChange(property)}
              >
                {property}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Scene Container */}
      <div className="flex-1 relative min-h-[500px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading ArcGIS Scene Viewer...</p>
            </div>
          </div>
        )}
        
        {geometryLoading && (
          <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-20">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm">Loading geometry data...</span>
            </div>
          </div>
        )}

        <div 
          ref={mapDiv} 
          className="w-full h-full"
          style={{ minHeight: '500px' }}
        />
      </div>
    </Card>
  );
}
