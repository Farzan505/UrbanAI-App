<template>
  <Card class="w-full">
    <CardHeader class="py-2 border-b">
      <CardTitle class="text-lg">Category Distribution</CardTitle>
      <div class="text-sm text-muted-foreground">
        {{ colorProperty[0] ? `Distribution for: ${colorProperty[0]}` : 'Select a property for visualization' }}
      </div>
    </CardHeader>
    <CardContent class="p-4">
      <div ref="chartContainer" class="h-[300px]">
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
          v-else-if="!chartData.length && colorProperty[0]" 
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
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import type { Feature } from '../../types/map'

interface Props {
  colorProperty: string[]
  filteredFeatures: Feature[]
}

const props = defineProps<Props>()
const chartContainer = ref<HTMLElement | null>(null)
const statsChart = ref<any>(null)

// Use the same colors as the map layers
const MAP_COLORS = [
  "#fc3e5aff", "#fce138ff", "#4c81cdff", "#f1983cff", "#48885cff",
  "#a553b7ff", "#fff799ff", "#b1a9d0ff", "#6ecffcff", "#fc6f84ff",
  "#6af689ff", "#fcd27eff"
]

const chartColors = computed(() => {
  if (!chartData.value.length) return []
  
  // Create a color map for unique values
  const uniqueValues = chartData.value.map(item => item.name)
  return uniqueValues.map((_, index) => {
    const color = MAP_COLORS[index % MAP_COLORS.length]
    return color.replace(/ff$/, 'cc') // Match map transparency
  })
})

const chartData = computed(() => {
  if (!props.filteredFeatures.length || !props.colorProperty[0]) return []

  const valueCounts = props.filteredFeatures.reduce((acc: Record<string, number>, feature: Feature) => {
    const value = String(feature.properties[props.colorProperty[0]])
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
watch([() => props.filteredFeatures, () => props.colorProperty], () => {
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
