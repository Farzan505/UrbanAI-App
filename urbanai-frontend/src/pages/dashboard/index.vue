<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  // Check if user is authenticated
  const token = localStorage.getItem('token')
  if (!token) {
    router.push('/login')
  }
})
</script>

<template>
  <div class="p-8">
    <h1 class="text-3xl font-bold">Dashboard</h1>
    <p class="mt-4">Welcome to your dashboard!</p>
  </div>
</template>