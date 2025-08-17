'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Building2, Map } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useAuth } from '@/hooks/use-auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

export default function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const items = [
    {
      title: 'Building Analysis',
      url: '/building-analysis',
      icon: Building2,
      isActive: pathname === '/building-analysis' || pathname === '/',
    },
    {
      title: 'Map View',
      url: '/map',
      icon: Map,
      isActive: pathname === '/map',
    },
  ]

  const getUserInitials = (user: any) => {
    if (user?.name) {
      return user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>UrbanAI Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={item.isActive}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      {user && (
        <SidebarFooter>
          <div className="flex items-center gap-3 p-4 border-t">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user.name || user.username}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout}
              className="px-2"
            >
              Abmelden
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
