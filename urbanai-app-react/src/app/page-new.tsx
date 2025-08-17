import AuthWrapper from '@/components/auth-wrapper'
import AppLayout from '@/components/app-layout'
import BuildingAnalysisPage from '@/components/building-analysis-page'

export default function Home() {
  return (
    <AuthWrapper>
      <AppLayout>
        <BuildingAnalysisPage />
      </AppLayout>
    </AuthWrapper>
  )
}
