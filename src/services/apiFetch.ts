export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// AuthProvider registra acá cómo limpiar la sesión local — apiFetch no puede importar
// el context directo (evita ciclo de imports / no es un hook), así que se comunica por
// este callback en vez de por props. Si el back devuelve 401 (sesión revocada o
// expirada, ej. Usuario.activo=false a mitad de uso) se dispara una sola vez y
// RequireAuth se encarga de redirigir a /login al ver `usuario` en null.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include' })
  if (res.status === 401) onUnauthorized?.()
  return res
}
