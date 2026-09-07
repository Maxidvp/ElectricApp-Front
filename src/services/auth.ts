import { apiFetch } from './apiFetch'

export type Usuario = {
  id: number
  email: string
  nombre: string | null
  role: 'GRATUITO' | 'PAGO' | 'ADMIN'
  activo?: boolean
  created_at?: string
}

export async function register(data: { email: string; password: string; nombre?: string }): Promise<Usuario> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al registrarse')
  return res.json()
}

export async function login(data: { email: string; password: string }): Promise<Usuario> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Credenciales inválidas')
  return res.json()
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' })
}

export async function getMe(): Promise<Usuario | null> {
  const res = await apiFetch('/auth/me')
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Error al obtener el usuario')
  return res.json()
}

export async function getUsuarios(): Promise<Usuario[]> {
  const res = await apiFetch('/auth/usuarios')
  if (!res.ok) throw new Error('Error al traer usuarios')
  return res.json()
}

export async function changePassword(passwordActual: string, passwordNuevo: string): Promise<void> {
  const res = await apiFetch('/auth/password', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passwordActual, passwordNuevo }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al cambiar la contraseña')
}

export async function updateUsuarioRole(id: number, role: string): Promise<Usuario> {
  const res = await apiFetch(`/auth/usuarios/${id}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) throw new Error('Error al actualizar el rol')
  return res.json()
}
