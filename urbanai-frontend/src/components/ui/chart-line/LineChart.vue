<script setup lang="ts" generic="T extends Record<string, any>">
import type { BaseChartProps } from '.'
import { ChartCrosshair, ChartLegend, defaultColors } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { type BulletLegendItemInterface, CurveType } from '@unovis/ts'
import { Axis, Line } from '@unovis/ts'
import { VisAxis, VisLine, VisXYContainer } from '@unovis/vue'
import { useMounted } from '@vueuse/core'
import { type Component, computed, ref } from 'vue'

const props = withDefaults(defineProps<BaseChartProps<T> & {
  customTooltip?: Component
  curveType?: CurveType
}>(), {
  curveType: CurveType.Linear,
  filterOpacity: 0.2,
  margin: () => ({ top: 20, bottom: 40, left: 40, right: 20 }),
  showXAxis: true,
  showYAxis: true,
  showTooltip: true,
  showLegend: true,
  showGridLine: true,
})

const emits = defineEmits<{
  legendItemClick: [d: BulletLegendItemInterface, i: number]
}>()

type KeyOfT = Extract<keyof T, string>
type Data = typeof props.data[number]

const index = computed(() => props.index as KeyOfT)
const colors = computed(() => props.colors?.length ? props.colors : defaultColors(props.categories.length))

const legendItems = ref<BulletLegendItemInterface[]>(props.categories.map((category, i) => ({
  name: category,
  color: colors.value[i],
  inactive: false,
})))

const isMounted = useMounted()

function handleLegendItemClick(d: BulletLegendItemInterface, i: number) {
  emits('legendItemClick', d, i)
}

// Function to check if a category has only one data point
function isSinglePoint(category: string): boolean {
  return props.data.filter(d => d[category] !== undefined).length === 1
}
</script>

<template>
  <div :class="cn('w-full h-[400px] flex flex-col items-end', $attrs.class ?? '')">
    <ChartLegend v-if="showLegend" v-model:items="legendItems" @legend-item-click="handleLegendItemClick" />

    <VisXYContainer
      :margin="margin"
      :data="data"
      :style="{ height: isMounted ? '100%' : 'auto' }"
    >
      <ChartCrosshair v-if="showTooltip" :colors="colors" :items="legendItems" :index="index" :custom-tooltip="customTooltip" />

      <template v-for="(category, i) in categories" :key="category">
        <VisLine
          :x="(d: Data) => Number(d[index])"
          :y="(d: Data) => Number(d[category])"
          :curve-type="curveType"
          :color="colors[i]"
          :show-line="!isSinglePoint(category)"
          :attributes="{
            [Line.selectors.line]: {
              opacity: legendItems.find((item: BulletLegendItemInterface) => item.name === category)?.inactive ? filterOpacity : 1,
              'stroke-width': 2,
              stroke: colors[i]
            },
            [Line.selectors.dots]: {
              fill: colors[i],
              r: isSinglePoint(category) ? 6 : 4,
              stroke: colors[i],
              'stroke-width': isSinglePoint(category) ? 2 : 1
            }
          }"
        />
      </template>

      <VisAxis
        v-if="showXAxis"
        type="x"
        :tick-format="xFormatter ?? ((v: number) => v.toString())"
        :grid-line="showGridLine"
        :tick-line="true"
        :domain-line="true"
        tick-text-color="hsl(var(--vis-text-color))"
      />
      <VisAxis
        v-if="showYAxis"
        type="y"
        :tick-line="true"
        :tick-format="yFormatter"
        :domain-line="true"
        :grid-line="showGridLine"
        :attributes="{
          [Axis.selectors.grid]: {
            class: 'text-muted',
          },
        }"
        tick-text-color="hsl(var(--vis-text-color))"
      />
    </VisXYContainer>
  </div>
</template>
