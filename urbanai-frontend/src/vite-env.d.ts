/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARCGIS_API: string
  readonly VITE_API_URL: string
  // Add other env variables here if needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
