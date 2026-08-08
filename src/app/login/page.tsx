'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const { login, register } = useAuth()
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, nombre || undefined)
      router.push('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-a0">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4 p-8 rounded-lg bg-surface-tonal-a0 border border-surface-tonal-a20"
      >
        <h1 className="text-lg font-bold text-font-a0">
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>

        {mode === 'register' && (
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="px-3 py-2 rounded-md bg-surface-a0 border border-surface-tonal-a20 text-font-a0 text-sm"
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="px-3 py-2 rounded-md bg-surface-a0 border border-surface-tonal-a20 text-font-a0 text-sm"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          className="px-3 py-2 rounded-md bg-surface-a0 border border-surface-tonal-a20 text-font-a0 text-sm"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="px-3 py-2 rounded-md bg-primary-a30 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Enviando...' : mode === 'login' ? 'Entrar' : 'Registrarse'}
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
          className="text-xs text-surface-tonal-a40 hover:text-font-a0"
        >
          {mode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </form>
    </div>
  )
}
