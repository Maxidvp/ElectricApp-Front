export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, credentials: 'include' })
}
