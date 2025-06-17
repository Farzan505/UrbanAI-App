import { ref, computed, type ComputedRef } from 'vue'

export function useEnergyMetricsCards() {
  // Card display options
  const selectedEnergyType = ref<string>('net')
  const selectedEnergyUnit = ref<string>('per_sqm')
  const selectedEmissionType = ref<string>('total')
  const selectedEmissionUnit = ref<string>('per_sqm')
  const selectedCostType = ref<string>('total_costs')
  const selectedCostUnit = ref<string>('per_sqm')

  // Helper functions
  const formatNumber = (value: number, decimals: number = 0): string => {
    if (isNaN(value) || value === null || value === undefined) return '0'
    return value.toLocaleString('de-DE', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })
  }

  const getImprovementColorClass = (improvement: number): string => {
    if (improvement > 0) return 'text-red-600' // Increase is bad (red)
    if (improvement < 0) return 'text-green-600' // Decrease is good (green)
    return 'text-gray-600' // No change
  }

  const getRiskColorClass = (riskLevel: string): string => {
    switch (riskLevel) {
      case 'low': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  // Create computed properties for card data
  const createCardData = (retrofitAnalysisResult: ComputedRef<any>) => {
    // Energy card data
    const energyCardData = computed(() => {
      console.log('🔍 Energy Card Data Debug:', {
        hasRetrofitAnalysisResult: !!retrofitAnalysisResult.value,
        hasData: !!retrofitAnalysisResult.value?.data,
        dataKeys: retrofitAnalysisResult.value?.data ? Object.keys(retrofitAnalysisResult.value.data) : null,
        hasEnergyResults: !!retrofitAnalysisResult.value?.data?.energy_results,
        energyResults: retrofitAnalysisResult.value?.data?.energy_results,
        selectedType: selectedEnergyType.value,
        selectedUnit: selectedEnergyUnit.value
      })

      const analysisData = retrofitAnalysisResult.value?.data
      if (!analysisData?.energy_results) {
        console.log('❌ No energy_results data found in analysis response')
        return null
      }

      // For now, create mock data structure based on energy_results
      // This will need to be updated based on the actual API response format
      const energyResults = analysisData.energy_results
      console.log('🔍 Energy results structure:', energyResults)
      
      // Create a basic card with available energy data
      const mockBaseline = {
        value: energyResults.annual_heating_demand || 0,
        unit: 'kWh/a'
      }
      
      const mockScenarios: any[] = []
      
      // Create basic options
      const energyTypeOptions = [
        { key: 'net', label: 'Netto Energie' },
        { key: 'end', label: 'Endenergie' },
        { key: 'primary', label: 'Primärenergie' }
      ]
      
      const unitOptions = [
        { key: 'per_sqm', label: 'pro m²' },
        { key: 'total', label: 'Gesamt' }
      ]
      
      return {
        baseline: mockBaseline,
        scenarios: mockScenarios,
        options: {
          energy_types: energyTypeOptions,
          units: unitOptions
        }
      }
    })

    // Emission card data
    const emissionCardData = computed(() => {
      const analysisData = retrofitAnalysisResult.value?.data
      if (!analysisData?.energy_results) return null

      // For now, create mock data structure - to be updated based on actual API format
      const mockBaseline = {
        value: 0, // Will be calculated from energy results
        unit: 'kg CO₂/a'
      }
      
      const mockScenarios: any[] = []
      
      // Create labeled options for dropdowns
      const emissionTypeOptions = [
        { key: 'scope_1', label: 'Scope 1' },
        { key: 'scope_2', label: 'Scope 2' },
        { key: 'scope_3', label: 'Scope 3' },
        { key: 'total', label: 'Gesamt' }
      ]
      
      const unitOptions = [
        { key: 'per_sqm', label: 'pro m²' },
        { key: 'total', label: 'Gesamt' }
      ]
      
      return {
        baseline: mockBaseline,
        scenarios: mockScenarios,
        options: {
          emission_types: emissionTypeOptions,
          units: unitOptions
        }
      }
    })

    // Stranding card data
    const strandingCardData = computed(() => {
      const analysisData = retrofitAnalysisResult.value?.data
      if (!analysisData) return null

      // For now, create mock data structure - to be updated based on actual API format
      return {
        baseline: {
          value: 15, // Mock value - years to stranding
          unit: 'Jahre bis Stranding',
          status: 'Mittel Risiko',
          riskLevel: 'medium'
        },
        scenarios: []
      }
    })

    // Cost card data
    const costCardData = computed(() => {
      const analysisData = retrofitAnalysisResult.value?.data
      if (!analysisData?.energy_results) return null

      // For now, create mock data structure - to be updated based on actual API format
      const mockBaseline = {
        value: 2500, // Mock value - annual operating costs
        unit: '€/a'
      }
      
      const mockScenarios: any[] = []
      
      // Create labeled options for dropdowns
      const costTypeOptions = [
        { key: 'energy_costs', label: 'Energiekosten' },
        { key: 'co2_costs', label: 'CO₂-Kosten' },
        { key: 'total_costs', label: 'Gesamtkosten' }
      ]
      
      const unitOptions = [
        { key: 'per_sqm', label: 'pro m²' },
        { key: 'total', label: 'Gesamt' }
      ]
      
      return {
        baseline: mockBaseline,
        scenarios: mockScenarios,
        options: {
          cost_types: costTypeOptions,
          units: unitOptions
        }
      }
    })

    return {
      energyCardData,
      emissionCardData,
      strandingCardData,
      costCardData
    }
  }

  return {
    // State
    selectedEnergyType,
    selectedEnergyUnit,
    selectedEmissionType,
    selectedEmissionUnit,
    selectedCostType,
    selectedCostUnit,
    
    // Helper functions
    formatNumber,
    getImprovementColorClass,
    getRiskColorClass,
    
    // Card data factory
    createCardData
  }
}
