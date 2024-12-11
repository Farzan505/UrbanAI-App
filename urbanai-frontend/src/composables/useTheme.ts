import { useColorMode } from '@vueuse/core'

// Create a singleton instance of the color mode
export const colorMode = useColorMode({
  attribute: 'class',
  modes: {
    light: '',
    dark: 'dark',
  },
  emitAuto: true,
  storageKey: 'color-scheme',
  disableTransition: false,
})

// Function to update theme
const updateTheme = (value: string) => {
  const htmlElement = document.documentElement
  if (value === 'dark') {
    htmlElement.classList.add('dark')
  } else {
    htmlElement.classList.remove('dark')
  }
}

// Export a function that returns the singleton instance and sets up theme handling
export const useTheme = () => {
  // Set initial theme if not already set
  if (!colorMode.value) {
    colorMode.value = 'dark'
  }
  
  // Update theme immediately
  updateTheme(colorMode.value)
  
  return colorMode
}
