'use client'

import { AuthProvider } from '@/hooks/use-auth'
import { Toaster } from '@/components/ui/sonner'

interface ClientWrapperProps {
  children: React.ReactNode
}

export default function ClientWrapper({ children }: ClientWrapperProps) {
  return (
    <AuthProvider>
      {children}
      <Toaster />
    </AuthProvider>
  )
}
