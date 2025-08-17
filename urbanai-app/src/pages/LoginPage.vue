<template>
  <div class="min-h-screen flex">
    <!-- Left side - Login form -->
    <div class="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to DeCO<sub class="text-2xl">two</sub>
          </h2>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account to continue
          </p>
        </div>

        <form class="mt-8 space-y-6" @submit.prevent="handleLogin">
          <div class="space-y-4">
            <div>
              <Label for="username">Username</Label>
              <Input
                id="username"
                v-model="username"
                type="text"
                autocomplete="username"
                required
                placeholder="Enter your username"
                :disabled="isLoading"
              />
            </div>

            <div>
              <Label for="password">Password</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                autocomplete="current-password"
                required
                placeholder="Enter your password"
                :disabled="isLoading"
              />
            </div>
          </div>

          <div v-if="error" class="text-sm text-red-600 dark:text-red-400">
            {{ error }}
          </div>

          <Button
            type="submit"
            class="w-full"
            :disabled="isLoading"
          >
            <div v-if="isLoading" class="flex items-center justify-center">
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Signing in...
            </div>
            <span v-else>Sign in</span>
          </Button>
        </form>

        <div class="text-center">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            By signing in, you agree to our 
            <a href="#" class="text-blue-600 hover:text-blue-500 dark:text-blue-400">Terms of Service</a> 
            and 
            <a href="#" class="text-blue-600 hover:text-blue-500 dark:text-blue-400">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>

    <!-- Right side - Background/Image -->
    <div class="hidden lg:flex lg:flex-1 lg:relative bg-black">
      <div class="absolute top-4 right-4">
        <img src="@/assets/deco_two_logo.svg" alt="DeCOtwo Logo" class="h-12 w-auto filter brightness-0 invert" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDecotwoAuth } from '@/composables/useDecotwoAuth'

const { login, isLoading, error } = useDecotwoAuth()

// Form data
const username = ref('')
const password = ref('')

const handleLogin = async () => {
  if (!username.value || !password.value) return
  
  await login({
    username: username.value,
    password: password.value
  })
}
</script>
