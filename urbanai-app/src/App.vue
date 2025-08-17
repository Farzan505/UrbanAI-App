<script setup lang="ts">
// App.vue is now just a router container with auth wrapper
import { Toaster } from '@/components/ui/sonner'
import AuthWrapper from '@/components/AuthWrapper.vue'
</script>

<template>
  <div id="app">
    <AuthWrapper />
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
