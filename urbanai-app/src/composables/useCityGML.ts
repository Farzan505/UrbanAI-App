import { ref, readonly } from 'vue'
import { useDecotwoAuth } from './useDecotwoAuth'

interface CityGMLGeometry {
  // Define the geometry structure based on your API response
  type: string
  coordinates: number[][][] | number[][][][] // GeoJSON-like structure
  properties?: Record<string, any>
}

interface CityGMLResponse {
  geometry?: CityGMLGeometry
  gmlid?: string
  results?: Record<string, any>
  summed_surface_areas?: Record<string, number>
  [key: string]: any // Allow dynamic keys for nested GML ID responses
}

// State
const isLoading = ref(false)
const error = ref<string>('')
const geometry = ref<any>(null) // Store complete response data

// Base API URL
const BASE_API_URL = 'https://api.decotwo.com'

export function useCityGML() {
  const { getAuthHeader } = useDecotwoAuth()

  // Get geometry for a specific GML ID
  const getGeometry = async (gmlid: string): Promise<any> => {
    isLoading.value = true
    error.value = ''
    geometry.value = null

    try {
      const response = await fetch(`${BASE_API_URL}/api/citygml/get_geometry?gmlids=${encodeURIComponent(gmlid)}&calculate_window_areas=false`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          ...getAuthHeader(),
        } as HeadersInit,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data: CityGMLResponse = await response.json()
      
      // Store the complete response data for use in components
      geometry.value = data
      
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch geometry'
      console.error('Error fetching geometry:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  // Clear current geometry
  const clearGeometry = () => {
    geometry.value = null
    error.value = ''
  }

  return {
    // State
    isLoading: readonly(isLoading),
    error: readonly(error),
    geometry: readonly(geometry),
    
    // Methods
    getGeometry,
    clearGeometry,
  }
}
