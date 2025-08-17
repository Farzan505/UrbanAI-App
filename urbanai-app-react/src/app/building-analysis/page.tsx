import AuthWrapper from '@/components/auth-wrapper'
import AppLayout from '@/components/app-layout'
import BuildingAnalysisComponent from '@/components/building-analysis-page'

export default function BuildingAnalysisPage() {
  return (
    <AuthWrapper>
      <AppLayout>
        <BuildingAnalysisComponent />
      </AppLayout>
    </AuthWrapper>
  )
}
