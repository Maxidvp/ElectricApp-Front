import { apiFetch } from './apiFetch'

export type SpdaMallaMeta = {
  id: number
  tipo: 'suelo' | 'edificio'
  nombre: string
  vertices: number
  triangulos: number
  created_at: string
  proyecto_id: number
}

export type SpdaMallaCompleta = SpdaMallaMeta & {
  positions: string // base64
  indices: string | null // base64
}

export async function getSpdaMallas(proyectoId: number): Promise<SpdaMallaMeta[]> {
  const res = await apiFetch(`/spda-mallas?proyecto_id=${proyectoId}`)
  if (!res.ok) throw new Error('Error al traer los modelos guardados')
  return res.json()
}

export async function getSpdaMalla(id: number): Promise<SpdaMallaCompleta> {
  const res = await apiFetch(`/spda-mallas/${id}`)
  if (!res.ok) throw new Error('Error al traer el modelo')
  return res.json()
}

export async function deleteSpdaMalla(id: number): Promise<void> {
  const res = await apiFetch(`/spda-mallas/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al borrar el modelo')
}

export async function renombrarSpdaMalla(id: number, nombre: string): Promise<SpdaMallaMeta> {
  const res = await apiFetch(`/spda-mallas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error('Error al renombrar el modelo')
  return res.json()
}
