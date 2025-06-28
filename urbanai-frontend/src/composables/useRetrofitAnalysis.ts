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
  construction_year: string
  system_type: string
  window_construction?: string
  wall_construction?: string
  roof_construction?: string
  base_construction?: string
  co2_reduction_scenario: string
  co2_cost_scenario: string
  gmlid_list?: string[]
  retrofit_scenario_construction?: string | null
  retrofit_construction_year?: number | null
  retrofit_system_type?: string | null
  retrofit_subsystem_type?: string | null
  retrofit_hvac_year?: number | null
  geometry_data?: any
  sim_results?: any
  time_preference_rate?: number
  dynamic_lca?: boolean
}

type SystemType = 'Öl/Gas' | 'Wärmepumpe' | 'Fernwärme' | 'Biomasse'

export function useRetrofitAnalysis() {
  // State
  const isAnalyzingRetrofit = ref(false)
  const retrofitAnalysisError = ref('')
  const retrofitAnalysisResult = ref<any>(null)
  
  // API base URL
  const apiBaseUrl = ref('http://localhost:8080')

  // Custom serialization function that preserves all keys and handles problematic values
  const safeJSONStringify = (obj: any): string => {
    const seen = new WeakSet()
    const issues: string[] = []
    
    const replacer = (key: string, value: any) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          issues.push(`Circular reference found at key: ${key}`)
          return '[Circular Reference]'
        }
        seen.add(value)
      }
      
      // Skip undefined values entirely (don't include the key)
      if (value === undefined) {
        issues.push(`Undefined value found at key: ${key} - skipping`)
        return undefined
      }
      
      // Convert functions to string representation
      if (typeof value === 'function') {
        issues.push(`Function found at key: ${key}`)
        return `[Function: ${value.name || 'anonymous'}]`
      }
      
      // Handle special number values
      if (typeof value === 'number') {
        if (isNaN(value)) {
          issues.push(`NaN found at key: ${key}`)
          return null
        }
        if (!isFinite(value)) {
          issues.push(`Infinite number found at key: ${key}`)
          return null
        }
      }
      
      return value
    }
    
    const result = JSON.stringify(obj, replacer, 2)
    
    if (issues.length > 0) {
      console.warn('🚨 Serialization issues found:', issues)
    }
    
    return result
  }

  // Function to compare objects before and after serialization
  const validateGeometryDataSerialization = (original: any, description: string = '') => {
    console.log(`🔍 Validating geometry data serialization ${description}...`)
    
    const originalKeys = Object.keys(original || {})
    console.log(`📊 Original geometry data has ${originalKeys.length} keys:`, originalKeys)
    
    try {
      const serialized = safeJSONStringify(original)
      const parsed = JSON.parse(serialized)
      const parsedKeys = Object.keys(parsed || {})
      
      console.log(`📊 After serialization has ${parsedKeys.length} keys:`, parsedKeys)
      
      const lostKeys = originalKeys.filter(key => !parsedKeys.includes(key))
      const gainedKeys = parsedKeys.filter(key => !originalKeys.includes(key))
      
      if (lostKeys.length > 0) {
        console.error('❌ Lost keys during serialization:', lostKeys)
        lostKeys.forEach(key => {
          console.error(`❌ Lost key "${key}" had value:`, typeof original[key], original[key])
        })
      }
      
      if (gainedKeys.length > 0) {
        console.warn('➕ New keys after serialization:', gainedKeys)
      }
      
      if (lostKeys.length === 0 && gainedKeys.length === 0) {
        console.log('✅ All keys preserved during serialization')
      }
      
      return { serialized, parsed, lostKeys, gainedKeys }
      
    } catch (error) {
      console.error('❌ Serialization validation failed:', error)
      return { serialized: null, parsed: null, lostKeys: originalKeys, gainedKeys: [] }
    }
  }

  // Safe deep copy function that preserves data types better than JSON.parse(JSON.stringify())
  const safeDeepCopy = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime())
    }
    
    if (obj instanceof Array) {
      return obj.map(item => safeDeepCopy(item))
    }
    
    if (typeof obj === 'object') {
      const copy: any = {}
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Skip undefined values
          if (obj[key] !== undefined) {
            copy[key] = safeDeepCopy(obj[key])
          }
        }
      }
      return copy
    }
    
    return obj
  }

  // Clean geometry data to ensure it's properly formatted for the API
  const cleanGeometryData = (geometryData: any): any => {
    if (!geometryData) return {}
    
    // If it's already the results object, use it directly
    if (geometryData.results) {
      return safeDeepCopy(geometryData.results)
    }
    
    // Otherwise, assume it's the geometry data itself
    return safeDeepCopy(geometryData)
  }

  // Helper functions
  const getBuildingCategory = (assumptions: any): string => {
    const enobCategory = assumptions?.enob_category
    console.log('🏢 Raw enob_category from database:', enobCategory)
    return enobCategory || 'Wohngebäude'
  }

  const parseConstructionYear = (construction_year: string | number | null | undefined): string => {
    if (!construction_year) return '1950'
    const yearStr = typeof construction_year === 'number' ? construction_year.toString() : construction_year
    const year = parseInt(yearStr)
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
      console.warn('Invalid construction year:', construction_year, 'Using 1950 as fallback')
      return '1950'
    }
    return yearStr
  }

  const mapToSystemType = (type: string | undefined): SystemType => {
    if (!type) return 'Öl/Gas'
    const validTypes: SystemType[] = ['Öl/Gas', 'Wärmepumpe', 'Fernwärme', 'Biomasse']
    return validTypes.includes(type as SystemType) ? (type as SystemType) : 'Öl/Gas'
  }

  // Create a unified function to build the payload with all parameters
  const buildRetrofitPayload = (
    buildingData: any,
    geometryData: any,
    selectedCo2PathScenario: string,
    selectedCo2CostScenario: string,
    options: {
      constructionSelections?: any,
      retrofitScenario?: any,
      timePreferenceRate?: number,
      dynamicLca?: boolean
    } = {}
  ): RetrofitAnalysisPayload => {
    const assumptions = buildingData.buildings_assumptions
    const gebplz = assumptions.gebplz
    const gmlIds = buildingData.gmlid_gebid_mapping?.map((mapping: GmlMapping) => mapping.gmlid) || []
    
    const actualBuildingCategory = getBuildingCategory(assumptions)
    const actualConstructionYear = parseConstructionYear(assumptions?.construction_year)
    
    // Extract and preserve the results data properly
    const geometryResults = cleanGeometryData(geometryData)
    
    // Base payload with required fields
    const payload: RetrofitAnalysisPayload = {
      building_id: assumptions.building_id,
      gebplz: gebplz,
      building_category: actualBuildingCategory,
      construction_year: actualConstructionYear,
      system_type: assumptions.current_system_type || 'Öl/Gas',
      co2_reduction_scenario: selectedCo2PathScenario,
      co2_cost_scenario: selectedCo2CostScenario,
      gmlid_list: gmlIds,
      geometry_data: geometryResults,
      time_preference_rate: options.timePreferenceRate || 0.03,
      dynamic_lca: options.dynamicLca || false
    }

    // Add construction selections from Lebenszyklusanalyse if provided
    if (options.constructionSelections) {
      payload.window_construction = options.constructionSelections.window_construction
      payload.wall_construction = options.constructionSelections.wall_construction
      payload.roof_construction = options.constructionSelections.roof_construction
      payload.base_construction = options.constructionSelections.base_construction
      payload.dynamic_lca = options.constructionSelections.dynamic_lca
    } else {
      // Use default construction values
      payload.window_construction = 'W-330-001'
      payload.wall_construction = 'F-330-001'
      payload.roof_construction = 'R-360-001'
      payload.base_construction = 'B-360-001'
    }

    // Add retrofit scenario data from "Sanierungszenario hinzufügen" if provided
    if (options.retrofitScenario) {
      // From energy standard selection
      if (options.retrofitScenario.energy_standard && options.retrofitScenario.construction_year) {
        payload.retrofit_scenario_construction = options.retrofitScenario.energy_standard.id
        payload.retrofit_construction_year = parseInt(options.retrofitScenario.construction_year)
      }
      
      // From HVAC selection
      if (options.retrofitScenario.hvac && options.retrofitScenario.hvac_year) {
        payload.retrofit_system_type = options.retrofitScenario.hvac.hvac_type
        payload.retrofit_subsystem_type = options.retrofitScenario.hvac.hvac_type
        payload.retrofit_hvac_year = parseInt(options.retrofitScenario.hvac_year)
      }
    }

    return payload
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
      const gebplz = assumptions.gebplz
      const gmlIds = buildingData.gmlid_gebid_mapping.map((mapping: GmlMapping) => mapping.gmlid)
      
      const actualBuildingCategory = getBuildingCategory(assumptions)
      const actualConstructionYear = parseConstructionYear(assumptions?.construction_year)
      
      // Extract and preserve the results data properly
      const geometryResults = cleanGeometryData(geometryData)
      
      console.log('🔍 Base scenario geometry data validation:')
      console.log('  - Original geometryData has results:', !!geometryData.results)
      console.log('  - Results keys (GML IDs):', Object.keys(geometryData.results || {}))
      console.log('  - Extracted results keys (GML IDs):', Object.keys(geometryResults))
      console.log('  - Results type:', typeof geometryResults)
      console.log('  - Sample GML data structure:', Object.keys(geometryResults).length > 0 ? 
        Object.keys(geometryResults)[0] + ': ' + JSON.stringify(Object.keys(geometryResults[Object.keys(geometryResults)[0]] || {})) : 'No GML data')

      // Validate serialization before sending
      validateGeometryDataSerialization(geometryResults, 'for base scenario')

      const payload = buildRetrofitPayload(
        buildingData,
        geometryData,
        selectedCo2PathScenario,
        selectedCo2CostScenario,
        {} // No special options for base scenario
      )

      console.log('📤 Sending base scenario payload:', payload)


      // Debug each key individually before JSON.stringify
      Object.keys(payload.geometry_data || {}).forEach(key => {
        console.log(`📤 GEOMETRY_DATA[${key}]:`, typeof payload.geometry_data[key], payload.geometry_data[key])
        try {
          const serialized = safeJSONStringify(payload.geometry_data[key])

        } catch (e) {
          console.error(`📤 GEOMETRY_DATA[${key}] safeJSONStringify ERROR:`, e)
        }
      })

      // Log the complete request payload being sent
      const requestBody = safeJSONStringify(payload)


      const response = await fetch(`${apiBaseUrl.value}/api/energy/analyze-retrofit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
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
      
      // Debug: Check if the response contains the original geometry_data structure
      if (data && data.geometry_data) {
        console.log('📥 RESPONSE geometry_data keys:', Object.keys(data.geometry_data || {}))
        console.log('📥 RESPONSE geometry_data type:', typeof data.geometry_data)
        console.log('📥 RESPONSE geometry_data sample:', data.geometry_data)
      } else {
        console.log('📥 RESPONSE does not contain geometry_data field')
      }
      
      retrofitAnalysisResult.value = data
      console.log('🎯 Base scenario analysis completed successfully')

    } catch (err) {
      console.error('❌ Base scenario analysis error:', err)
      retrofitAnalysisError.value = `Base scenario analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    } finally {
      isAnalyzingRetrofit.value = false
    }
  }

  // Construction analysis with specific construction types
  const analyzeWithConstructions = async (
    buildingData: any,
    geometryData: any,
    constructionSelections: any,
    selectedCo2PathScenario: string,
    selectedCo2CostScenario: string,
    retrofitScenario?: any
  ) => {
    try {
      if (!buildingData || !geometryData) {
        retrofitAnalysisError.value = 'Fehlende Gebäudedaten für die Analyse'
        return
      }

      isAnalyzingRetrofit.value = true
      retrofitAnalysisError.value = ''

      console.log('🔍 Debug buildingData structure:', {
        buildingData: buildingData,
        buildingDataKeys: buildingData ? Object.keys(buildingData) : null,
        hasAssumptions: !!buildingData?.buildings_assumptions,
        assumptions: buildingData?.buildings_assumptions,
        assumptionsKeys: buildingData?.buildings_assumptions ? Object.keys(buildingData.buildings_assumptions) : null
      })

      const assumptions = buildingData?.buildings_assumptions
      if (!assumptions) {
        throw new Error('Gebäudeannahmen (buildings_assumptions) sind nicht verfügbar')
      }

      if (!assumptions.building_id) {
        console.error('❌ Missing gebid in assumptions:', assumptions)
        throw new Error('Gebäude-ID (GEBID) ist nicht verfügbar')
      }

      // Use gebplz directly from assumptions, fallback to extracting from gebid
      const gebplz = assumptions.gebplz 


      if (gebplz.length < 5) {
        throw new Error(`Ungültige Postleitzahl: ${gebplz}. Mindestens 5 Zeichen erforderlich.`)
      }

      const gmlIds = buildingData.gmlid_gebid_mapping?.map((mapping: GmlMapping) => mapping.gmlid) || []
      
      const actualBuildingCategory = getBuildingCategory(assumptions)
      const actualConstructionYear = parseConstructionYear(assumptions?.epl)
      
      // Extract and preserve the results data properly
      const geometryResults = cleanGeometryData(geometryData)
      

      // Validate serialization before sending
      validateGeometryDataSerialization(geometryResults, 'for construction analysis')

      console.log('🏗️ Construction analysis data validation:', {
        building_id: assumptions.gebid,
        gebplz: gebplz,
        gebplz_length: gebplz.length,
        building_category: actualBuildingCategory,
        construction_year: actualConstructionYear,
        gmlIds_count: gmlIds.length,
        assumptions_keys: Object.keys(assumptions),
        full_assumptions: assumptions
      })

      const payload = buildRetrofitPayload(
        buildingData,
        geometryData,
        selectedCo2PathScenario,
        selectedCo2CostScenario,
        {
          constructionSelections,
          retrofitScenario,
          timePreferenceRate: 0.03,
          dynamicLca: constructionSelections.dynamic_lca
        }
      )

      console.log('🏗️ Sending construction analysis payload:', payload)
      console.log('🏗️ GEOMETRY_DATA in payload:', payload.geometry_data)
      console.log('🏗️ GEOMETRY_DATA keys:', Object.keys(payload.geometry_data || {}))
      console.log('🏗️ GEOMETRY_DATA type:', typeof payload.geometry_data)

      // Log the complete request payload being sent
      const requestBody = safeJSONStringify(payload)
      console.log('🚀 COMPLETE REQUEST BODY for analyze-retrofit (construction analysis):')
      console.log('📦 Full payload object 1:', payload)
      console.log('📦 Full payload object 1:', requestBody)


      const response = await fetch(`${apiBaseUrl.value}/api/energy/analyze-retrofit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody
      })

      if (!response.ok) {
        let errorDetail = ''
        try {
          const errorData = await response.json()
          console.error('❌ Construction analysis error response:', errorData)
          
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
      console.log('✅ Construction analysis response:', data)
      
      retrofitAnalysisResult.value = data

      toast.success('Konstruktionsanalyse erfolgreich', {
        description: 'Die Lebenszyklusanalyse wurde mit den ausgewählten Konstruktionen durchgeführt.'
      })

      return data

    } catch (err) {
      console.error('❌ Construction analysis error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler'
      retrofitAnalysisError.value = `Konstruktionsanalyse fehlgeschlagen: ${errorMessage}`
      
      toast.error('Konstruktionsanalyse fehlgeschlagen', {
        description: retrofitAnalysisError.value
      })
      throw err
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
      
      // Extract and preserve the results data properly
      const geometryResults = cleanGeometryData(geometryData)



      // Validate serialization before sending
      validateGeometryDataSerialization(geometryResults, 'for retrofit scenario')

      const payload = buildRetrofitPayload(
        buildingData,
        geometryData,
        selectedCo2PathScenario,
        selectedCo2CostScenario,
        {
          retrofitScenario,
          timePreferenceRate: 0.03
        }
      )

      console.log('📤 Sending retrofit scenario payload:', payload)


      // Debug each key individually before JSON.stringify
      Object.keys(payload.geometry_data || {}).forEach(key => {
        console.log(`📤 GEOMETRY_DATA[${key}]:`, typeof payload.geometry_data[key], payload.geometry_data[key])
        try {
          const serialized = safeJSONStringify(payload.geometry_data[key])
          console.log(`📤 GEOMETRY_DATA[${key}] safeJSONStringify success:`, serialized ? 'YES' : 'NO')
        } catch (e) {
          console.error(`📤 GEOMETRY_DATA[${key}] safeJSONStringify ERROR:`, e)
        }
      })

      // Log the complete request payload being sent
      const requestBody = safeJSONStringify(payload)
      console.log('🚀 COMPLETE REQUEST BODY for analyze-retrofit (retrofit scenario):')
      console.log('📦 Full payload object 2:', payload)
      console.log('📦 Full payload object 2:', requestBody)


      const response = await fetch(`${apiBaseUrl.value}/api/energy/analyze-retrofit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: requestBody
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
    analyzeRetrofitScenario,
    analyzeWithConstructions
  }
}
