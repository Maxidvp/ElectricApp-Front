import { apiFetch } from './apiFetch'
import type { ProyectoUsuario } from './proyectos'

// Foto completa del contenido de un proyecto (ver Back src/lib/checkpoints.ts).
// `automatico` = lo creó el back solo, antes de una restauración.
export type Checkpoint = {
  id: number
  nombre: string
  automatico: boolean
  created_at: string
  proyecto_id: number
  usuario: ProyectoUsuario | null
}

// `avisos`: referencias a catálogo (cables, protecciones, caños) que ya no
// existían y se perdieron al restaurar. `checkpoint_previo`: el automático con el
// estado de antes, para poder deshacer.
export type ResultadoRestaurar = { avisos: string[]; checkpoint_previo: Checkpoint }

async function errorDe(res: Response, fallback: string): Promise<Error> {
  return new Error((await res.json().catch(() => null))?.error || fallback)
}

export async function getCheckpoints(proyectoId: number): Promise<Checkpoint[]> {
  const res = await apiFetch(`/checkpoints?proyecto_id=${proyectoId}`)
  if (!res.ok) throw await errorDe(res, 'Error al traer los checkpoints')
  return res.json()
}

export async function createCheckpoint(proyectoId: number, nombre: string): Promise<Checkpoint> {
  const res = await apiFetch(`/checkpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proyecto_id: proyectoId, nombre }),
  })
  if (!res.ok) throw await errorDe(res, 'Error al crear el checkpoint')
  return res.json()
}

export async function restaurarCheckpoint(id: number): Promise<ResultadoRestaurar> {
  const res = await apiFetch(`/checkpoints/${id}/restaurar`, { method: 'POST' })
  if (!res.ok) throw await errorDe(res, 'Error al restaurar el checkpoint')
  return res.json()
}

export async function deleteCheckpoint(id: number): Promise<void> {
  const res = await apiFetch(`/checkpoints/${id}`, { method: 'DELETE' })
  if (!res.ok) throw await errorDe(res, 'Error al borrar el checkpoint')
}
