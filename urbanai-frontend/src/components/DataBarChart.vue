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
  ArcElement
} from 'chart.js'
import { computed, ref, onMounted, watch } from 'vue'
import Skeleton from './ui/skeleton/Skeleton.vue'

// Rest of the code remains the same
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface DataPoint {
  [key: string]: any
}

interface TooltipItem {
  name: string
  color: string
  value: number | string
}

const props = defineProps<{
  data: Array<DataPoint>
  columns: string[]
  selectedColumn: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:selectedColumn': [value: string]
}>()

const isDarkMode = ref(false)
const chartRef = ref<any>(null)

onMounted(() => {
  // Initial check
  isDarkMode.value = document.documentElement.classList.contains('dark')

  // Watch for theme changes
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
})

// Watch for theme changes and update chart
watch(isDarkMode, (newValue) => {
  if (chartRef.value?.chart) {
    const textColor = newValue ? '#e5e7eb' : '#374151'
    chartRef.value.chart.options.scales.y.ticks.color = textColor
    chartRef.value.chart.options.scales.x.ticks.color = textColor
    chartRef.value.chart.options.plugins.legend.labels.color = textColor
    chartRef.value.chart.update()
  }
})

// Check if data is string type
const isStringData = computed(() => {
  if (!props.data.length) return false
  const firstValue = props.data[0][props.selectedColumn]
  return typeof firstValue === 'string'
})

// Prepare data for doughnut chart (aggregate string values)
const doughnutChartData = computed(() => {
  if (!isStringData.value) return null

  const aggregatedData: Record<string, number> = {}
  props.data.forEach(item => {
    const value = item[props.selectedColumn]
    aggregatedData[value] = (aggregatedData[value] || 0) + 1
  })

  const labels = Object.keys(aggregatedData)
  const data = Object.values(aggregatedData)
  const colors = labels.map((_, i) => `hsl(${(i * 360) / labels.length}, 70%, 50%)`)

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
  if (isStringData.value) return null

  const labels = props.data.map((d, i) => d.year || d.id || i.toString())
  
  const datasets = [
    {
      label: props.selectedColumn,
      data: props.data.map(d => d[props.selectedColumn]),
      backgroundColor: 'rgb(75, 192, 192)',
      borderColor: 'rgb(75, 192, 192)',
      borderWidth: 1,
      borderRadius: 4,
    }
  ]

  return {
    labels,
    datasets
  }
})

// Handle column selection
const handleColumnChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:selectedColumn', target.value)
}

// Chart options
const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  layout: {
    padding: {
      top: 20,
      bottom: 20,
      left: 20,
      right: isStringData.value ? 100 : 20 // Extra padding for legend when using doughnut
    }
  },
  plugins: {
    legend: {
      position: isStringData.value ? 'right' : 'top' as const,
      labels: {
        usePointStyle: true,
        pointStyle: isStringData.value ? 'circle' : 'rect',
        padding: 20,
        color: isDarkMode.value ? '#e5e7eb' : '#374151',
        font: {
          size: 12,
          family: "'Inter', sans-serif"
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
          return isStringData.value ? `${label}: ${value} items` : `${props.selectedColumn}: ${value}`
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
    <div class="flex items-center gap-2">
      <label class="text-sm font-medium">Select Column:</label>
      <select
        :value="selectedColumn"
        @change="handleColumnChange"
        class="rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        :disabled="loading"
      >
        <option v-for="column in columns" :key="column" :value="column">
          {{ column }}
        </option>
      </select>
    </div>

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
