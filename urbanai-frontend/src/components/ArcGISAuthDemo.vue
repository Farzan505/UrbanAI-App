<template>
  <div class="p-6 space-y-6">
    <h2 class="text-2xl font-bold">ArcGIS OAuth Authentication</h2>
    
    <!-- Auth Status Component -->
    <AuthStatus />
    
    <!-- User Info -->
    <div v-if="isAuthenticated && currentUser" class="bg-green-50 p-4 rounded-lg">
      <h3 class="font-semibold text-green-800">User Information</h3>
      <div class="mt-2 text-sm text-green-700">
        <p><strong>Username:</strong> {{ currentUser.username }}</p>
        <p><strong>Full Name:</strong> {{ currentUser.fullName }}</p>
        <p v-if="currentUser.email"><strong>Email:</strong> {{ currentUser.email }}</p>
      </div>
    </div>
    
    <!-- Portal Items Example -->
    <div v-if="isAuthenticated" class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">Your Portal Items</h3>
        <Button @click="loadPortalItems" :disabled="loadingItems">
          <Loader2 v-if="loadingItems" class="w-4 h-4 mr-2 animate-spin" />
          Load Items
        </Button>
      </div>
      
      <div v-if="portalItems" class="grid gap-4">
        <div 
          v-for="item in portalItems.results" 
          :key="item.id"
          class="border rounded-lg p-4 hover:bg-gray-50"
        >
          <div class="flex items-start gap-4">
            <img 
              v-if="item.thumbnailUrl" 
              :src="item.thumbnailUrl" 
              :alt="item.title"
              class="w-16 h-16 object-cover rounded"
            />
            <div class="flex-1">
              <h4 class="font-medium">{{ item.title }}</h4>
              <p class="text-sm text-gray-600">{{ item.type }}</p>
              <p class="text-xs text-gray-500">Views: {{ item.numViews }}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              @click="openItem(item)"
            >
              Open
            </Button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Token Testing -->
    <div v-if="isAuthenticated" class="bg-blue-50 p-4 rounded-lg">
      <h3 class="font-semibold text-blue-800 mb-2">Token Testing</h3>
      <div class="flex gap-2">
        <Button @click="testGetToken" :disabled="loadingToken">
          <Loader2 v-if="loadingToken" class="w-4 h-4 mr-2 animate-spin" />
          Get Token
        </Button>
        <Button @click="testRefreshToken" :disabled="loadingToken">
          <Loader2 v-if="loadingToken" class="w-4 h-4 mr-2 animate-spin" />
          Refresh Token
        </Button>
      </div>
      <div v-if="tokenInfo" class="mt-2 text-xs text-blue-700 break-all">
        <strong>Token:</strong> {{ tokenInfo.substring(0, 50) }}...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-vue-next'
import AuthStatus from '@/components/AuthStatus.vue'
import { useAuth } from '@/composables/useAuth'

// Use the authentication composable
const { 
  isAuthenticated, 
  currentUser, 
  queryPortalItems,
  getToken,
  refreshToken
} = useAuth()

// Local state
const portalItems = ref<any>(null)
const loadingItems = ref(false)
const tokenInfo = ref<string>('')
const loadingToken = ref(false)

// Load portal items
const loadPortalItems = async () => {
  try {
    loadingItems.value = true
    const items = await queryPortalItems()
    portalItems.value = items
  } catch (error) {
    console.error('Failed to load portal items:', error)
  } finally {
    loadingItems.value = false
  }
}

// Test get token
const testGetToken = async () => {
  try {
    loadingToken.value = true
    const token = await getToken()
    tokenInfo.value = token || 'No token available'
  } catch (error) {
    console.error('Failed to get token:', error)
  } finally {
    loadingToken.value = false
  }
}

// Test refresh token
const testRefreshToken = async () => {
  try {
    loadingToken.value = true
    const token = await refreshToken()
    tokenInfo.value = token || 'No token available'
  } catch (error) {
    console.error('Failed to refresh token:', error)
  } finally {
    loadingToken.value = false
  }
}

// Open item in new tab
const openItem = (item: any) => {
  if (item.itemPageUrl) {
    window.open(item.itemPageUrl, '_blank')
  }
}
</script>
