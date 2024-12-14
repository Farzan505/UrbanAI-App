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

// Helper function to get the first 5 property keys
function getDefaultColumns(properties: Record<string, any>): string[] {
  return Object.keys(properties).slice(0, 5)
}

// Helper function to format cell value based on type
function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

export function createColumns(data: Feature[]): Column[] {
  if (!data || data.length === 0) return []
  
  // Get the first 5 columns as default
  const defaultColumns = getDefaultColumns(data[0].properties)
  
  return defaultColumns.map(key => ({
    id: key,
    header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    cell: ({ row }: { row: Feature }) => {
      const value = row.properties[key]
      return formatCellValue(value)
    },
    class: 'whitespace-nowrap'
  }))
}
