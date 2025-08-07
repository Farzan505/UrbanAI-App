<template>
  <div class="flex items-center gap-4 p-4 bg-gray-50 border rounded-lg">
    <div class="flex items-center gap-2">
      <div 
        :class="[
          'w-3 h-3 rounded-full',
          isAuthenticated ? 'bg-green-500' : 'bg-red-500'
        ]"
      />
      <span class="text-sm font-medium">
        {{ isAuthenticated ? 'Authenticated' : 'Not Authenticated' }}
      </span>
    </div>
    
    <div v-if="authStatus.session_created" class="text-xs text-gray-500">
      Session: {{ new Date(authStatus.session_created).toLocaleString() }}
    </div>
    
    <div class="ml-auto flex gap-2">
      <Button 
        v-if="!isAuthenticated" 
        @click="handleLogin"
        :disabled="isLoading"
        size="sm"
      >
        <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
        Login to ArcGIS
      </Button>
      
      <Button 
        v-else 
        @click="handleLogout"
        :disabled="isLoading"
        variant="outline"
        size="sm"
      >
        <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
        Logout
      </Button>
      
      <Button 
        @click="handleRefresh"
        :disabled="isLoading"
        variant="ghost"
        size="sm"
      >
        <Loader2 v-if="isLoading" class="w-4 h-4 mr-2 animate-spin" />
        Refresh
      </Button>
    </div>
    
    <div v-if="error" class="text-sm text-red-600">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-vue-next'
import { useAuth } from '@/composables/useAuth'

// Authentication composable
const { 
  authStatus, 
  isLoading, 
  error, 
  isAuthenticated, 
  checkAuthStatus, 
  login, 
  logout 
} = useAuth()

// Handlers
const handleLogin = async () => {
  await login()
}

const handleLogout = async () => {
  await logout()
  // Refresh status after logout
  await checkAuthStatus()
}

const handleRefresh = async () => {
  await checkAuthStatus()
}

// Check auth status on mount
onMounted(async () => {
  await checkAuthStatus()
})
</script>
