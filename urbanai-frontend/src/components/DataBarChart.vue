<script setup lang="ts">
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartData,
  ChartOptions
} from 'chart.js'
import { computed, ref, onMounted, watch } from 'vue'
import Skeleton from './ui/skeleton/Skeleton.vue'
import type { Feature } from '../types/map'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

// Use the same colors as the map layers
const MAP_COLORS = [
  "#fc3e5aff", "#fce138ff", "#4c81cdff", "#f1983cff", "#48885cff",
  "#a553b7ff", "#fff799ff", "#b1a9d0ff", "#6ecffcff", "#fc6f84ff",
  "#6af689ff", "#fcd27eff"
]

const props = defineProps<{
  filteredFeatures: Feature[]
  colorProperty: string[]
  loading?: boolean
  selectedValues?: string[]
}>()

const emit = defineEmits<{
  'update:selectedValues': [value: string[]]
}>()

const isDarkMode = ref(false)
const chartRef = ref<any>(null)
const hiddenLegendItems = ref(new Set<string>())

// Register the plugin globally
ChartJS.register({
  id: 'centerText',
  beforeDraw: (chart: any) => {
    if (chart.config.type !== 'doughnut') return

    const { ctx, data } = chart
    if (!data.datasets?.[0]?.data?.length) return

    const total = data.datasets[0].data.reduce((sum: number, value: number) => sum + value, 0)
    if (!total) return

    const centerX = (chart.chartArea.left + chart.chartArea.right) / 2
    const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2

    // Save context state
    ctx.save()
    
    // Configure text
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Draw total number
    ctx.font = 'bold 24px Inter'
    ctx.fillStyle = isDarkMode.value ? '#e5e7eb' : '#374151'
    ctx.fillText(total.toString(), centerX, centerY - 12)
    
    // Draw "Total" label
    ctx.font = '14px Inter'
    ctx.fillStyle = isDarkMode.value ? '#9ca3af' : '#6b7280'
    ctx.fillText('Total', centerX, centerY + 12)
    
    // Restore context state
    ctx.restore()
  }
})

onMounted(() => {
  isDarkMode.value = document.documentElement.classList.contains('dark')

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        isDarkMode.value = document.documentElement.classList.contains('dark')
      }
    })
  })

  observer.observe(document.documentElement, {
    attributes: true
  })

  if (chartRef.value?.chart) {
    const chart = chartRef.value.chart
    chart.options.plugins.legend.onClick = (e: any, legendItem: any) => {
      const value = legendItem.text
      if (hiddenLegendItems.value.has(value)) {
        hiddenLegendItems.value.delete(value)
      } else {
        hiddenLegendItems.value.add(value)
      }
      
      const visibleValues = Object.keys(aggregatedData.value)
        .filter(key => !hiddenLegendItems.value.has(key))
      
      emit('update:selectedValues', visibleValues)
      
      chart.setDatasetVisibility(legendItem.datasetIndex, !chart.isDatasetVisible(legendItem.datasetIndex))
      chart.update()
    }
  }
})

watch(isDarkMode, (newValue) => {
  if (chartRef.value?.chart) {
    const textColor = newValue ? '#e5e7eb' : '#374151'
    chartRef.value.chart.options.scales.y.ticks.color = textColor
    chartRef.value.chart.options.scales.x.ticks.color = textColor
    chartRef.value.chart.options.plugins.legend.labels.color = textColor
    chartRef.value.chart.update()
  }
})

watch(() => props.selectedValues, (newValues) => {
  if (chartRef.value?.chart && newValues) {
    const chart = chartRef.value.chart
    hiddenLegendItems.value = new Set(
      Object.keys(aggregatedData.value)
        .filter(key => !newValues.includes(key))
    )
    chart.update()
  }
}, { deep: true })

// Check if data is string type
const isStringData = computed(() => {
  if (!props.filteredFeatures.length || !props.colorProperty[0]) return false
  const firstValue = props.filteredFeatures[0].properties[props.colorProperty[0]]
  return typeof firstValue === 'string'
})

// Prepare aggregated data
const aggregatedData = computed(() => {
  if (!isStringData.value || !props.colorProperty[0]) return {}

  const data: Record<string, number> = {}
  props.filteredFeatures.forEach(feature => {
    const value = feature.properties[props.colorProperty[0]]
    data[value] = (data[value] || 0) + 1
  })
  return data
})

