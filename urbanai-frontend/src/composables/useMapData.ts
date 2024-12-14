import { ref } from 'vue'
import axios from 'axios'

interface Feature {
  id: string
  type: "Feature"
  properties: Record<string, any>
  geometry: any
}

interface FeatureCollection {
  type: "FeatureCollection"
  features: Feature[]
}

const mapData = ref<FeatureCollection | null>(null)
const error = ref<string>('')
const loading = ref(false)

export function useMapData() {
  const fetchMapData = async () => {
    if (mapData.value) {
      console.log('Using cached map data')
      return mapData.value
    }

    loading.value = true
    error.value = ''
    
    try {
      console.log('Fetching map data...')
      const token = localStorage.getItem('token')
      if (!token) {
        error.value = 'No authentication token found. Please log in again.'
        console.error(error.value)
        return null
      }

      const API_URL = import.meta.env.VITE_API_URL
      const response = await axios.get(`${API_URL}/frontend/geometry_retrieve`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      let parsedData: FeatureCollection
      if (typeof response.data === 'string') {
        parsedData = JSON.parse(response.data)
      } else {
        parsedData = response.data
      }

      if (parsedData.type !== 'FeatureCollection' || !Array.isArray(parsedData.features)) {
        throw new Error('Invalid GeoJSON data received')
      }

      mapData.value = parsedData
      return mapData.value
    } catch (err: any) {
      console.error('Error fetching map data:', err)
      error.value = err.message || 'Error fetching map data'
      throw err
    } finally {
      loading.value = false
    }
  }

  const clearMapData = () => {
    mapData.value = null
    error.value = ''
    loading.value = false
  }

  return {
    mapData,
    error,
    loading,
    fetchMapData,
    clearMapData
  }
}
