<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Checkbox } from './ui/checkbox'
import { Plus, X, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter } from 'lucide-vue-next'

interface Feature {
  id: string
  type: "Feature"
  properties: Record<string, any>
  geometry: any
}

interface Column {
  id: string
  header: string
  cell: (props: { row: Feature }) => any
  class?: string
}

const props = defineProps<{
  data: Feature[]
  columns: Column[]
}>()

const emit = defineEmits<{
  (e: 'update:filteredData', data: Feature[]): void
}>()

// Filter state
const filterValue = ref('')
const selectedColumn = ref('')
const selectedColumnValue = ref('')
const selectedRows = ref<Set<string>>(new Set())
const showFilteredInMap = ref(false)

// Pagination
const currentPage = ref(1)
const rowsPerPage = ref(10)

// Get unique values for selected column
const uniqueColumnValues = computed(() => {
  if (!selectedColumn.value || !props.data.length) return []
  const values = new Set(props.data.map(row => row.properties[selectedColumn.value]))
  return Array.from(values).sort()
})

// Get selected column header
const selectedColumnHeader = computed(() => {
  if (!selectedColumn.value) return 'Filter'
  return props.columns.find(col => col.id === selectedColumn.value)?.header || 'Filter'
})

// Filtered data
const filteredData = computed(() => {
  let filtered = props.data

  // Apply text filter
  if (filterValue.value) {
    filtered = filtered.filter(row => 
      Object.values(row.properties).some(value => 
        String(value).toLowerCase().includes(filterValue.value.toLowerCase())
      )
    )
  }

  // Apply column filter
  if (selectedColumn.value && selectedColumnValue.value) {
    filtered = filtered.filter(row => 
      String(row.properties[selectedColumn.value]) === String(selectedColumnValue.value)
    )
  }

  return filtered
})

// Paginated data
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * rowsPerPage.value
  const end = start + rowsPerPage.value
  return filteredData.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredData.value.length / rowsPerPage.value)
})

// Methods
function resetFilters() {
  selectedColumn.value = ''
  selectedColumnValue.value = ''
  filterValue.value = ''
  showFilteredInMap.value = false
  emit('update:filteredData', props.data)
}

function applyFilter() {
  showFilteredInMap.value = true
  emit('update:filteredData', filteredData.value)
}

function toggleFilteredInMap() {
  showFilteredInMap.value = !showFilteredInMap.value
  if (showFilteredInMap.value) {
    emit('update:filteredData', filteredData.value)
  } else {
    emit('update:filteredData', props.data)
  }
}

function toggleRow(id: string) {
  if (selectedRows.value.has(id)) {
    selectedRows.value.delete(id)
  } else {
    selectedRows.value.add(id)
  }
}

function changePage(page: number) {
  currentPage.value = page
}

function toggleAllRows(checked: boolean) {
  paginatedData.value.forEach((row: Feature) => {
    if (checked) {
      selectedRows.value.add(row.id)
    } else {
      selectedRows.value.delete(row.id)
    }
  })
}

// Handle column selection
function selectColumn(columnId: string) {
  selectedColumn.value = columnId
  selectedColumnValue.value = '' // Reset value when column changes
  showFilteredInMap.value = false // Reset map filter when column changes
  emit('update:filteredData', props.data)
}

// Handle value selection
function selectValue(value: any) {
  selectedColumnValue.value = value
  showFilteredInMap.value = true // Automatically show filtered data when value is selected
  emit('update:filteredData', filteredData.value)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <Input
        v-model="filterValue"
        placeholder="Filter tasks..."
        class="h-8 w-[150px] lg:w-[250px]"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" class="h-8">
            <Filter class="mr-2 h-4 w-4" />
            {{ selectedColumnHeader }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-[200px]">
          <DropdownMenuItem 
            v-for="column in columns" 
            :key="column.id"
            @click="selectColumn(column.id)"
          >
            {{ column.header }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu v-if="selectedColumn">
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" class="h-8">
            {{ selectedColumnValue || 'Select value' }}
            <ChevronDown class="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-[200px]">
          <DropdownMenuItem 
            v-for="value in uniqueColumnValues" 
            :key="value"
            @click="selectValue(value)"
          >
            {{ value }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button 
        v-if="selectedColumn && selectedColumnValue"
        variant="outline"
        size="sm"
        class="h-8"
        :class="{ 'bg-primary text-primary-foreground': showFilteredInMap }"
        @click="toggleFilteredInMap"
      >
        Show Filtered
      </Button>

      <Button 
        v-if="selectedColumn && selectedColumnValue"
        variant="ghost"
        size="sm"
        class="h-8 px-2 lg:px-3"
        @click="resetFilters"
      >
        Reset
        <X class="ml-2 h-4 w-4" />
      </Button>
    </div>

    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[40px]">
              <Checkbox
                :checked="
                  paginatedData.length > 0 &&
                  paginatedData.every((row: Feature) => selectedRows.has(row.id))
                "
                :indeterminate="
                  paginatedData.some((row: Feature) => selectedRows.has(row.id)) &&
                  !paginatedData.every((row: Feature) => selectedRows.has(row.id))
                "
                @update:checked="toggleAllRows"
              />
            </TableHead>
            <TableHead
              v-for="column in columns"
              :key="column.id"
              :class="[
                column.class,
                'whitespace-nowrap'
              ]"
            >
              {{ column.header }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="row in paginatedData"
            :key="row.id"
            class="hover:bg-muted/50"
          >
            <TableCell class="w-[40px]">
              <Checkbox
                :checked="selectedRows.has(row.id)"
                @update:checked="toggleRow(row.id)"
              />
            </TableCell>
            <TableCell
              v-for="column in columns"
              :key="column.id"
              :class="[
                column.class,
                'whitespace-nowrap'
              ]"
            >
              <component
                :is="column.cell"
                :row="row"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="flex items-center justify-between">
      <div class="text-sm text-muted-foreground">
        {{ selectedRows.size }} of {{ filteredData.length }} row(s) selected
      </div>

      <div class="flex items-center space-x-6 lg:space-x-8">
        <div class="flex items-center space-x-2">
          <p class="text-sm font-medium">Rows per page</p>
          <select
            v-model="rowsPerPage"
            class="h-8 w-[70px] rounded-md border border-input bg-transparent"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="40">40</option>
          </select>
        </div>

        <div class="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {{ currentPage }} of {{ totalPages }}
        </div>

        <div class="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            class="h-8 w-8 p-0"
            :disabled="currentPage === 1"
            @click="changePage(1)"
          >
            <span class="sr-only">Go to first page</span>
            <ChevronsLeft class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 w-8 p-0"
            :disabled="currentPage === 1"
            @click="changePage(currentPage - 1)"
          >
            <span class="sr-only">Go to previous page</span>
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 w-8 p-0"
            :disabled="currentPage === totalPages"
            @click="changePage(currentPage + 1)"
          >
            <span class="sr-only">Go to next page</span>
            <ChevronRight class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 w-8 p-0"
            :disabled="currentPage === totalPages"
            @click="changePage(totalPages)"
          >
            <span class="sr-only">Go to last page</span>
            <ChevronsRight class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
