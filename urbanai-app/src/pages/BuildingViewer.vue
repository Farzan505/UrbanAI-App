<template>
  <div class="h-full flex flex-col">
    <!-- Main content area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left side - 3D Scene Viewer -->
      <div class="flex-1 relative">
        <EnergySceneViewer 
          :gml-ids="gmlIdsArray"
          :geometry-data="geometryData"
          :geometry-loading="isLoadingGeometry"
        />
      </div>

      <!-- Right side - Building Information Panel -->
      <div class="w-96 border-l bg-background overflow-auto">
        <div class="p-6 space-y-6">
          <!-- Header -->
          <div>
            <h2 class="text-2xl font-bold">Gebäudeanalyse</h2>
            <p v-if="currentGmlid" class="text-sm text-muted-foreground">
              GML ID: {{ currentGmlid }}
            </p>
            <p v-else class="text-sm text-muted-foreground">
              Geben Sie eine GML ID ein, um die Analyse zu starten
            </p>
          </div>

          <!-- Loading state -->
          <div v-if="isLoadingGeometry" class="space-y-4">
            <div class="flex items-center justify-center py-8">
              <div class="flex flex-col items-center space-y-3">
                <Spinner size="32px" className="text-primary" />
                <p class="text-sm text-muted-foreground">Lade Gebäudedaten...</p>
              </div>
            </div>
            <div class="space-y-4">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
              <Skeleton class="h-32 w-full" />
            </div>
          </div>

          <!-- Error state -->
          <div v-else-if="error" class="text-center py-8">
            <AlertCircle class="mx-auto h-12 w-12 text-destructive mb-4" />
            <p class="text-destructive font-medium">Fehler beim Laden der Daten</p>
            <p class="text-sm text-muted-foreground mt-2">{{ error }}</p>
            <Button 
              @click="() => getGeometry(currentGmlid)" 
              variant="outline" 
              class="mt-4"
            >
              Erneut versuchen
            </Button>
          </div>

          <!-- Building Information -->
          <div v-else-if="currentGmlid">
            <Tabs default-value="overview" class="w-full">
              <TabsList class="grid w-full grid-cols-1">
                <TabsTrigger value="overview">Überblick</TabsTrigger>
              </TabsList>
              
              <div class="mt-6 space-y-6">
                <!-- Gebäudeinformationen Card -->
                <Card>
                  <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                      <Building2 class="h-5 w-5" />
                      Gebäudeinformationen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="space-y-4">
                      <!-- Gebäudeflächen -->
                      <div>
                        <Label class="text-sm font-medium">Gebäudeflächen</Label>
                        <div v-if="buildingSurfaceAreas" class="mt-2 space-y-2">
                          <div v-for="surface in buildingSurfaceAreas" :key="surface.label" class="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span class="text-sm">{{ surface.label }}</span>
                            <span class="font-medium">{{ surface.value }} {{ surface.unit }}</span>
                          </div>
                        </div>
                        <div v-else-if="isLoadingGeometry" class="mt-2 space-y-2">
                          <div class="flex items-center justify-center py-4">
                            <div class="flex items-center space-x-2">
                              <Spinner size="20px" className="text-primary" />
                              <span class="text-sm text-muted-foreground">Berechne Gebäudeflächen...</span>
                            </div>
                          </div>
                          <Skeleton class="h-12 w-full" />
                          <Skeleton class="h-12 w-full" />
                          <Skeleton class="h-12 w-full" />
                          <Skeleton class="h-12 w-full" />
                        </div>
                        <div v-else class="mt-2 p-3 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                          Keine Flächendaten verfügbar
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </Tabs>
          </div>

          <!-- Empty state -->
          <div v-else class="text-center py-12">
            <Building2 class="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <p class="text-muted-foreground">
              Verwenden Sie die Suchleiste oben, um ein Gebäude zu analysieren
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCityGML } from '@/composables/useCityGML'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import EnergySceneViewer from '@/components/map/EnergySceneViewer.vue'
import { Building2, AlertCircle } from 'lucide-vue-next'

// Props (for when accessed via route params)
interface Props {
  gmlid?: string
}

const props = withDefaults(defineProps<Props>(), {
  gmlid: ''
})

