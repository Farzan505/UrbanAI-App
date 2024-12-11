<script setup lang="ts">
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import ThemeToggle from '../../components/ui/ThemeToggle.vue'
import placeholderImage from '../../assets/placeholder.svg'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async (event: Event) => {
  event.preventDefault()
  loading.value = true
  error.value = ''
  
  const apiUrl = import.meta.env.VITE_API_URL
  const fullUrl = `${apiUrl}/auth/login`
  console.log('Attempting to connect to:', fullUrl)
  
  try {
    const response = await axios.post(
      fullUrl,
      {
        username: email.value,
        password: password.value
      },
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      }
    )
    
    console.log('Response Data:', response.data)
    
    if (response.data?.access_token) {
      localStorage.setItem('token', response.data.access_token)
      localStorage.setItem('tokenExpiration', response.data.expires_in.toString())
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`
      
      try {
        await router.push('/dashboard')
      } catch (navError) {
        console.error('Navigation error:', navError)
        error.value = 'Login successful but navigation failed. Please try again.'
      }
    } else {
      error.value = 'Invalid server response. Please try again.'
    }
  } catch (err: any) {
    console.error('Full error:', err)
    if (err.response) {
      error.value = err.response.data?.message || 'Login failed. Server error occurred.'
    } else if (err.request) {
      error.value = 'Network error. Please check your connection.'
    } else {
      error.value = 'Login failed. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full bg-background text-foreground lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px]">
    <div class="flex items-center justify-center py-12">
      <div class="mx-auto grid w-[350px] gap-6">
        <div class="grid gap-2 text-center">
          <div class="flex justify-between items-center">
            <h1 class="text-3xl font-bold">Login</h1>
            <ThemeToggle />
          </div>
          <p class="text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <form @submit.prevent="handleLogin" class="grid gap-4">
          <div class="grid gap-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="m@example.com"
              required
            />
          </div>
          <div class="grid gap-2">
            <div class="flex items-center">
              <Label for="password">Password</Label>

              <a
                href="/forgot-password"
                class="ml-auto inline-block text-sm underline"
              >
                Forgot your password?
              </a>
            </div>
            <Input 
              id="password" 
              v-model="password"
              type="password" 
              required 
            />
          </div>
          <div v-if="error" class="text-sm text-red-500 mt-2">
            {{ error }}
          </div>
          <Button 
            type="submit" 
            class="w-full"
            :disabled="loading"
          >
            {{ loading ? 'Logging in...' : 'Login' }}
          </Button>
        </form>
      </div>
    </div>
    <div class="hidden bg-muted lg:block">
      <img
        :src="placeholderImage"
        alt="Image"
        width="1920"
        height="1080"
        class="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
      />
    </div>
  </div>
</template>
