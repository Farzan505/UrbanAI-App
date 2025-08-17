<template>
  <Card class="w-full">
    <CardHeader class="py-2 border-b">
      <CardTitle class="text-lg">Category Distribution</CardTitle>
      <div class="text-sm text-muted-foreground">
        {{ colorProperty[0] ? `Distribution for: ${colorProperty[0]}` : 'Select a property for visualization' }}
      </div>
    </CardHeader>
    <CardContent class="p-4">
      <div v-if="loading" class="h-[300px]">
        <Skeleton class="w-full h-full" />
      </div>
      <DataBarChart
        v-else-if="colorProperty[0]"
        :filtered-features="filteredFeatures"
        :color-property="colorProperty"
        :loading="false"
        :selected-values="selectedValues"
        @update:selected-values="$emit('update:selectedValues', $event)"
      />
      <div 
        v-else 
        class="flex items-center justify-center h-[300px] text-muted-foreground"
      >
        Select a property to view distribution
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import DataBarChart from '../DataBarChart.vue'
import type { Feature } from '../../types/map'

interface Props {
  colorProperty: string[]
  filteredFeatures: Feature[]
  selectedValues?: string[]
  loading: boolean
}

defineProps<Props>()

defineEmits<{
  'update:selectedValues': [value: string[]]
}>()
</script>
