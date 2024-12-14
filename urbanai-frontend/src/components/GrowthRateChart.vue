<script setup lang="ts">
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { computed, ref, onMounted, watch } from 'vue'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface DataPoint {
  year: number
  'Export Growth Rate'?: number
  'Import Growth Rate'?: number
  'Single Point'?: number
}

interface TooltipItem {
  name: string
  color: string
  value: number
}

const props = defineProps<{
  data: Array<DataPoint>
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

// Custom tooltip HTML
const getTooltipLabel = (context: any) => {
  const dataIndex = context.dataIndex
  const year = props.data[dataIndex].year
  const items: TooltipItem[] = context.chart.data.datasets
    .map((dataset: any, i: number) => ({
      name: dataset.label,
      color: dataset.borderColor,
      value: dataset.data[dataIndex]
    }))
    .filter((item: TooltipItem) => item.value !== undefined)

  return `
    <div class="bg-background border border-border rounded-lg shadow-sm p-3 text-sm min-w-[180px]">
      <div class="pb-2 border-b mb-2 font-medium">
        ${year}
      </div>
      <div class="flex flex-col gap-1">
        ${items.map(item => `
          <div class="flex justify-between items-center">
            <div class="flex items-center">
              <span class="w-2.5 h-2.5 mr-2">
                <svg width="100%" height="100%" viewBox="0 0 30 30">
                  <circle cx="15" cy="15" r="6" fill="${item.color}" stroke="white" stroke-width="2"/>
                </svg>
              </span>
              <span>${item.name}</span>
            </div>
            <span class="font-semibold ml-4">${item.value}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

// Prepare datasets
const chartData = computed(() => {
  const labels = props.data.map(d => d.year.toString())
  
  const datasets = [
    {
      label: 'Export Growth Rate',
      data: props.data.map(d => d['Export Growth Rate']),
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgb(75, 192, 192)',
      tension: 0.1,
      pointRadius: 4,
      pointHoverRadius: 6
    },
    {
      label: 'Import Growth Rate',
      data: props.data.map(d => d['Import Growth Rate']),
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgb(255, 99, 132)',
      tension: 0.1,
      pointRadius: 4,
      pointHoverRadius: 6
    },
    {
      label: 'Single Point',
      data: props.data.map(d => d['Single Point']),
      borderColor: 'rgb(54, 162, 235)',
      backgroundColor: 'rgb(54, 162, 235)',
      pointRadius: 6,
      pointHoverRadius: 8,
      showLine: false // Don't show line for single points
    }
  ]

  return {
    labels,
    datasets
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  plugins: {
    legend: {
      position: 'top' as const,
      onClick: function(e: any, legendItem: any, legend: any) {
        const index = legendItem.index;
        const chart = legend.chart;
        
        if (chart.isDatasetVisible(index)) {
          chart.hide(index);
          legendItem.hidden = true;
        } else {
          chart.show(index);
          legendItem.hidden = false;
        }
      },
      labels: {
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 20,
        color: isDarkMode.value ? '#e5e7eb' : '#374151', // text-gray-200 : text-gray-700
        font: {
          size: 12,
          family: "'Inter', sans-serif"
        },
        generateLabels: (chart: any) => {
          const datasets = chart.data.datasets
          return datasets.map((dataset: any, i: number) => ({
            text: dataset.label,
            fillStyle: dataset.backgroundColor,
            strokeStyle: dataset.borderColor,
            lineWidth: 2,
            hidden: !chart.isDatasetVisible(i),
            index: i
          }))
        }
      }
    },
    tooltip: {
      enabled: false,
      external: function(context: any) {
        let tooltipEl = document.getElementById('chartjs-tooltip')

        if (!tooltipEl) {
          tooltipEl = document.createElement('div')
          tooltipEl.id = 'chartjs-tooltip'
          tooltipEl.innerHTML = '<div></div>'
          document.body.appendChild(tooltipEl)
        }

        const tooltipModel = context.tooltip
        if (tooltipModel.opacity === 0) {
          tooltipEl.style.opacity = '0'
          return
        }

        tooltipEl.classList.remove('above', 'below', 'no-transform')
        if (tooltipModel.yAlign) {
          tooltipEl.classList.add(tooltipModel.yAlign)
        } else {
          tooltipEl.classList.add('no-transform')
        }

        if (tooltipModel.body) {
          const bodyLines = tooltipModel.body.map((b: any) => b.lines)
          const tooltipContent = tooltipEl.querySelector('div')
          if (tooltipContent) {
            tooltipContent.innerHTML = getTooltipLabel(tooltipModel.dataPoints[0])
          }
        }

        const position = context.chart.canvas.getBoundingClientRect()
        tooltipEl.style.opacity = '1'
        tooltipEl.style.position = 'absolute'
        tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px'
        tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px'
        tooltipEl.style.pointerEvents = 'none'
        tooltipEl.style.transform = 'translate(-50%, -100%)'
      }
    }
  },
  scales: {
    y: {
      beginAtZero: false,
      grid: {
        display: true,
        color: isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      },
      ticks: {
        color: isDarkMode.value ? '#e5e7eb' : '#374151', // text-gray-200 : text-gray-700
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
        color: isDarkMode.value ? '#e5e7eb' : '#374151', // text-gray-200 : text-gray-700
        font: {
          family: "'Inter', sans-serif"
        }
      }
    }
  }
}))
</script>

<template>
  <Line
    ref="chartRef"
    :data="chartData"
    :options="chartOptions"
  />
</template>

<style>
#chartjs-tooltip {
  background: white;
  border: 1px solid rgb(229, 231, 235); /* border-gray-200 */
  border-radius: 0.5rem;
  font-family: 'Inter', sans-serif;
  color: rgb(55, 65, 81); /* text-gray-700 */
  z-index: 100;
}

.dark #chartjs-tooltip {
  background: rgb(17, 24, 39); /* bg-gray-900 */
  border-color: rgb(75, 85, 99); /* border-gray-600 */
  color: rgb(229, 231, 235); /* text-gray-200 */
}
</style>
