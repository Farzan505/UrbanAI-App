<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Building2,
  Map,
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

// Get current GML ID if available
const currentGmlid = computed(() => {
  return route.params.gmlid ? String(route.params.gmlid) : null
})

// Menu items with computed active states and dynamic URLs
const items = computed(() => [
  {
    title: "Gebäudeanalyse",
    url: currentGmlid.value ? `/gebaudeanalyse/gmlid=${currentGmlid.value}` : "/gebaudeanalyse",
    icon: Building2,
    isActive: route.path === '/gebaudeanalyse' || 
              route.path.startsWith('/gebaudeanalyse/gmlid=') || 
              route.path === '/',
  },
  {
    title: "Karte",
    url: "/karte",
    icon: Map,
    isActive: route.path === '/karte',
  },
])
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel v-if="state === 'expanded'">DeCO<sub>two</sub></SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in items" :key="item.title">
              <SidebarMenuButton asChild :tooltip="state === 'collapsed' ? item.title : undefined">
                <router-link 
                  :to="item.url" 
                  :class="{ 'bg-accent text-accent-foreground': item.isActive }"
                >
                  <component :is="item.icon" />
                  <span v-if="state === 'expanded'">{{ item.title }}</span>
                </router-link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template> 