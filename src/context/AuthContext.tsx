'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import * as authApi from '@/services/auth'
import type { Usuario } from '@/services/auth'

type AuthContextType = {
  usuario: Usuario | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, nombre?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    authApi.getMe()
      .then(setUsuario)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    setUsuario(await authApi.login({ email, password }))
  }

  async function register(email: string, password: string, nombre?: string) {
    setUsuario(await authApi.register({ email, password, nombre }))
  }

  async function logout() {
    await authApi.logout()
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
