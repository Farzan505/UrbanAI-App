import { ref, computed, type ComputedRef } from 'vue'

export function useEnergyMetricsCards() {
  // Card display options - using more generic defaults that are likely to exist
  const selectedEnergyType = ref<string>('primary')
  const selectedEnergyUnit = ref<string>('total')
  const selectedEmissionType = ref<string>('total')
  const selectedEmissionUnit = ref<string>('total')
  const selectedCostType = ref<string>('energy_costs')
  const selectedCostUnit = ref<string>('total')

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
        fullResult: retrofitAnalysisResult.value,
        hasFrontendData: !!retrofitAnalysisResult.value?.frontend_data,
        frontendDataKeys: retrofitAnalysisResult.value?.frontend_data ? Object.keys(retrofitAnalysisResult.value.frontend_data) : null,
        hasCards: !!retrofitAnalysisResult.value?.frontend_data?.cards,
        cardsKeys: retrofitAnalysisResult.value?.frontend_data?.cards ? Object.keys(retrofitAnalysisResult.value.frontend_data.cards) : null,
        energyCard: retrofitAnalysisResult.value?.frontend_data?.cards?.energiebedarf,
        selectedType: selectedEnergyType.value,
        selectedUnit: selectedEnergyUnit.value
      })

      // Check for frontend_data structure first
      const frontendData = retrofitAnalysisResult.value?.frontend_data
      if (!frontendData?.cards?.energiebedarf) {
        console.log('❌ No frontend_data.cards.energiebedarf found in analysis response')
        return null
      }

      // Use frontend_data structure
      const energyCard = frontendData.cards.energiebedarf
      console.log('✅ Using frontend_data energy card:', energyCard)

      // Auto-select first available energy type if current selection doesn't exist
      const availableEnergyTypes = Object.keys(energyCard.data.baseline)
      if (!availableEnergyTypes.includes(selectedEnergyType.value)) {
        console.log('🔄 Auto-selecting first available energy type:', availableEnergyTypes[0])
        selectedEnergyType.value = availableEnergyTypes[0]
      }

      // Get baseline data for selected type
      const baselineTypeData = energyCard.data.baseline[selectedEnergyType.value]
      if (!baselineTypeData) {
        console.log('❌ No baseline data for selected energy type:', selectedEnergyType.value, 'Available types:', availableEnergyTypes)
        return null
      }

      // Determine unit key and value based on selection
      const unitKey = selectedEnergyUnit.value === 'total' ? 'total_kwh' : 'per_sqm_kwh'
      const unitLabel = selectedEnergyUnit.value === 'total' ? 'kWh' : 'kWh/m²'

      // Build baseline
      const baseline = {
        value: baselineTypeData[unitKey] || 0,
        unit: unitLabel
      }

      // Build scenarios from retrofits data
      const scenarios = Object.entries(energyCard.data.retrofits || {}).map(([scenarioName, scenarioData]: [string, any]) => {
        const scenarioTypeData = scenarioData[selectedEnergyType.value]
        if (!scenarioTypeData) return null

        const scenarioValue = scenarioTypeData[unitKey] || 0
        const improvement = energyCard.data.improvements?.[scenarioName]?.[selectedEnergyType.value]?.improvement_percent || 0

        return {
          name: scenarioName,
          value: scenarioValue,
          improvement: -improvement, // Negative because improvement is reduction
          unit: unitLabel
        }
      }).filter((scenario): scenario is NonNullable<typeof scenario> => scenario !== null)

      // Build options from display_options
      const energyTypeOptions = energyCard.display_options?.energy_types || [
        { key: 'net', label: 'Netto-Energie' },
        { key: 'end', label: 'End-Energie' },
        { key: 'primary', label: 'Primär-Energie' }
      ]

      const unitOptions = energyCard.display_options?.units || [
        { key: 'total', label: 'Gesamt (kWh)' },
        { key: 'per_sqm', label: 'Pro m² (kWh/m²)' }
      ]

      return {
        baseline,
        scenarios,
        options: {
          energy_types: energyTypeOptions,
          units: unitOptions
        }
      }
    })

    // Emission card data
    const emissionCardData = computed(() => {
      const frontendData = retrofitAnalysisResult.value?.frontend_data
      if (!frontendData?.cards?.emissionen) {
        console.log('❌ No frontend_data.cards.emissionen found')
        return null
      }

      const emissionsCard = frontendData.cards.emissionen
      console.log('✅ Using frontend_data emissions card:', emissionsCard)

      // Auto-select first available emission type if current selection doesn't exist
      const availableEmissionTypes = Object.keys(emissionsCard.data.baseline)
      if (!availableEmissionTypes.includes(selectedEmissionType.value)) {
        console.log('🔄 Auto-selecting first available emission type:', availableEmissionTypes[0])
        selectedEmissionType.value = availableEmissionTypes[0]
      }

      // Get baseline data for selected type
      const baselineTypeData = emissionsCard.data.baseline[selectedEmissionType.value]
      if (!baselineTypeData) {
        console.log('❌ No baseline data for selected emission type:', selectedEmissionType.value, 'Available types:', availableEmissionTypes)
        return null
      }

      // Determine unit key and value based on selection
      const unitKey = selectedEmissionUnit.value === 'total' ? 'total_kg_co2' : 'per_sqm_kg_co2'
      const unitLabel = selectedEmissionUnit.value === 'total' ? 'kg CO₂' : 'kg CO₂/m²'

      // Build baseline
      const baseline = {
        value: baselineTypeData[unitKey] || 0,
        unit: unitLabel
      }

      // Build scenarios from retrofits data
      const scenarios = Object.entries(emissionsCard.data.retrofits || {}).map(([scenarioName, scenarioData]: [string, any]) => {
        const scenarioTypeData = scenarioData[selectedEmissionType.value]
        if (!scenarioTypeData) return null

        const scenarioValue = scenarioTypeData[unitKey] || 0
        const improvement = emissionsCard.data.improvements?.[scenarioName]?.[selectedEmissionType.value]?.improvement_percent || 0

        return {
          name: scenarioName,
          value: scenarioValue,
          improvement: -improvement, // Negative because improvement is reduction
          unit: unitLabel
        }
      }).filter((scenario): scenario is NonNullable<typeof scenario> => scenario !== null)

      // Build options from display_options
      const emissionTypeOptions = emissionsCard.display_options?.emission_types || [
        { key: 'scope_1', label: 'Scope 1' },
        { key: 'scope_2', label: 'Scope 2' },
        { key: 'scope_3', label: 'Scope 3' },
        { key: 'total', label: 'Gesamt' }
      ]

      const unitOptions = emissionsCard.display_options?.units || [
        { key: 'total', label: 'Gesamt (kg CO₂)' },
        { key: 'per_sqm', label: 'Pro m² (kg CO₂/m²)' }
      ]

      return {
        baseline,
        scenarios,
        options: {
          emission_types: emissionTypeOptions,
          units: unitOptions
        }
      }
    })

    // Stranding card data
    const strandingCardData = computed(() => {
      const frontendData = retrofitAnalysisResult.value?.frontend_data
      if (!frontendData?.cards?.stranding) {
        console.log('❌ No frontend_data.cards.stranding found')
        return null
      }

      const strandingCard = frontendData.cards.stranding
      console.log('✅ Using frontend_data stranding card:', strandingCard)

      // Stranding card has a simpler structure
      const baseline = {
        value: strandingCard.data?.baseline?.years_to_stranding || 0,
        unit: 'Jahre',
        status: strandingCard.data?.baseline?.compliance_status || 'Unbekannt',
        riskLevel: strandingCard.data?.baseline?.risk_level || 'medium'
      }

      // Build scenarios from retrofits data
      const scenarios = Object.entries(strandingCard.data?.retrofits || {}).map(([scenarioName, scenarioData]: [string, any]) => {
        const improvement = scenarioData.improvement_years || 0
        return {
          name: scenarioName,
          value: scenarioData.years_to_stranding || 0,
          improvement: improvement,
          unit: 'Jahre'
        }
      })

      return {
        baseline,
        scenarios
      }
    })

    // Cost card data
    const costCardData = computed(() => {
      const frontendData = retrofitAnalysisResult.value?.frontend_data
      if (!frontendData?.cards?.betriebskosten) {
        console.log('❌ No frontend_data.cards.betriebskosten found')
        return null
      }

      const costsCard = frontendData.cards.betriebskosten
      console.log('✅ Using frontend_data costs card:', costsCard)

      // Auto-select first available cost type if current selection doesn't exist
      const availableCostTypes = Object.keys(costsCard.data.baseline)
      if (!availableCostTypes.includes(selectedCostType.value)) {
        console.log('🔄 Auto-selecting first available cost type:', availableCostTypes[0])
        selectedCostType.value = availableCostTypes[0]
      }

      // Get baseline data for selected type
      const baselineTypeData = costsCard.data.baseline[selectedCostType.value]
      if (!baselineTypeData) {
        console.log('❌ No baseline data for selected cost type:', selectedCostType.value, 'Available types:', availableCostTypes)
        return null
      }

      // Determine unit key and value based on selection
      const unitKey = selectedCostUnit.value === 'total' ? 'total_eur' : 'per_sqm_eur'
      const unitLabel = selectedCostUnit.value === 'total' ? 'EUR' : 'EUR/m²'

      // Build baseline
      const baseline = {
        value: baselineTypeData[unitKey] || 0,
        unit: unitLabel
      }

      // Build scenarios from retrofits data
      const scenarios = Object.entries(costsCard.data.retrofits || {}).map(([scenarioName, scenarioData]: [string, any]) => {
        const scenarioTypeData = scenarioData[selectedCostType.value]
        if (!scenarioTypeData) return null

        const scenarioValue = scenarioTypeData[unitKey] || 0
        const improvement = costsCard.data.improvements?.[scenarioName]?.[selectedCostType.value]?.improvement_percent || 0

        return {
          name: scenarioName,
          value: scenarioValue,
          improvement: -improvement, // Negative because improvement is reduction
          unit: unitLabel
        }
      }).filter((scenario): scenario is NonNullable<typeof scenario> => scenario !== null)

      // Build options from display_options
      const costTypeOptions = costsCard.display_options?.cost_types || [
        { key: 'energy_costs', label: 'Energiekosten' },
        { key: 'co2_costs', label: 'CO₂-Kosten' },
        { key: 'total_costs', label: 'Gesamtkosten' }
      ]

      const unitOptions = costsCard.display_options?.units || [
        { key: 'total', label: 'Gesamt (EUR)' },
        { key: 'per_sqm', label: 'Pro m² (EUR/m²)' }
      ]

      return {
        baseline,
        scenarios,
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
