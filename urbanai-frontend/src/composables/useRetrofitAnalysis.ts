import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'

// Types
interface GmlMapping {
  gebid: string
  gmlid: string
  epl: string | null
  babez: string | null
  gebzabt: string | null
  ligbez: string | null
  geprueft: string
  kontrollbedarf: string
  konsistent_citygml_fdh: string
  kommentar: string | null
  bearbeitungsbedarf_ldbv: string | null
  fdh_merge: string | null
  edited_at: string
}

interface RetrofitAnalysisPayload {
  building_id: string
  gebplz: string
  building_category: string
  construction_year: number
  geometry_data: any
  gmlid_list: string[]
  system_type: string
  retrofit_scenario_construction?: string | null
  retrofit_construction_year?: number | null
  retrofit_system_type?: string
  retrofit_subsystem_type: string
  retrofit_hvac_year?: number | null
  window_construction?: string
  wall_construction?: string
  roof_construction?: string
  base_construction?: string
  co2_reduction_scenario: string
  co2_cost_scenario: string
}

type SystemType = 'Öl/Gas' | 'Wärmepumpe' | 'Fernwärme' | 'Biomasse'

export function useRetrofitAnalysis() {
  // State
  const isAnalyzingRetrofit = ref(false)
  const retrofitAnalysisError = ref('')
  const retrofitAnalysisResult = ref<any>(null)
  
  // API base URL
  const apiBaseUrl = ref('http://localhost:8080')

  // Helper functions
  const getBuildingCategory = (assumptions: any): string => {
    const enobCategory = assumptions?.enob_category
    console.log('🏢 Raw enob_category from database:', enobCategory)
    return enobCategory || 'Wohngebäude'
  }

  const parseConstructionYear = (epl: string | number | null | undefined): number => {
    if (!epl) return 1950
    const year = typeof epl === 'string' ? parseInt(epl) : epl
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
      console.warn('Invalid construction year:', epl, 'Using 1950 as fallback')
      return 1950
    }
    return year
  }

  const mapToSystemType = (type: string | undefined): SystemType => {
    if (!type) return 'Öl/Gas'
    const validTypes: SystemType[] = ['Öl/Gas', 'Wärmepumpe', 'Fernwärme', 'Biomasse']
    return validTypes.includes(type as SystemType) ? (type as SystemType) : 'Öl/Gas'
  }

  // Base scenario analysis
  const analyzeBaseScenario = async (
    buildingData: any,
    geometryData: any,
    co2PathScenarios: string[],
    co2CostScenarios: string[],
    selectedCo2PathScenario: string,
    selectedCo2CostScenario: string
  ) => {
    try {
      console.log('🏗️ Starting base scenario analysis...')
      
      if (!buildingData || !geometryData?.results) {
        console.log('❌ Missing building or geometry data for base scenario analysis')
        return
      }

      if (co2PathScenarios.length === 0 || co2CostScenarios.length === 0) {
        console.log('⏳ CO2 scenarios not loaded yet, cannot proceed')
        return
      }

      console.log('🏗️ Prerequisites met, proceeding with base scenario analysis...')
      isAnalyzingRetrofit.value = true
      retrofitAnalysisError.value = ''
      retrofitAnalysisResult.value = null

      const assumptions = buildingData.buildings_assumptions
      const gebplz = assumptions.gebid?.split(' ')[0] || ''
      const gmlIds = buildingData.gmlid_gebid_mapping.map((mapping: GmlMapping) => mapping.gmlid)
      
      const actualBuildingCategory = getBuildingCategory(assumptions)
      const actualConstructionYear = parseConstructionYear(assumptions?.epl)
      const geometryDataCopy = { ...geometryData.results }

      const payload: RetrofitAnalysisPayload = {
        building_id: assumptions.gebid,
        gebplz: gebplz,
        building_category: actualBuildingCategory,
        construction_year: actualConstructionYear,
        geometry_data: geometryDataCopy,
        gmlid_list: gmlIds,
        system_type: 'Öl/Gas',
        retrofit_subsystem_type: 'Gas',
        co2_reduction_scenario: selectedCo2PathScenario,
        co2_cost_scenario: selectedCo2CostScenario
      }

      console.log('📤 Sending base scenario payload:', payload)

      const response = await fetch(`${apiBaseUrl.value}/api/energy/analyze-retrofit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        let errorDetail = ''
        try {
          const errorData = await response.json()
          console.error('❌ Base scenario error response:', errorData)
          
          if (Array.isArray(errorData.detail)) {
            errorDetail = errorData.detail.map((err: any) => 
              `${err.loc.join('.')}: ${err.msg} (${err.type})`
            ).join('\n')
          } else {
            errorDetail = errorData.detail || JSON.stringify(errorData)
          }
        } catch (e) {
          errorDetail = `HTTP error! status: ${response.status}`
        }
        throw new Error(errorDetail)
      }

      const data = await response.json()
      console.log('✅ Base scenario analysis response:', data)
      
      retrofitAnalysisResult.value = data
      console.log('🎯 Base scenario analysis completed successfully')

    } catch (err) {
      console.error('❌ Base scenario analysis error:', err)
      retrofitAnalysisError.value = `Base scenario analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    } finally {
      isAnalyzingRetrofit.value = false
    }
  }

  // Retrofit scenario analysis
  const analyzeRetrofitScenario = async (
    buildingData: any,
    geometryData: any,
    retrofitScenario: any,
    selectedCo2PathScenario: string,
    selectedCo2CostScenario: string,
    getHVACOptions: any[]
  ) => {
    try {
      if (!buildingData || !geometryData?.results) {
        retrofitAnalysisError.value = 'Fehlende Gebäudedaten für die Analyse'
        return
      }

      isAnalyzingRetrofit.value = true
      retrofitAnalysisError.value = ''
      retrofitAnalysisResult.value = null

      const assumptions = buildingData.buildings_assumptions
      const gebplz = assumptions.gebid?.split(' ')[0] || ''
      const gmlIds = buildingData.gmlid_gebid_mapping.map((mapping: GmlMapping) => mapping.gmlid)

      const selectedHVACItem = retrofitScenario?.hvac 
        ? getHVACOptions.find(item => item.hvac_number === retrofitScenario?.hvac?.hvac_number)
        : null

      const systemType = mapToSystemType(retrofitScenario?.hvac?.hvac_type)
      const actualBuildingCategory = getBuildingCategory(assumptions)
      const actualConstructionYear = parseConstructionYear(assumptions?.epl)
      const geometryDataCopy = { ...geometryData.results }

      const payload: RetrofitAnalysisPayload = {
        building_id: assumptions.gebid,
        gebplz: gebplz,
        building_category: actualBuildingCategory,
        construction_year: actualConstructionYear,
        geometry_data: geometryDataCopy,
        gmlid_list: gmlIds,
        system_type: systemType,
        retrofit_subsystem_type: selectedHVACItem?.hvac_type || 'Gas',
        co2_reduction_scenario: selectedCo2PathScenario,
        co2_cost_scenario: selectedCo2CostScenario
      }

      const response = await fetch(`${apiBaseUrl.value}/api/energy/analyze-retrofit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        let errorDetail = ''
        try {
          const errorData = await response.json()
          if (Array.isArray(errorData.detail)) {
            errorDetail = errorData.detail.map((err: any) => 
              `${err.loc.join('.')}: ${err.msg} (${err.type})`
            ).join('\n')
          } else {
            errorDetail = errorData.detail || JSON.stringify(errorData)
          }
        } catch (e) {
          errorDetail = `HTTP error! status: ${response.status}`
        }
        throw new Error(errorDetail)
      }

      const data = await response.json()
      console.log('✅ Retrofit analysis response:', data)
      
      retrofitAnalysisResult.value = data

      const message = retrofitScenario 
        ? 'Die Sanierungsanalyse wurde erfolgreich durchgeführt.'
        : 'Die Status-Quo-Analyse wurde erfolgreich durchgeführt.'
      
      toast.success('Analyse erfolgreich', {
        description: message
      })

    } catch (err) {
      console.error('❌ Retrofit analysis error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler'
      retrofitAnalysisError.value = `Analyse fehlgeschlagen: ${errorMessage}`
      
      toast.error('Analyse fehlgeschlagen', {
        description: retrofitAnalysisError.value
      })
    } finally {
      isAnalyzingRetrofit.value = false
    }
  }

  return {
    // State
    isAnalyzingRetrofit,
    retrofitAnalysisError,
    retrofitAnalysisResult,
    
    // Methods
    analyzeBaseScenario,
    analyzeRetrofitScenario
  }
}
