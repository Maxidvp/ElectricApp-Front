import { apiFetch } from './apiFetch'

export async function createLazoInstrumentacion(data: any) {
  const res = await apiFetch(`/lazos-instrumentacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear el lazo de instrumentación')
  return res.json()
}

export async function updateLazoInstrumentacion(id: number, data: any) {
  const res = await apiFetch(`/lazos-instrumentacion/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar el lazo de instrumentación')
  return res.json()
}

export async function deleteLazoInstrumentacion(id: number) {
  const res = await apiFetch(`/lazos-instrumentacion/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar el lazo de instrumentación')
  return res.json()
}

export async function crearLazoVacio(tableroId: number) {
  const res = await apiFetch(`/lazos-instrumentacion/vacio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tablero_id: tableroId }),
  })
  if (!res.ok) throw new Error('Error al crear el lazo de instrumentación')
  return res.json()
}

export async function duplicarLazoInstrumentacion(lazoId: number) {
  const res = await apiFetch(`/lazos-instrumentacion/duplicar/${lazoId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al duplicar el lazo de instrumentación')
  return res.json()
}

export async function reordenarLazos(ordenes: { id: number; orden: number }[]) {
  const res = await apiFetch(`/lazos-instrumentacion/reordenar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordenes),
  })
  if (!res.ok) throw new Error('Error al reordenar los lazos de instrumentación')
  return res.json()
}

// Deshace un borrado (el back hace borrado lógico: ver Back/src/lib/borradoLogico.ts).
export async function restaurarLazoInstrumentacion(id: number) {
  const res = await apiFetch(`/lazos-instrumentacion/${id}/restaurar`, { method: 'POST' })
  if (!res.ok) throw new Error('No se pudo restaurar')
  return res.json()
}
