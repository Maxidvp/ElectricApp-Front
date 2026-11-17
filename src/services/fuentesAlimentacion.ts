import { apiFetch } from './apiFetch'

export async function createFuenteAlimentacion(data: any) {
  const res = await apiFetch(`/fuentes-alimentacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear la fuente de alimentación')
  return res.json()
}

export async function updateFuenteAlimentacion(id: number, data: any) {
  const res = await apiFetch(`/fuentes-alimentacion/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar la fuente de alimentación')
  return res.json()
}

export async function deleteFuenteAlimentacion(id: number) {
  const res = await apiFetch(`/fuentes-alimentacion/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar la fuente de alimentación')
  return res.json()
}

// Deshace un borrado (el back hace borrado lógico: ver Back/src/lib/borradoLogico.ts).
export async function restaurarFuenteAlimentacion(id: number) {
  const res = await apiFetch(`/fuentes-alimentacion/${id}/restaurar`, { method: 'POST' })
  if (!res.ok) throw new Error('No se pudo restaurar')
  return res.json()
}
