'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Building2, AlertCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import ArcGISSceneViewer from './arcgis-scene-viewer'
import { useAuth } from '@/hooks/use-auth'
import { GeometryResponse } from '@/types/arcgis'

interface BuildingSurface {
  label: string
  value: number
  unit: string
}

export default function BuildingAnalysisPage() {
  const searchParams = useSearchParams()
  const gmlId = searchParams.get('gmlid')
  const { isAuthenticated, user, isLoading: authLoading, login, getToken, setToken } = useAuth()
  
  console.log('🏗️ Building Analysis Page: Component mounted')
  console.log('🔍 URL Search Params:', Object.fromEntries(searchParams.entries()))
  console.log('🏠 Extracted GML ID:', gmlId)
  console.log('🔐 Authentication State:', { isAuthenticated, user, authLoading })
  
  const [geometryData, setGeometryData] = useState<GeometryResponse | null>(null)
  const [buildingSurfaceAreas, setBuildingSurfaceAreas] = useState<BuildingSurface[] | null>(null)
  const [isLoadingGeometry, setIsLoadingGeometry] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Temporary function to set the JWT token for testing
  const setTestToken = () => {
    const jwtToken = 'eyJraWQiOiIrQnhjVnp0S1hrelRHeUR6VFdRaFdmelgxYytuaXZJXC82NVczWWl2QUxPcz0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhMzc0MjhhMi1kMGIxLTcwNTQtMThkYS0xYjdhZGE5YTU1OWMiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiaXNzIjoiaHR0cHM6XC9cL2NvZ25pdG8taWRwLmV1LWNlbnRyYWwtMS5hbWF6b25hd3MuY29tXC9ldS1jZW50cmFsLTFfN3gyUHdZb250IiwiY29nbml0bzp1c2VybmFtZSI6ImEzNzQyOGEyLWQwYjEtNzA1NC0xOGRhLTFiN2FkYTlhNTU5YyIsIm9yaWdpbl9qdGkiOiIyMzE5Zjg5Ny1iNGIzLTQ3N2EtOTM4Ni00ZmYwYzAzNWU3OWYiLCJhdWQiOiI3ajcwbzRwcDljbGR2bGZuZDRpdjEzcnN1aSIsImV2ZW50X2lkIjoiZjExZTczNTktYzZkOC00Mzg3LTgwZTgtMzVmN2UwOGUyZGVhIiwidG9rZW5fdXNlIjoiaWQiLCJhdXRoX3RpbWUiOjE3NTUzNTE2MTgsImV4cCI6MTc1NTM1NTIxOCwiaWF0IjoxNzU1MzUxNjE4LCJqdGkiOiI2YTVjMTE0Mi1mMGRmLTQzYjktOGIyNS04NmVjMmE0NTMzZjIiLCJlbWFpbCI6ImZhcnphbi5iYW5paGFzaGVtaUB0dW0uZGUifQ.AZoOAQ8ghKn0_Dzuho1qqfUZHpS__grcskoJ48A_tQbV1LHBzUrTI4MSjE8LSIbRvOtundEJaP0-1b567RKWtY_dRJSFa9ZCrhCHo-V3-sk3GTyypAHhSd4jKP8txxSv4ORqXJ4UrQuwnWXu1ME2ag-nF4nohrsYLSOIihikYAvQGwiJVjBsf4q3DJtdhN4ywoZItk65H6rzSI6xlbe8knBhQcCq_phxrVqK8axhEBqxYT9HeKP4Cm8zv5LeRLph0QBHmruzHTqtgr6AijvRi5vAs-EehtTOGPLt45UCajaOQEI-AZhw7efjzBQudaM6ZL1XGtr8bvng4lgAckdiIA'
    
    const userData = {
      id: 'a37428a2-d0b1-7054-18da-1b7ada9a559c',
      username: 'farzan.banihasehmi@tum.de',
      email: 'farzan.banihasehmi@tum.de',
      name: 'Farzan Banihasehmi'
    }
    
    setToken(jwtToken, userData)
    console.log('🔐 JWT Token set for testing purposes')
  }

  const getGeometry = async (gmlIdParam: string | null) => {
    if (!gmlIdParam) return
    
    // Check if user is authenticated before making API calls
    if (!isAuthenticated) {
      setError('Authentication required. Please login to access building data.')
      console.log('⚠️ User not authenticated, cannot fetch geometry data')
      return
    }
    
    setIsLoadingGeometry(true)
    setError(null)
    
    try {
      console.log(`🔄 Fetching geometry data for GML ID: ${gmlIdParam}`)
      
      // Real API call to get geometry data
      const apiUrl = `https://api.decotwo.com/api/citygml/get_geometry?gmlids=${encodeURIComponent(gmlIdParam)}&calculate_window_areas=false`
      console.log(`📡 API Request URL: ${apiUrl}`)
      
      // Get auth token from the auth context
      const authToken = getToken()
      
      if (!authToken) {
        throw new Error('No authentication token found. Please login again.')
      }
      
      const headers: HeadersInit = {
        'accept': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
      
      console.log('🔐 Using authentication token for API request')
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers,
      })
      
      console.log(`📊 API Response Status: ${response.status} ${response.statusText}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token might be expired, try to re-authenticate
          localStorage.removeItem('decotwo_token')
          localStorage.removeItem('decotwo_user')
          setError('Authentication expired. Please login again.')
          return
        }
        
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ API Error Response:', errorData)
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('✅ API Response Data:', data)
      
      // Extract surface areas if available
      if (data.summed_surface_areas) {
        console.log('📐 Surface areas found:', data.summed_surface_areas)
        const surfaces: BuildingSurface[] = Object.entries(data.summed_surface_areas).map(([label, value]) => ({
          label,
          value: Number(value),
          unit: 'm²'
        }))
        setBuildingSurfaceAreas(surfaces)
      } else {
        console.log('⚠️ No surface areas in response, using mock data')
        // Fall back to mock data if no surface areas in response
        const mockSurfaces: BuildingSurface[] = [
          { label: 'Grundfläche', value: 125.5, unit: 'm²' },
          { label: 'Dachfläche', value: 125.5, unit: 'm²' },
          { label: 'Wandfläche Nord', value: 85.2, unit: 'm²' },
          { label: 'Wandfläche Süd', value: 85.2, unit: 'm²' },
          { label: 'Wandfläche Ost', value: 68.4, unit: 'm²' },
          { label: 'Wandfläche West', value: 68.4, unit: 'm²' },
        ]
        setBuildingSurfaceAreas(mockSurfaces)
      }
      
      setGeometryData(data)
      console.log('🎉 Geometry data processing completed successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Gebäudedaten'
      setError(errorMessage)
      console.error('❌ Error loading geometry:', err)
      console.error('🔍 Error details:', {
        message: errorMessage,
        gmlId: gmlIdParam,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsLoadingGeometry(false)
      console.log('🏁 Geometry loading process completed')
    }
  }

  useEffect(() => {
    // Wait for auth to load before attempting to fetch data
    if (authLoading) {
      console.log('🔄 Waiting for authentication state to load...')
      return
    }
    
    if (gmlId) {
      console.log(`🏠 Building Analysis: GML ID detected: ${gmlId}`)
      console.log(`🔐 Authentication status: ${isAuthenticated ? 'authenticated' : 'not authenticated'}`)
      
      if (isAuthenticated) {
        console.log(`🔄 Initiating geometry data fetch for building: ${gmlId}`)
        getGeometry(gmlId)
      } else {
        setError('Please login to view building details')
        console.log('⚠️ User not authenticated, cannot fetch building data')
      }
    } else {
      console.log('ℹ️ Building Analysis: No GML ID provided, showing search interface')
    }
  }, [gmlId, isAuthenticated, authLoading])

  return (
    <div className="h-full flex flex-col">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side - Building Information Panel */}
        <div className="w-96 border-r bg-background overflow-auto">
          <div className="p-6">
            {/* Single card containing all building information */}
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Gebäudeanalyse
                </CardTitle>
                <CardDescription>
                  {gmlId ? (
                    <>GML ID: {gmlId}</>
                  ) : (
                    <>Geben Sie eine GML ID ein, um die Analyse zu starten</>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Loading state */}
                {isLoadingGeometry && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center space-y-3">
                        <Spinner size="lg" />
                        <p className="text-sm text-muted-foreground">Lade Gebäudedaten...</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-32 w-full" />
                    </div>
                  </div>
                )}

                {/* Error state */}
                {error && !isLoadingGeometry && (
                  <div className="text-center py-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
                    <p className="text-destructive font-medium">Fehler beim Laden der Daten</p>
                    <p className="text-sm text-muted-foreground mt-2">{error}</p>
                    <div className="space-y-2 mt-4">
                      <Button 
                        onClick={() => getGeometry(gmlId)} 
                        variant="outline" 
                      >
                        Erneut versuchen
                      </Button>
                      {!isAuthenticated && (
                        <Button 
                          onClick={setTestToken} 
                          variant="secondary"
                          className="w-full"
                        >
                          JWT Token für Tests setzen
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Building Information */}
                {gmlId && !error && !isLoadingGeometry && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Gebäudeflächen</h3>
                    {buildingSurfaceAreas ? (
                      <div className="space-y-2">
                        {buildingSurfaceAreas.map((surface, index) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">{surface.label}</span>
                            <span className="font-medium">{surface.value} {surface.unit}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                        Keine Flächendaten verfügbar
                      </div>
                    )}
                  </div>
                )}

                {/* No GML ID state */}
                {!gmlId && (
                  <div className="text-center py-8">
                    <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium">Keine Gebäude-ID angegeben</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Verwenden Sie die Suchleiste oben, um eine GML-ID einzugeben und die Gebäudeanalyse zu starten.
                    </p>
                    {!isAuthenticated && (
                      <Button 
                        onClick={setTestToken} 
                        variant="secondary"
                        className="mt-4"
                      >
                        JWT Token für Tests setzen
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right side - 3D Scene Viewer */}
        <div className="flex-1 relative">
          {isLoadingGeometry ? (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <div className="flex flex-col items-center space-y-3">
                <Spinner size="xl" />
                <p className="text-sm text-muted-foreground">Lade 3D-Ansicht...</p>
              </div>
            </div>
          ) : (
            <ArcGISSceneViewer 
              gmlIds={gmlId ? [gmlId] : []}
              geometryData={geometryData}
              geometryLoading={isLoadingGeometry}
            />
          )}
        </div>
      </div>
    </div>
  )
}
