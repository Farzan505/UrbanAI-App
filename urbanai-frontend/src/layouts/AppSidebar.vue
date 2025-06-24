<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  BookOpen,
  Building2,
  CircleGauge,
  HousePlus,
  Database,
} from "lucide-vue-next"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const route = useRoute()
const { state } = useSidebar()

// Get current building ID if available
const currentGebid = computed(() => {
  return route.params.gebid ? String(route.params.gebid) : 
         route.query.gebid ? String(route.query.gebid) : null
})

// Menu items with computed active states and dynamic URLs
const items = computed(() => [
  {
    title: "Dashboard",
    url: "/",
    icon: CircleGauge,
    isActive: route.path === '/' && !route.params.gebid && !route.query.gebid,
  },
  {
    title: "Gebäudeanalyse",
    url: currentGebid.value ? `/buildinganalysis/gebid=${currentGebid.value}` : "/buildinganalysis",
    icon: HousePlus,
    isActive: route.path === '/buildinganalysis' || 
              route.path.startsWith('/buildinganalysis/gebid=') || 
              route.path.startsWith('/gebid=') ||
              (route.path === '/' && (route.params.gebid || route.query.gebid)),
  },
  {
    title: "Portfolioanalyse",
    url: "#",
    icon: Building2,
    isActive: false,
  },
  {
    title: "Datenquellen",
    url: currentGebid.value ? `/data-sources?gebid=${currentGebid.value}` : "/data-sources",
    icon: BookOpen,
    isActive: route.path === '/data-sources',
  },
  {
    title: "Datenbearbeitung",
    url: currentGebid.value ? `/data-management?gebid=${currentGebid.value}` : "/data-management",
    icon: Database,
    isActive: route.path === '/data-management',
  },
])
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel v-if="state === 'expanded'">Klimalyse</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in items" :key="item.title">
              <SidebarMenuButton asChild :tooltip="state === 'collapsed' ? item.title : undefined">
                <router-link 
                  v-if="item.url !== '#'" 
                  :to="item.url" 
                  :class="{ 'bg-accent text-accent-foreground': item.isActive }"
                >
                  <component :is="item.icon" />
                  <span v-if="state === 'expanded'">{{ item.title }}</span>
                </router-link>
                <a 
                  v-else 
                  :href="item.url" 
                  :class="{ 'bg-accent text-accent-foreground': item.isActive }"
                >
                  <component :is="item.icon" />
                  <span v-if="state === 'expanded'">{{ item.title }}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template> 