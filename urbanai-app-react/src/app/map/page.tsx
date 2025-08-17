import AuthWrapper from '@/components/auth-wrapper'
import AppLayout from '@/components/app-layout'
import ArcGISSceneViewer from '@/components/arcgis-scene-viewer'

export default function MapPage() {
  return (
    <AuthWrapper>
      <AppLayout>
        <div className="h-full p-4">
          <ArcGISSceneViewer 
            gmlIds={[]}
            className="h-full"
          />
        </div>
      </AppLayout>
    </AuthWrapper>
  )
}
