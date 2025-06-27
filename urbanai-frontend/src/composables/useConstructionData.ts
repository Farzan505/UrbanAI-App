import { ref, reactive } from 'vue'

export interface Construction {
  construction_number: string
  construction_name: string
  construction_type: string
  description: string | null
}

export interface ConstructionResponse {
  construction_type: string
  constructions: Construction[]
  total_count: number
}

export interface ConstructionSelections {
  window_construction: string
  wall_construction: string
  roof_construction: string
  base_construction: string
  dynamic_lca: boolean
}

export function useConstructionData() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const constructionData = reactive<Record<string, Construction[]>>({})
  
  const constructionSelections = reactive<ConstructionSelections>({
    window_construction: 'W-330-001',
    wall_construction: 'F-330-001',
    roof_construction: 'R-360-001',
    base_construction: 'B-360-001',
    dynamic_lca: false
  })

  const constructionTypeMapping = {
    'Fenster': 'window_construction',
    'Außenwand': 'wall_construction', 
    'Dach': 'roof_construction',
    'Boden': 'base_construction'
  } as const

  const fetchConstructionList = async (constructionType: string): Promise<Construction[]> => {
    if (constructionData[constructionType]) {
      return constructionData[constructionType]
    }

    try {
      isLoading.value = true
      error.value = null
      
      const params = new URLSearchParams({
        construction_type: constructionType
      })
      
      const response = await fetch(`http://localhost:8080/api/construction-hvac/construction/list?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch construction data: ${response.statusText}`)
      }

      const data: ConstructionResponse = await response.json()
      constructionData[constructionType] = data.constructions
      
      return data.constructions
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const fetchAllConstructionTypes = async () => {
    const types = ['Fenster', 'Außenwand', 'Dach', 'Boden']
    
    try {
      isLoading.value = true
      await Promise.all(types.map(type => fetchConstructionList(type)))
    } catch (err) {
      console.error('Error fetching construction types:', err)
    } finally {
      isLoading.value = false
    }
  }

  const updateConstructionSelection = (constructionType: string, constructionNumber: string) => {
    const selectionKey = constructionTypeMapping[constructionType as keyof typeof constructionTypeMapping]
    if (selectionKey) {
      constructionSelections[selectionKey] = constructionNumber
    }
  }

  const resetSelections = () => {
    constructionSelections.window_construction = 'W-330-001'
    constructionSelections.wall_construction = 'F-330-001'
    constructionSelections.roof_construction = 'R-360-001'
    constructionSelections.base_construction = 'B-360-001'
    constructionSelections.dynamic_lca = false
  }

  const getConstructionOptions = (constructionType: string): Construction[] => {
    return constructionData[constructionType] || []
  }

  return {
    // State
    isLoading,
    error,
    constructionData,
    constructionSelections,
    
    // Methods
    fetchConstructionList,
    fetchAllConstructionTypes,
    updateConstructionSelection,
    resetSelections,
    getConstructionOptions
  }
}
