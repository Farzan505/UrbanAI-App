<template>
  <calcite-panel id="pickerContainer" heading="Filter Features" width-scale="l" height-scale="l">
    <div class="panel-content">
      <calcite-label>Select Property</calcite-label>
      <calcite-combobox
        id="featurePicker"
        placeholder="Pick a Feature Property"
        selection-mode="single"
        overlay-positioning="fixed"
        @calciteComboboxChange="onFeatureChange"
      >
        <calcite-combobox-item
          v-for="column in availableColumns"
          :key="column"
          :value="column"
          :text-label="column"
          :selected="selectedFeature.includes(column)"
        >
          {{ column }}
        </calcite-combobox-item>
      </calcite-combobox>
      
      <calcite-label>Select Values</calcite-label>
      <calcite-combobox
        id="valuePicker"
        placeholder="Select Values"
        selection-mode="multiple"
        overlay-positioning="fixed"
        @calciteComboboxChange="onValueChange"
      >
        <calcite-combobox-item
          v-for="value in uniqueValues"
          :key="value"
          :value="value"
          :text-label="value"
          :selected="selectedValues.includes(value)"
        >
          {{ value }}
        </calcite-combobox-item>
      </calcite-combobox>

      <calcite-label>Color By Property</calcite-label>
      <calcite-combobox
        id="colorPicker"
        placeholder="Pick a Property for Coloring"
        selection-mode="single"
        overlay-positioning="fixed"
        @calciteComboboxChange="onColorChange"
      >
        <calcite-combobox-item
          v-for="column in availableColumns"
          :key="column"
          :value="column"
          :text-label="column"
          :selected="colorProperty.includes(column)"
        >
          {{ column }}
        </calcite-combobox-item>
      </calcite-combobox>
    </div>
  </calcite-panel>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import type { Feature } from '../../types/map'

interface Props {
  availableColumns: string[]
  uniqueValues: string[]
  selectedFeature: string[]
  selectedValues: string[]
  mapData: { features: Feature[] } | null
  colorProperty: string[]
}

interface Emits {
  (e: 'update:selectedFeature', value: string[]): void
  (e: 'update:selectedValues', value: string[]): void
  (e: 'update:colorProperty', value: string[]): void
}

const props = withDefaults(defineProps<Props>(), {
  colorProperty: () => []
})
const emit = defineEmits<Emits>()

const onFeatureChange = (event: any) => {
  console.log('MapUI: Feature picker change event:', event.target.selectedItems)
  const selectedProp = event.target.selectedItems[0]?.value
  if (selectedProp) {
    console.log('MapUI: Emitting new feature:', [selectedProp])
    emit('update:selectedFeature', [selectedProp])
    emit('update:selectedValues', [])
    // Set color property to match selected feature by default
    if (props.colorProperty.length === 0) {
      emit('update:colorProperty', [selectedProp])
    }
  }
}

const onValueChange = (event: any) => {
  console.log('MapUI: Value picker change event:', event.target.selectedItems)
  const selectedValues = event.target.selectedItems.map((item: any) => item.value)
  console.log('MapUI: Emitting new values:', selectedValues)
  emit('update:selectedValues', selectedValues)
}

const onColorChange = (event: any) => {
  console.log('MapUI: Color picker change event:', event.target.selectedItems)
  const selectedProp = event.target.selectedItems[0]?.value
  if (selectedProp) {
    console.log('MapUI: Emitting new color property:', [selectedProp])
    emit('update:colorProperty', [selectedProp])
  }
}

// Watch for props changes
watch(() => props.selectedFeature, (newFeature) => {
  console.log('MapUI: Selected feature prop changed:', newFeature)
}, { immediate: true })

watch(() => props.selectedValues, (newValues) => {
  console.log('MapUI: Selected values prop changed:', newValues)
}, { immediate: true })

watch(() => props.availableColumns, (newColumns) => {
  console.log('MapUI: Available columns prop changed:', newColumns)
}, { immediate: true })

watch(() => props.uniqueValues, (newValues) => {
  console.log('MapUI: Unique values prop changed:', newValues)
}, { immediate: true })

watch(() => props.colorProperty, (newColor) => {
  console.log('MapUI: Color property prop changed:', newColor)
}, { immediate: true })

// Initialize UI on mount
onMounted(() => {
  console.log('MapUI: Component mounted with props:', {
    availableColumns: props.availableColumns,
    uniqueValues: props.uniqueValues,
    selectedFeature: props.selectedFeature,
    selectedValues: props.selectedValues,
    colorProperty: props.colorProperty
  })
})
</script>

<style scoped>
.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  width: 330px;
  height: 500px;
  overflow-y: auto;
  padding-bottom: 12px;
}

calcite-combobox {
  --calcite-ui-height: 10rem;
}

calcite-combobox-item {
  height: 3rem;
  line-height: 3rem;
}

calcite-combobox-item::part(container) {
  max-height: 400px;
  overflow-y: auto;
}
</style>
