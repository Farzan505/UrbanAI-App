<script setup lang="ts">
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../components/ui/avatar'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Separator } from '../components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../components/ui/sidebar'
import ThemeToggle from '../components/ui/ThemeToggle.vue'
import {
  BookOpen,
  Bot,
  ChevronRight,
  ChevronsUpDown,
  GalleryVerticalEnd,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings2,
  SquareTerminal,
  Trash2,
  HousePlus,
  Building2,
  CircleGauge,
} from 'lucide-vue-next'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Sample data
const data = {
  user: {
    name: 'FarzanB',
    email: 'Farzan.banihashemi@tum.de',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Decotwo',
      logo: GalleryVerticalEnd,
      plan: 'TUM',
    }
  ],
  navMain: [
    {
      title: 'Dashboard',
      url: '#',
      icon: CircleGauge,
      isActive: true,

    },
    {
      title: 'Gebäudeanalyse',
      url: '#',
      icon: HousePlus,
    },
    {
      title: 'Portfolionalyse',
      url: '#',
      icon: Building2,
    },
    {
      title: 'Dokumentation',
      url: '#',
      icon: BookOpen,
      items: [

        {
          title: 'Anleitungen',
          url: '#',
        },
        {
          title: 'Änderungsliste',
          url: '#',
        },
      ],
    },
    {
      title: 'Einstellungen',
      url: '#',
      icon: Settings2,
      items: [
        {
          title: 'Allgemein',
          url: '#',
        },
        {
          title: 'Kostenkennwerte',
          url: '#',
        },
      ],
    },
  ],
  // projects: [
  //   {
  //     name: 'Design Engineering',
  //     url: '#',
  //     icon: Frame,
  //   },
  //   {
  //     name: 'Sales & Marketing',
  //     url: '#',
  //     icon: PieChart,
  //   },
  //   {
  //     name: 'Travel',
  //     url: '#',
  //     icon: Map,
  //   },
  // ],
}

const activeTeam = ref(data.teams[0])

function setActiveTeam(team: typeof data.teams[number]) {
  activeTeam.value = team
}

function handleLogout() {
  localStorage.removeItem('token')
  router.push('/login')
}
</script>

<template>
  <div class="bg-background text-foreground">
    <SidebarProvider>
      <Sidebar collapsible="icon" class="bg-[hsl(var(--sidebar-background))] text-[hsl(var(--sidebar-foreground))]">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <SidebarMenuButton
                    size="lg"
                    class="data-[state=open]:bg-[hsl(var(--sidebar-accent))] data-[state=open]:text-[hsl(var(--sidebar-accent-foreground))]"
                  >
                    <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]">
                      <component :is="activeTeam.logo" class="size-4" />
                    </div>
                    <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-semibold">{{ activeTeam.name }}</span>
                      <span class="truncate text-xs">{{ activeTeam.plan }}</span>
                    </div>
                    <ChevronsUpDown class="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                  align="start"
                  side="bottom"
                  :side-offset="4"
                >
                  <DropdownMenuLabel class="text-xs text-muted-foreground">
                    Teams
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    v-for="(team, index) in data.teams"
                    :key="team.name"
                    class="gap-2 p-2"
                    @click="setActiveTeam(team)"
                  >
                    <div class="flex size-6 items-center justify-center rounded-sm border">
                      <component :is="team.logo" class="size-4 shrink-0" />
                    </div>
                    {{ team.name }}
                    <DropdownMenuShortcut>⌘{{ index + 1 }}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="gap-2 p-2">
                    <div class="flex size-6 items-center justify-center rounded-md border bg-background">
                      <Plus class="size-4" />
                    </div>
                    <div class="font-medium text-muted-foreground">
                      Add team
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              <Collapsible
                v-for="item in data.navMain"
                :key="item.title"
                as-child
                :default-open="item.isActive"
                class="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton :tooltip="item.title">
                      <component :is="item.icon" />
                      <span>{{ item.title }}</span>
                      <ChevronRight class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem
                        v-for="subItem in item.items"
                        :key="subItem.title"
                      >
                        <SidebarMenuSubButton as-child>
                          <a :href="subItem.url">
                            <span>{{ subItem.title }}</span>
                          </a>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroup>
          
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <SidebarMenuButton
                    size="lg"
                    class="data-[state=open]:bg-[hsl(var(--sidebar-accent))] data-[state=open]:text-[hsl(var(--sidebar-accent-foreground))]"
                  >
                    <Avatar class="h-8 w-8 rounded-lg">
                      <AvatarImage :src="data.user.avatar" :alt="data.user.name" />
                      <AvatarFallback class="rounded-lg">
                        FB
                      </AvatarFallback>
                    </Avatar>
                    <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-semibold">{{ data.user.name }}</span>
                      <span class="truncate text-xs">{{ data.user.email }}</span>
                    </div>
                    <ChevronsUpDown class="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side="bottom" align="end" :side-offset="4">
                  <DropdownMenuLabel class="p-0 font-normal">
                    <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar class="h-8 w-8 rounded-lg">
                        <AvatarImage :src="data.user.avatar" :alt="data.user.name" />
                        <AvatarFallback class="rounded-lg">
                          FB
                        </AvatarFallback>
                      </Avatar>
                      <div class="grid flex-1 text-left text-sm leading-tight">
                        <span class="truncate font-semibold">{{ data.user.name }}</span>
                        <span class="truncate text-xs">{{ data.user.email }}</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <!--
                            <DropdownMenuGroup>
                            <DropdownMenuItem>
                              <Sparkles />
                              Upgrade to Pro
                            </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                            <DropdownMenuItem>
                              <BadgeCheck />
                              Account
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CreditCard />
                              Billing
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Bell />
                              Notifications
                            </DropdownMenuItem>
                  
                  </DropdownMenuGroup>
                  -->
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="handleLogout">
                    <LogOut />
                    Ausloggen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header class="flex h-16 shrink-0 items-center justify-between bg-background transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div class="flex items-center gap-2 px-4">
            <SidebarTrigger class="-ml-1" />
            <Separator orientation="vertical" class="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div class="px-4">
            <ThemeToggle />
          </div>
        </header>
        <div class="flex flex-1 flex-col p-4 pt-0 bg-background">
          <!-- Router view for child components -->
          <router-view></router-view>
        </div>
      </SidebarInset>
    </SidebarProvider>
  </div>
</template>
