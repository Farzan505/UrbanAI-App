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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedToken = localStorage.getItem('decotwo_token')
        const storedUser = localStorage.getItem('decotwo_user')
        
        if (storedToken && storedUser && storedUser !== 'undefined') {
          const parsedUser = JSON.parse(storedUser)
          if (parsedUser && typeof parsedUser === 'object' && parsedUser.id) {
            setUser(parsedUser)
            setIsAuthenticated(true)
          }
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error)
        localStorage.removeItem('decotwo_token')
        localStorage.removeItem('decotwo_user')
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
      // Simulate API call - in real app this would call the actual API
      const response = await fetch('https://api.decotwo.com/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const authData = await response.json()
      const token = authData.access_token

      // For demo purposes, create a mock user from credentials
      const mockUser: User = {
        id: 'demo_user_1',
        username: credentials.username,
        name: credentials.username,
      }

      // Store auth data
      localStorage.setItem('decotwo_token', token)
      localStorage.setItem('decotwo_user', JSON.stringify(mockUser))

      setUser(mockUser)
      setIsAuthenticated(true)
    } catch (err) {
      setError('Login failed. Please check your credentials.')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('decotwo_token')
    localStorage.removeItem('decotwo_user')
    setUser(null)
    setIsAuthenticated(false)
    setError('')
  }

  const getToken = () => {
    return localStorage.getItem('decotwo_token')
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      error,
      login,
      logout,
      getToken
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
