import { ref, computed } from 'vue'
import OAuthInfo from '@arcgis/core/identity/OAuthInfo'
import esriId from '@arcgis/core/identity/IdentityManager'

// Types
interface AuthStatus {
  authenticated: boolean
  user?: {
    username: string
    fullName: string
    email?: string
  }
  portal?: any
}

// State
const authStatus = ref<AuthStatus>({ authenticated: false })
const isLoading = ref(false)
const error = ref<string>('')
const portal = ref<any>(null)

// OAuth Configuration
const CLIENT_ID = import.meta.env.VITE_ARCGIS_CLIENT_ID || 'zkqNEDmXGPG1Ml2N'
const PORTAL_URL = import.meta.env.VITE_ARCGIS_PORTAL_URL || 'https://gisportal-stmb.bayern.de/portal'
// Use proxy URL for API calls to avoid CORS
const PROXY_PORTAL_URL = import.meta.env.VITE_ARCGIS_PROXY_URL || '/gisportal/portal'

// Track if OAuth has been configured
let oauthConfigured = false

// Initialize OAuth configuration
async function setupOAuth() {
  // Only configure once
  if (oauthConfigured) {
    console.log('ℹ️ OAuth already configured')
    return
  }
  
  // Create a new OAuthInfo object
  // Always use the actual portal URL for OAuth, not the proxy
  const oauthInfo = new OAuthInfo({
    appId: CLIENT_ID,
    portalUrl: PORTAL_URL,  // Use actual URL for OAuth redirect
    // Set popup to false to use redirect flow
    popup: false,
    // Set the authNamespace to prevent sharing state with other apps
    authNamespace: "urbanai_oauth"
  })
  
  // Register the OAuthInfo with IdentityManager
  esriId.registerOAuthInfos([oauthInfo])
  oauthConfigured = true
  
  console.log('✅ OAuth configuration registered with:', {
    appId: CLIENT_ID,
    portalUrl: PORTAL_URL
  })
  return oauthInfo
}

