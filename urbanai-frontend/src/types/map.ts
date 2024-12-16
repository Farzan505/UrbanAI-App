export interface Feature {
  id: string
  type: "Feature"
  properties: Record<string, any>
  geometry: any
}

export interface CalciteCombobox extends HTMLElement {
  value: string
  selectedItems: Array<{ value: string }>
}

export interface CalciteComboboxItem extends HTMLElement {
  value: string
  setAttribute(name: string, value: string): void
}

export interface MapModules {
  esriConfig: any
  Map: any
  MapView: any
  GeoJSONLayer: any
  GroupLayer: any
  UniqueValueRenderer: any
  SimpleRenderer: any
  SimpleFillSymbol: any
  SimpleMarkerSymbol: any
  Legend: any
  Expand: any
  LayerList: any
}

export interface MapState {
  mapView: any
  map: any
  groupLayer: any
  selectedFeature: string[]
  selectedValues: string[]
  availableColumns: string[]
  uniqueValues: string[]
  error: string | null
}
