'use client'

import { useState, useEffect, createContext, useContext } from 'react'

interface LoginCredentials {
  username: string
  password: string
}

interface User {
  id: string
  username?: string
  email?: string
  name?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  getToken: () => string | null
  setToken: (token: string, user?: User) => void
  isTokenExpired: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMounted, setHasMounted] = useState(false)

  // Initialize auth state from localStorage only on client
  useEffect(() => {
    setHasMounted(true)
    
    const initializeAuth = () => {
      try {
        // Only access localStorage on client side
        if (typeof window !== 'undefined') {
          const storedToken = localStorage.getItem('decotwo_token')
          const storedUser = localStorage.getItem('decotwo_user')
          const tokenExpiry = localStorage.getItem('decotwo_token_expires')
          
          if (storedToken && storedUser && storedUser !== 'undefined') {
            // Check if token is expired
            const isExpired = tokenExpiry ? Date.now() > parseInt(tokenExpiry) : false
            
            if (isExpired) {
              console.log('🕒 Stored token has expired, clearing auth data')
              localStorage.removeItem('decotwo_token')
              localStorage.removeItem('decotwo_user')
              localStorage.removeItem('decotwo_token_expires')
              return
            }
            
            const parsedUser = JSON.parse(storedUser)
            if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
              setUser(parsedUser)
              setIsAuthenticated(true)
              console.log('✅ Restored authentication from localStorage:', parsedUser)
            }
          }
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error)
        if (typeof window !== 'undefined') {
          localStorage.removeItem('decotwo_token')
          localStorage.removeItem('decotwo_user')
          localStorage.removeItem('decotwo_token_expires')
        }
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true)
    setError('')

    try {
      // Real API call to decotwo login endpoint
      const response = await fetch('https://api.decotwo.com/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Login failed with status ${response.status}`)
      }

      const authData = await response.json()
      
      if (!authData.access_token) {
        throw new Error('No access token received from server')
      }

      // Extract user info from the JWT token (decode the payload)
      try {
        const tokenPayload = JSON.parse(atob(authData.access_token.split('.')[1]))
        
        const userData: User = {
          id: tokenPayload.sub || 'unknown',
          username: tokenPayload['cognito:username'] || credentials.username,
          email: tokenPayload.email || credentials.username,
          name: tokenPayload.email || credentials.username
        }

        // Store auth data
        if (typeof window !== 'undefined') {
          localStorage.setItem('decotwo_token', authData.access_token)
          localStorage.setItem('decotwo_user', JSON.stringify(userData))
          
          // Store token expiry for future use
          if (authData.expires_in) {
            const expiryTime = Date.now() + (authData.expires_in * 1000)
            localStorage.setItem('decotwo_token_expires', expiryTime.toString())
          }
        }

        setUser(userData)
        setIsAuthenticated(true)
        
        console.log('✅ Login successful:', userData)
      } catch (tokenError) {
        console.error('Error parsing JWT token:', tokenError)
        // Fallback to basic user info if token parsing fails
        const fallbackUser: User = {
          id: 'user_' + Date.now(),
          username: credentials.username,
          email: credentials.username,
          name: credentials.username
        }
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('decotwo_token', authData.access_token)
          localStorage.setItem('decotwo_user', JSON.stringify(fallbackUser))
        }
        
        setUser(fallbackUser)
        setIsAuthenticated(true)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials.'
      setError(errorMessage)
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('decotwo_token')
      localStorage.removeItem('decotwo_user')
      localStorage.removeItem('decotwo_token_expires')
    }
    setUser(null)
    setIsAuthenticated(false)
    setError('')
  }

  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('decotwo_token')
    }
    return null
  }

  const setToken = (token: string, userData?: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('decotwo_token', token)
      
      // If user data is provided, use it; otherwise create a basic user
      const userToSet = userData || {
        id: 'manual_token_user',
        username: 'Token User',
        name: 'Token User'
      }
      
      localStorage.setItem('decotwo_user', JSON.stringify(userToSet))
      setUser(userToSet)
      setIsAuthenticated(true)
      setError('')
    }
  }

  const isTokenExpired = () => {
    if (typeof window !== 'undefined') {
      const expiryTime = localStorage.getItem('decotwo_token_expires')
      if (expiryTime) {
        return Date.now() > parseInt(expiryTime)
      }
      // If no expiry time stored, assume token is valid
      return false
    }
    return true
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: hasMounted ? isAuthenticated : false,
      isLoading: hasMounted ? isLoading : true,
      error,
      login,
      logout,
      getToken,
      setToken,
      isTokenExpired
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
