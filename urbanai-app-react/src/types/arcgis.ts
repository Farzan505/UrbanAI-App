// ArcGIS TypeScript interfaces and types

export interface GeometryFeature {
  type: string;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][];
  };
  properties: Record<string, any>;
}

export interface GeometryData {
  type: string;
  features: GeometryFeature[];
}

export interface GeometryResponse {
  surfaces_adiabatic?: GeometryData;
  shading_surfaces?: GeometryData;
  results?: {
    surfaces_adiabatic?: GeometryData;
    shading_surfaces?: GeometryData;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ArcGISSceneViewerProps {
  gmlIds: string[];
  apiBaseUrl?: string;
  geometryData?: GeometryResponse | null;
  geometryLoading?: boolean;
  className?: string;
}

export interface EsriModules {
  Map: any;
  SceneView: any;
  esriConfig: any;
  FeatureLayer: any;
  Legend: any;
  LayerList: any;
  Expand: any;
  Fullscreen: any;
  Extent: any;
  Point: any;
}

export interface ProcessedFeature {
  geometry: {
    type: "polygon";
    rings: number[][][];
    spatialReference: { wkid: number };
  };
  attributes: {
    ObjectID: number;
    [key: string]: any;
  };
}

export interface VisualizationData {
  adiabaticData: GeometryData | null;
  shadingData: GeometryData | null;
}

export type ColorValue = string | number[];

// ArcGIS API configuration
export const ARCGIS_CONFIG = {
  API_VERSION: '4.33',
  API_KEY: 'AAPK88646347a11d4ca190ec0b00201dc26c8kkfPaCG_kMmrxHsdUiVFuQzgCpecnrd664al4gHRq3VIIKlSV1epDVbEdh7tNJG',
  DEFAULT_CAMERA: {
    position: { x: 11.5820, y: 48.1351, z: 1000 },
    tilt: 45,
    heading: 180
  },
  SPATIAL_REFERENCE: { wkid: 4326 }
} as const;

// Color palette for property visualization
export const PROPERTY_COLORS = [
  "#fc3e5aff", "#fce138ff", "#4c81cdff", "#f1983cff", 
  "#48885cff", "#a553b7ff", "#fff799ff", "#b1a9d0ff", 
  "#6ecffcff", "#fc6f84ff", "#6af689ff", "#fcd27eff"
] as const;

// Default colors for surface types
export const SURFACE_COLORS = {
  ADIABATIC: [255, 100, 100, 0.8] as const,
  SHADING: [128, 128, 128, 0.7] as const,
  OUTLINE: [255, 255, 255, 1.0] as const
} as const;
