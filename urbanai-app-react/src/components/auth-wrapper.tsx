'use client'

import { useAuth } from '@/hooks/use-auth'
import LoginPage from '@/components/login-page'

interface AuthWrapperProps {
  children: React.ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
            {/* Urban/Building icon */}
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0v-3.75M3 21v-6a2 2 0 012-2h6.5m3 0V9a2 2 0 012-2h1M21 8.5v2.75m-3 0V21m-4-3h2m-2-3h2m-2-3h2m-2-3h2M7 8h2m-2 4h2m-2 4h2m-2 4h2"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">UrbanAI</h2>
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
          <div className="w-6 h-6 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <>{children}</>
}
