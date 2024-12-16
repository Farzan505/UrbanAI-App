import { computed } from 'vue'
import { useColorMode } from '@vueuse/core'

// Basemap styles
const LIGHT_BASEMAP = "arcgis/light-gray"
const DARK_BASEMAP = "arcgis/dark-gray"

export function useMapTheme() {
  const colorMode = useColorMode()
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

  const currentBasemap = computed(() => {
    if (colorMode.value === 'auto') {
      return prefersDark.matches ? DARK_BASEMAP : LIGHT_BASEMAP
    }
    return colorMode.value === 'dark' ? DARK_BASEMAP : LIGHT_BASEMAP
  })

  // System theme change listener setup
  prefersDark.addEventListener('change', (e) => {
    if (colorMode.value === 'auto') {
      console.log('System theme changed:', e.matches ? 'dark' : 'light')
    }
  })

  return {
    currentBasemap
  }
}
