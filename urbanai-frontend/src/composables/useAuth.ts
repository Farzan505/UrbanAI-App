import { ref, computed } from 'vue'

// Types
interface AuthStatus {
  authenticated: boolean
  has_token?: boolean
  session_created?: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

// State
const authStatus = ref<AuthStatus>({ authenticated: false })
const isLoading = ref(false)
const error = ref<string>('')

// Backend base URL
const API_BASE_URL = 'http://localhost:8080'

// Composable
export function useAuth() {
  // Check authentication status
  const checkAuthStatus = async (): Promise<AuthStatus> => {
    try {
      isLoading.value = true
      error.value = ''
      
      const response = await fetch(`${API_BASE_URL}/auth/status`, {
        credentials: 'include', // Include session cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const status: AuthStatus = await response.json()
      authStatus.value = status
      
      console.log('✅ Auth status checked:', status)
      return status
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Failed to check auth status: ${errorMessage}`
      console.error('❌ Auth status check failed:', err)
      authStatus.value = { authenticated: false }
      return { authenticated: false }
    } finally {
      isLoading.value = false
    }
  }

  // Initiate login (redirects to ArcGIS OAuth)
  const login = async (): Promise<void> => {
    try {
      error.value = ''
      console.log('🔑 Initiating login...')
      
      // Redirect to backend login endpoint
      window.location.href = `${API_BASE_URL}/auth/login`
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Login failed: ${errorMessage}`
      console.error('❌ Login failed:', err)
    }
  }

  // Get current access token
  const getToken = async (): Promise<TokenResponse | null> => {
    try {
      isLoading.value = true
      error.value = ''
      
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        credentials: 'include', // Include session cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          authStatus.value = { authenticated: false }
          return null
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const token: TokenResponse = await response.json()
      console.log('✅ Token retrieved successfully')
      return token
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Failed to get token: ${errorMessage}`
      console.error('❌ Token retrieval failed:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  // Refresh access token
  const refreshToken = async (): Promise<TokenResponse | null> => {
    try {
      isLoading.value = true
      error.value = ''
      
      const response = await fetch(`${API_BASE_URL}/auth/refresh_token`, {
        method: 'POST',
        credentials: 'include', // Include session cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          authStatus.value = { authenticated: false }
          return null
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const token: TokenResponse = await response.json()
      console.log('✅ Token refreshed successfully')
      return token
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Failed to refresh token: ${errorMessage}`
      console.error('❌ Token refresh failed:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  // Logout
  const logout = async (): Promise<void> => {
    try {
      isLoading.value = true
      error.value = ''
      
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Include session cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      authStatus.value = { authenticated: false }
      console.log('✅ Logged out successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Logout failed: ${errorMessage}`
      console.error('❌ Logout failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Make authenticated request with automatic token handling
  const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    try {
      // First, try with session cookies
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      // If unauthorized, try to get a fresh token
      if (response.status === 401) {
        console.log('🔄 Unauthorized, attempting to refresh token...')
        
        const token = await refreshToken()
        if (!token) {
          throw new Error('Authentication required')
        }

        // Retry with Bearer token
        return fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token.access_token}`,
            ...options.headers,
          },
        })
      }

      return response
    } catch (err) {
      console.error('❌ Authenticated fetch failed:', err)
      throw err
    }
  }

  // Computed properties
  const isAuthenticated = computed(() => authStatus.value.authenticated)
  const hasToken = computed(() => authStatus.value.has_token)

  return {
    // State
    authStatus: computed(() => authStatus.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    isAuthenticated,
    hasToken,

    // Methods
    checkAuthStatus,
    login,
    logout,
    getToken,
    refreshToken,
    authenticatedFetch,
  }
}