// Prepare data for doughnut chart (aggregate string values)
const doughnutChartData = computed(() => {
  if (!isStringData.value || !props.colorProperty[0]) return {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [],
      borderColor: isDarkMode.value ? 'rgb(17, 24, 39)' : 'white',
      borderWidth: 2,
      cutout: '60%'
    }]
  }

  const labels = Object.keys(aggregatedData.value)
  const data = Object.values(aggregatedData.value)
  const colors = labels.map((_, i) => MAP_COLORS[i % MAP_COLORS.length].replace(/ff$/, 'cc'))

  return {
    labels,
    datasets: [{
      data,
      backgroundColor: colors,
      borderColor: isDarkMode.value ? 'rgb(17, 24, 39)' : 'white',
      borderWidth: 2,
      cutout: '60%'
    }]
  }
})

// Prepare data for bar chart (numeric values)
const barChartData = computed(() => {
  if (!props.colorProperty[0] || isStringData.value) return {
    labels: [],
    datasets: [{
      label: props.colorProperty[0] || '',
      data: [],
      backgroundColor: MAP_COLORS[0].replace(/ff$/, 'cc'),
      borderColor: MAP_COLORS[0],
      borderWidth: 1,
      borderRadius: 4,
    }]
  }

  const labels = props.filteredFeatures.map((f, i) => f.properties.year || f.properties.id || i.toString())
  
  return {
    labels,
    datasets: [{
      label: props.colorProperty[0],
      data: props.filteredFeatures.map(f => f.properties[props.colorProperty[0]]),
      backgroundColor: MAP_COLORS[0].replace(/ff$/, 'cc'),
      borderColor: MAP_COLORS[0],
      borderWidth: 1,
      borderRadius: 4,
    }]
  }
})

// Chart options
const chartOptions = computed<ChartOptions<'bar' | 'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const
  },
  layout: {
    padding: {
      top: 20,
      bottom: 20,
      left: 20,
      right: isStringData.value ? 100 : 20
    }
  },
  plugins: {
    legend: {
      position: isStringData.value ? 'right' as const : 'top' as const,
      labels: {
        usePointStyle: true,
        pointStyle: isStringData.value ? 'circle' : 'rect',
        padding: 20,
        color: isDarkMode.value ? '#e5e7eb' : '#374151',
        font: {
          size: 12,
          family: "'Inter', sans-serif"
        },
        filter: (legendItem: any) => {
          return !hiddenLegendItems.value.has(legendItem.text)
        }
      }
    },
    tooltip: {
      enabled: true,
      backgroundColor: isDarkMode.value ? 'rgb(17, 24, 39)' : 'white',
      titleColor: isDarkMode.value ? '#e5e7eb' : '#374151',
      bodyColor: isDarkMode.value ? '#e5e7eb' : '#374151',
      borderColor: isDarkMode.value ? 'rgb(75, 85, 99)' : 'rgb(229, 231, 235)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      titleFont: {
        size: 14,
        weight: 'bold',
        family: "'Inter', sans-serif"
      },
      bodyFont: {
        size: 13,
        family: "'Inter', sans-serif"
      },
      callbacks: {
        label: function(context: any) {
          const label = context.label || ''
          const value = context.raw
          return isStringData.value ? `${label}: ${value} items` : `${props.colorProperty[0]}: ${value}`
        }
      }
    }
  },
  ...(!isStringData.value && {
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: isDarkMode.value ? '#e5e7eb' : '#374151',
          font: {
            family: "'Inter', sans-serif"
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: isDarkMode.value ? '#e5e7eb' : '#374151',
          font: {
            family: "'Inter', sans-serif"
          }
        }
      }
    }
  })
}))
</script>

<template>
  <div class="flex flex-col gap-4 h-full">
    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex flex-col space-y-3">
      <Skeleton class="h-[125px] w-full rounded-xl" />
      <div class="space-y-2">
        <Skeleton class="h-4 w-[250px]" />
        <Skeleton class="h-4 w-[200px]" />
      </div>
    </div>

    <!-- Chart -->
    <div v-else class="flex-1 min-h-0">
      <component
        :is="isStringData ? Doughnut : Bar"
        ref="chartRef"
        :data="isStringData ? doughnutChartData : barChartData"
        :options="chartOptions"
      />
    </div>
  </div>
</template>

<style>
.chart-container {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
