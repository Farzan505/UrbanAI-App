/// <reference types="vite/client" />

// ArcGIS Maps SDK for JavaScript global types
declare global {
  interface Window {
    $arcgis: {
      import: (modules: string[]) => Promise<any[]>
    }
  }
}

export {}