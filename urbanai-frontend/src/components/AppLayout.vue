<script setup lang="ts">
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import AppSidebar from "@/components/AppSidebar.vue"
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <main class="flex-1 overflow-hidden">
      <header class="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger class="-ml-1" />
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