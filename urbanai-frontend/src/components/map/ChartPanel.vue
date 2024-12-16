<template>
  <div class="w-full p-4 bg-background" style="height: 100%;">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-lg font-semibold">Category Distribution</h3>
      <div class="text-sm text-muted-foreground">
        {{ colorByProperty ? `Distribution for: ${colorByProperty}` : 'Select a property for visualization' }}
      </div>
    </div>
    <div ref="chartContainer" class="h-[calc(100%-2.5rem)]">
      <calcite-chart
        v-if="chartData.length > 0"
        ref="statsChart"
        type="pie"
        height-scale="l"
        width-scale="l"
        :data="chartData"
        :config="{
          margins: { top: 20, right: 20, bottom: 40, left: 40 },
          colors: chartColors
        }"
      />
      <div 
        v-else-if="!chartData.length && colorByProperty" 
        class="flex items-center justify-center h-full text-muted-foreground"
      >
        No data available for the selected property
      </div>
      <div 
        v-else 
        class="flex items-center justify-center h-full text-muted-foreground"
      >
        Select a property to view distribution
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'

interface Feature {
  id: string
  type: "Feature"
  properties: Record<string, any>
  geometry: any
}

interface Props {
  colorByProperty: string
  filteredFeatures: Feature[]
}

const props = defineProps<Props>()
const chartContainer = ref<HTMLElement | null>(null)
const statsChart = ref<any>(null)

// Chart colors with transparency
const CHART_COLORS = [
  '#fc3e5aff', '#fce138ff', '#4c81cdff', '#f1983cff', '#48885cff', 
  '#a553b7ff', '#fff799ff', '#b1a9d0ff', '#6ecffcff', '#fc6f84ff', 
  '#6af689ff', '#fcd27eff'
]

const chartColors = computed(() => {
  return CHART_COLORS.map(color => color.replace(/ff$/, 'cc'))
})

const chartData = computed(() => {
  if (!props.filteredFeatures.length || !props.colorByProperty) return []

  const valueCounts = props.filteredFeatures.reduce((acc: Record<string, number>, feature: Feature) => {
    const value = String(feature.properties[props.colorByProperty])
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})

  return Object.entries(valueCounts)
    .map(([value, count]) => ({
      name: value,
      value: count
    }))
    .sort((a, b) => b.value - a.value)
})

function updateChartSize() {
  if (statsChart.value) {
    // Force chart to update its size
    statsChart.value.dispatchEvent(new Event('resize'))
  }
}

// Watch for changes in filtered features or color property
watch([() => props.filteredFeatures, () => props.colorByProperty], () => {
  if (statsChart.value && chartData.value.length > 0) {
    // Update chart data
    const chart = statsChart.value as any
    chart.data = chartData.value
  }
}, { deep: true })

onMounted(() => {
  window.addEventListener('resize', updateChartSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateChartSize)
})
</script>

<style scoped>
calcite-chart {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