// Router
const route = useRoute()

// Composables
const { getGeometry, geometry, isLoading: isLoadingGeometry, error } = useCityGML()

// Current GML ID from route params or props
const currentGmlid = computed(() => {
  return props.gmlid || (route.params.gmlid as string) || ''
})

// Convert single GML ID to array format expected by EnergySceneViewer
const gmlIdsArray = computed(() => {
  return currentGmlid.value ? [currentGmlid.value] : []
})

// Geometry data for the 3D viewer
const geometryData = computed(() => {
  return geometry.value
})

// Mock building areas data (replace with actual API data when available)
const buildingAreas = ref({
  groundArea: 0,
  roofArea: 0,
  wallArea: 0,
  totalArea: 0
})

// Get building surface areas from geometry data
const buildingSurfaceAreas = computed(() => {
  console.log('🏢 Checking geometry data for surface areas:', geometryData.value)
  
  if (!geometryData.value) {
    console.log('❌ No geometry data available')
    return null
  }

  // Check different possible locations for summed_surface_areas
  let areas = null
  if (geometryData.value.summed_surface_areas) {
    areas = geometryData.value.summed_surface_areas
    console.log('✅ Found summed_surface_areas directly:', areas)
  } else if (geometryData.value.results?.summed_surface_areas) {
    areas = geometryData.value.results.summed_surface_areas
    console.log('✅ Found summed_surface_areas in results:', areas)
  } else {
    // Look for it in nested structure (GML ID based)
    for (const key in geometryData.value) {
      if (geometryData.value[key]?.summed_surface_areas) {
        areas = geometryData.value[key].summed_surface_areas
        console.log(`✅ Found summed_surface_areas in ${key}:`, areas)
        break
      }
    }
  }
  
  if (!areas) {
    console.log('❌ No summed_surface_areas found in geometry data')
    console.log('Available keys:', Object.keys(geometryData.value))
    return null
  }
  
  // German translations for surface types
  const surfaceLabels: { [key: string]: string } = {
    'buildingwallsurface_area': 'Außenwandfläche',
    'buildingroofsurface_area': 'Dachfläche', 
    'buildinggroundsurface_area': 'Bodenfläche',
    'buildingwindowsurface_area': 'Fensterfläche',
    'buildingwallsurface_adiabatic_area': 'Außenwandfläche (gemeinsame Flächen)',
    'buildingwallsurface_nonadiabatic_area': 'Außenwandfläche (nicht gemeinsame Flächen)',
    'total_bgf': 'Bruttogrundfläche',
    'total_ngf': 'Nettogrundfläche',
    'total_built_area': 'Bebaute Fläche',
    'a_ngf': 'Gebäudehülle zu Nettogrundfläche'
  }
  
  // Convert to array with German labels and formatted values
  const result = Object.entries(areas).map(([key, value]) => ({
    label: surfaceLabels[key] || key,
    value: typeof value === 'number' ? value.toFixed(2) : 'N/A',
    unit: key === 'a_ngf' ? '[-]' : 'm²'
  }))
  
  console.log('🏢 Processed surface areas:', result)
  return result
})

// Watch for GML ID changes
watch(currentGmlid, async (newGmlid) => {
  if (newGmlid) {
    // Automatically fetch geometry data when GML ID changes
    console.log('GML ID changed to:', newGmlid, '- fetching geometry data')
    try {
      await getGeometry(newGmlid)
      console.log('✅ Geometry data fetched successfully')
    } catch (err) {
      console.error('❌ Error fetching geometry data:', err)
    }
  } else {
    // Reset data when no GML ID
    buildingAreas.value = {
      groundArea: 0,
      roofArea: 0,
      wallArea: 0,
      totalArea: 0
    }
  }
}, { immediate: true })

// Load data on mount if GML ID is present
onMounted(async () => {
  if (currentGmlid.value) {
    console.log('Mounted with GML ID:', currentGmlid.value, '- fetching geometry data')
    try {
      await getGeometry(currentGmlid.value)
      console.log('✅ Initial geometry data fetched successfully')
    } catch (err) {
      console.error('❌ Error fetching initial geometry data:', err)
    }
  }
})
</script>
