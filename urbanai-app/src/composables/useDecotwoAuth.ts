import { ref, readonly } from 'vue'
import { useRouter } from 'vue-router'

// Types
interface LoginCredentials {
  username: string
  password: string
}

interface User {
  id: string
  username?: string
  email?: string
  name?: string
  // Add other user properties as needed
}

interface AuthResponse {
  access_token: string
  expires_in: number
}

// State (global, shared across all instances)
const user = ref<User | null>(null)
const token = ref<string | null>(null)
const isAuthenticated = ref(false)
const isLoading = ref(false)
const error = ref<string>('')

// Initialize auth state immediately when module is loaded
const initializeAuthState = () => {
  try {
    const storedToken = localStorage.getItem('decotwo_token')
    const storedUser = localStorage.getItem('decotwo_user')
    
    if (storedToken && storedUser && storedUser !== 'undefined') {
      const parsedUser = JSON.parse(storedUser)
      if (parsedUser && typeof parsedUser === 'object') {
        token.value = storedToken
        user.value = parsedUser
        isAuthenticated.value = true
        return true
      }
    }
  } catch (error) {
    console.error('Error parsing stored user data:', error)
    localStorage.removeItem('decotwo_token')
    localStorage.removeItem('decotwo_user')
  }
  
  token.value = null
  user.value = null
  isAuthenticated.value = false
  return false
}

// Initialize immediately when module loads
initializeAuthState()

// Base API URL
const BASE_API_URL = 'https://api.decotwo.com'

export function useDecotwoAuth() {
  const router = useRouter()

  // Re-initialize auth state (mainly for manual refresh)
  const initAuth = () => {
    return initializeAuthState()
  }

  // Login function
  const login = async (credentials: LoginCredentials): Promise<void> => {
    isLoading.value = true
    error.value = ''

    try {
      const response = await fetch(`${BASE_API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Login failed')
      }

      const authData: AuthResponse = await response.json()
      
      // Store auth data
      token.value = authData.access_token
      
      // Decode JWT token to extract user info
      try {
        const base64Url = authData.access_token.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join(''))
        
        const tokenPayload = JSON.parse(jsonPayload)
        user.value = {
          id: tokenPayload.sub || tokenPayload['cognito:username'] || '',
          username: tokenPayload['cognito:username'] || '',
          email: tokenPayload.email || '',
          name: tokenPayload.name || tokenPayload.email || tokenPayload['cognito:username'] || ''
        }
      } catch (err) {
        console.error('Error decoding token:', err)
        // Fallback user object
        user.value = {
          id: 'unknown',
          username: 'User',
          email: '',
          name: 'User'
        }
      }
      
      isAuthenticated.value = true

      // Persist to localStorage
      localStorage.setItem('decotwo_token', authData.access_token)
      localStorage.setItem('decotwo_user', JSON.stringify(user.value))

      // Redirect to app
      router.push('/')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      console.error('Login error:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Logout function
  const logout = () => {
    token.value = null
    user.value = null
    isAuthenticated.value = false
    
    // Clear localStorage
    localStorage.removeItem('decotwo_token')
    localStorage.removeItem('decotwo_user')
    
    // Redirect to login
    router.push('/login')
  }

  // Get auth header for API requests
  const getAuthHeader = () => {
    if (!token.value) {
      console.log('No token available for auth header')
      return {}
    }
    return { Authorization: `Bearer ${token.value}` }
  }

  return {
    // State
    user: readonly(user),
    token: readonly(token),
    isAuthenticated: readonly(isAuthenticated),
    isLoading: readonly(isLoading),
    error: readonly(error),
    
    // Methods
    login,
    logout,
    getAuthHeader,
    initAuth,
  }
}
