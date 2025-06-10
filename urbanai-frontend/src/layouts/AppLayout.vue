<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import AppSidebar from "@/layouts/AppSidebar.vue"

const router = useRouter()
const route = useRoute()
const gebidSearch = ref('')

// Check if current route should show search
const showSearch = computed(() => {
  return route.name === 'home' || route.name === 'gebid'
})

// Handle search functionality
const handleSearch = async () => {
  if (gebidSearch.value.trim()) {
    await router.push(`/gebid=${gebidSearch.value.trim()}`)
  }
}

// Handle Enter key in search input
const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleSearch()
  }
}
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <main class="flex-1 overflow-hidden">
      <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
        
        <!-- Search Field - Only show on building analysis pages -->
        <div v-if="showSearch" class="flex items-center space-x-2 ml-auto">
          <Input
            id="gebid-search"
            v-model="gebidSearch"
            type="text"
            placeholder="Gebäude Nr. eingeben"
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