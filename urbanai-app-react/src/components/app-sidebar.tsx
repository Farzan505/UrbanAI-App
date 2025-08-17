'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Building2, Map } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export default function AppSidebar() {
  const pathname = usePathname()

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
    </Sidebar>
  )
}
