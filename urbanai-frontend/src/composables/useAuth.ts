import { ref, computed } from 'vue'
import Portal from '@arcgis/core/portal/Portal'
import OAuthInfo from '@arcgis/core/identity/OAuthInfo'
import esriId from '@arcgis/core/identity/IdentityManager'
import PortalQueryParams from '@arcgis/core/portal/PortalQueryParams'

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

interface ArcGISCredential {
  token: string
  server: string
  userId: string
  expires?: number
}

// State
const authStatus = ref<AuthStatus>({ authenticated: false })
const isLoading = ref(false)
const error = ref<string>('')
const portal = ref<any>(null)

// OAuth Configuration
const CLIENT_ID = import.meta.env.VITE_ARCGIS_CLIENT_ID || 'zkqNEDmXGPG1Ml2N'
const PORTAL_URL_ENV = import.meta.env.VITE_ARCGIS_PORTAL_URL || 'https://www.arcgis.com'

// Use proxy URL during development to avoid CORS issues
const PORTAL_URL = import.meta.env.DEV 
  ? '/portal'  // This will be proxied to https://gisportal-stmb.bayern.de/portal
  : PORTAL_URL_ENV

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
    portalUrl: PORTAL_URL_ENV,  // Use actual URL for OAuth redirect
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
    portalUrl: PORTAL_URL_ENV
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
        const credential = await esriId.checkSignInStatus(PORTAL_URL_ENV + "/sharing")
        
        if (credential) {
          console.log('✅ Found existing credential, loading portal...')
          
          // User is signed in, create portal and get user info
          const portalInstance = new Portal({
            authMode: "immediate"
          })
          
          // Check if using a portal other than ArcGIS Online (following official sample pattern)
          if (PORTAL_URL_ENV !== "https://www.arcgis.com") {
            portalInstance.url = PORTAL_URL_ENV
          }
          
          await portalInstance.load()
          
          if (portalInstance.user) {
            const status: AuthStatus = {
              authenticated: true,
              user: {
                username: portalInstance.user.username || '',
                fullName: portalInstance.user.fullName || '',
                email: portalInstance.user.email || undefined
              },
              portal: portalInstance
            }
            
            authStatus.value = status
            portal.value = portalInstance
            
            console.log('✅ User is authenticated:', status.user)
            return status
          }
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
        await esriId.checkSignInStatus(PORTAL_URL_ENV + "/sharing")
        console.log('✅ Already signed in, updating auth status')
        await checkAuthStatus()
        return
      } catch (signInError) {
        console.log('ℹ️ Not signed in, proceeding with OAuth flow')
        
        // If not signed in, get credential (this triggers OAuth)
        try {
          const credential = await esriId.getCredential(PORTAL_URL_ENV + "/sharing", {
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

  // Query portal items (example from the sample)
  const queryPortalItems = async (query: string = '', num: number = 20) => {
    try {
      if (!portal.value) {
        throw new Error('Portal not available. Please login first.')
      }
      
      const queryParams = new PortalQueryParams({
        query: query || `owner:${portal.value.user.username}`,
        sortField: "num-views",
        sortOrder: "desc",
        num: num
      })
      
      const results = await portal.value.queryItems(queryParams)
      console.log('✅ Portal items queried:', results)
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
