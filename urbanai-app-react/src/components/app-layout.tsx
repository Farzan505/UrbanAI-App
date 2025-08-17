'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AppSidebar from '@/components/app-sidebar'
import { useAuth } from '@/hooks/use-auth'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { logout, user } = useAuth()
  const [searchTerm, setSearchTerm] = useState(searchParams.get('gmlid') || '')

  const handleSearch = () => {
    if (searchTerm.trim()) {
      const trimmedGmlId = searchTerm.trim()
      router.push(`/building-analysis?gmlid=${trimmedGmlId}`)
    }
  }

  const handleSearchKeydown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-40">
            <div className="flex h-14 items-center px-4 gap-4">
              <SidebarTrigger />
              
              {/* Search Bar */}
              <div className="flex-1 max-w-md">
                <div className="relative flex items-center gap-2">
                  <Input
                    placeholder="GML ID eingeben..."
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearchKeydown}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} size="sm">
                    Suchen
                  </Button>
                </div>
              </div>

              {/* User menu */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {user?.username || user?.name}
                </span>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Abmelden
                </Button>
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