// Composable
export function useAuth() {
  // Check authentication status
  const checkAuthStatus = async (): Promise<AuthStatus> => {
    try {
      isLoading.value = true
      error.value = ''
      
      // Ensure OAuth is configured first
      await setupOAuth()
      
      // Check if user is already signed in (use actual portal URL for OAuth)
      try {
        const credential = await esriId.checkSignInStatus(PORTAL_URL + "/sharing")
        
        if (credential) {
          console.log('✅ Found existing credential')
          
          // Following the official sample pattern - don't load portal immediately
          // Just mark as authenticated with the credential info
          const status: AuthStatus = {
            authenticated: true,
            user: {
              username: credential.userId || 'User',
              fullName: 'Authenticated User', 
              email: undefined
            },
            portal: null // Will be loaded on demand to avoid CORS issues
          }
          
          authStatus.value = status
          
          console.log('✅ User is authenticated:', status.user)
          return status
        }
      } catch (signInError) {
        // User is not signed in
        console.log('ℹ️ User is not signed in:', signInError)
      }
      
      const status: AuthStatus = { authenticated: false }
      authStatus.value = status
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

  // Initiate login using ArcGIS OAuth (following official sample pattern)
  const login = async (): Promise<void> => {
    try {
      isLoading.value = true
      error.value = ''
      console.log('🔑 Initiating login...')
      
      await setupOAuth()
      
      // Follow the exact pattern from the official sample
      try {
        // First check if already signed in (use actual portal URL for OAuth)
        await esriId.checkSignInStatus(PORTAL_URL + "/sharing")
        console.log('✅ Already signed in, updating auth status')
        await checkAuthStatus()
        return
      } catch (signInError) {
        console.log('ℹ️ Not signed in, proceeding with OAuth flow')
        
        // If not signed in, get credential (this triggers OAuth)
        try {
          const credential = await esriId.getCredential(PORTAL_URL + "/sharing", {
            oAuthPopupConfirmation: false
          })
          
          if (credential) {
            console.log('✅ Credential obtained, checking sign-in status again')
            // After getting credential, check sign-in status again (like the official sample)
            await checkAuthStatus()
          }
        } catch (credentialError) {
          console.error('❌ Failed to get credential:', credentialError)
          throw credentialError
        }
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Login failed: ${errorMessage}`
      console.error('❌ Login failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Get current access token
  const getToken = async (): Promise<string | null> => {
    try {
      isLoading.value = true
      error.value = ''
      
      // Check if user is signed in and get credential
      const credential = await esriId.checkSignInStatus(PORTAL_URL + "/sharing")
      
      if (credential && credential.token) {
        console.log('✅ Token retrieved successfully')
        return credential.token
      }
      
      return null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Failed to get token: ${errorMessage}`
      console.error('❌ Token retrieval failed:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  // Refresh access token (handled automatically by IdentityManager)
  const refreshToken = async (): Promise<string | null> => {
    try {
      isLoading.value = true
      error.value = ''
      
      // IdentityManager handles token refresh automatically
      // Just get a fresh credential
      const credential = await esriId.getCredential(PORTAL_URL + "/sharing")
      
      if (credential && credential.token) {
        console.log('✅ Token refreshed successfully')
        return credential.token
      }
      
      return null
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
      
      // Destroy all credentials to sign out
      esriId.destroyCredentials()
      
      authStatus.value = { authenticated: false }
      portal.value = null
      
      console.log('✅ Logged out successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      error.value = `Logout failed: ${errorMessage}`
      console.error('❌ Logout failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Make authenticated request with ArcGIS token
  const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    try {
      // Get current token
      const token = await getToken()
      
      if (!token) {
        throw new Error('No authentication token available')
      }
      
      // Add token to request
      const authenticatedOptions: RequestInit = {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
          'Authorization': `Bearer ${token}`
        }
      }
      
      const response = await fetch(url, authenticatedOptions)
      
      // If unauthorized, try to refresh token
      if (response.status === 401) {
        console.log('🔄 Unauthorized, attempting to refresh token...')
        
        const newToken = await refreshToken()
        if (!newToken) {
          throw new Error('Authentication required')
        }
        
        // Retry with new token
        return fetch(url, {
          ...authenticatedOptions,
          headers: {
            ...authenticatedOptions.headers,
            'Authorization': `Bearer ${newToken}`
          }
        })
      }
      
      return response
    } catch (err) {
      console.error('❌ Authenticated fetch failed:', err)
      throw err
    }
  }

  // Query portal items using direct API calls through proxy to avoid CORS
  const queryPortalItems = async (query: string = '', num: number = 20) => {
    try {
      // Get current token
      const token = await getToken()
      
      if (!token) {
        throw new Error('No authentication token available')
      }

      console.log('� Querying portal items via proxy API...')

      // If no custom query provided, get user info first to query user's items
      let finalQuery = query
      if (!query) {
        // Get user info using proxy to avoid CORS
        const userResponse = await fetch(`${PROXY_PORTAL_URL}/sharing/rest/portals/self?f=json&token=${token}`)
        if (userResponse.ok) {
          const userData = await userResponse.json()
          const username = userData.user?.username
          if (username) {
            finalQuery = `owner:${username}`
            console.log('📝 Using user-specific query:', finalQuery)
            
            // Update user info in auth status
            if (authStatus.value.authenticated) {
              authStatus.value = {
                ...authStatus.value,
                user: {
                  username: username,
                  fullName: userData.user?.fullName || 'User',
                  email: userData.user?.email || undefined
                }
              }
            }
          }
        }
      }

      // Query portal items using the search API
      const searchParams = new URLSearchParams({
        q: finalQuery || '*',
        f: 'json',
        num: num.toString(),
        sortField: 'numviews',
        sortOrder: 'desc',
        token: token
      })

      const searchUrl = `${PROXY_PORTAL_URL}/sharing/rest/search?${searchParams.toString()}`
      console.log('📡 Fetching portal items from:', searchUrl)
      
      const response = await fetch(searchUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const results = await response.json()
      console.log('✅ Portal items query results:', results)
      
      return results
      
    } catch (err) {
      console.error('❌ Failed to query portal items:', err)
      throw err
    }
  }

  // Computed properties
  const isAuthenticated = computed(() => authStatus.value.authenticated)
  const currentUser = computed(() => authStatus.value.user)
  const currentPortal = computed(() => portal.value)

  return {
    // State
    authStatus: computed(() => authStatus.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    isAuthenticated,
    currentUser,
    currentPortal,

    // Methods
    checkAuthStatus,
    login,
    logout,
    getToken,
    refreshToken,
    authenticatedFetch,
    queryPortalItems,
    
    // Utilities
    setupOAuth
  }
}
