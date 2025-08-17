<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AppSidebar from "@/layouts/AppSidebar.vue"
import { useDecotwoAuth } from '@/composables/useDecotwoAuth'

const router = useRouter()
const route = useRoute()
const gebidSearch = ref('')

// Check if current route should show search
const showSearch = computed(() => {
  return route.name === 'gebaudeanalyse' || 
         route.name === 'gebaudeanalyse-gmlid'
})

// Watch for route changes and update search input
watch(() => route.params.gmlid, (gmlid) => {
  if (gmlid && typeof gmlid === 'string') {
    gebidSearch.value = gmlid
  }
}, { immediate: true })

// Initialize search input from route on mount
onMounted(() => {
  const gmlid = route.params.gmlid
  if (gmlid && typeof gmlid === 'string') {
    gebidSearch.value = gmlid
  }
})

// Handle search functionality
const handleSearch = async () => {
  if (gebidSearch.value.trim()) {
    const trimmedGmlid = gebidSearch.value.trim()
    
    // Navigate to building analysis with gmlid
    await router.push(`/gebaudeanalyse/gmlid=${trimmedGmlid}`)
  }
}

// Handle Enter key in search input
const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleSearch()
  }
}

const { user, logout } = useDecotwoAuth()
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <main class="flex-1 overflow-hidden">
      <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
        
        <!-- Search Field - Only show on building analysis pages -->
        <div v-if="showSearch" class="flex items-center space-x-2 flex-1">
          <div class="flex items-center space-x-2 ml-auto">
            <Input
              id="gebid-search"
              v-model="gebidSearch"
              type="text"
              placeholder="GML ID eingeben"
              class="w-64"
              @keydown="handleSearchKeydown"
            />
            <Button 
              @click="handleSearch" 
              :disabled="!gebidSearch.trim()"
              class="whitespace-nowrap"
            >
              Suchen
            </Button>
          </div>
        </div>
        
        <!-- User info and logout -->
        <div v-if="!showSearch" class="flex-1"></div>
        <div class="flex items-center space-x-3">
          <span v-if="user" class="text-sm text-gray-600 dark:text-gray-300">
            Welcome, {{ user.name || user.username || user.email }}
          </span>
          <Button variant="outline" size="sm" @click="logout">
            Logout
          </Button>
        </div>
      </header>
      <div class="flex-1 overflow-auto">
        <router-view />
      </div>
    </main>
  </SidebarProvider>
</template>

<style scoped>
main {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
</style>