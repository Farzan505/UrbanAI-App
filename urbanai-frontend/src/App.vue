<script setup lang="ts">
// App.vue is now just a router container
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
  <div id="app">
    <router-view />
    <Toaster />
  </div>
</template>

<style scoped>
#app {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
}
</style>
