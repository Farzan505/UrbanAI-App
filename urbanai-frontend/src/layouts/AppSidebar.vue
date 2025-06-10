<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  BookOpen,
  Building2,
  CircleGauge,
  HousePlus,
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

// Menu items with computed active states
const items = computed(() => [
  {
    title: "Dashboard",
    url: "/",
    icon: CircleGauge,
    isActive: route.path === '/' && !route.params.gebid,
  },
  {
    title: "Gebäudeanalyse",
    url: "/",
    icon: HousePlus,
    isActive: route.path === '/' || route.path.startsWith('/gebid='),
  },
  {
    title: "Portfolioanalyse",
    url: "#",
    icon: Building2,
    isActive: false,
  },
  {
    title: "Datenquellen",
    url: "/data-sources",
    icon: BookOpen,
    isActive: route.path === '/data-sources',
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