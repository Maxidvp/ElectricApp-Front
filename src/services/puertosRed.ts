import { apiFetch } from './apiFetch'

export async function createPuertoRed(data: any) {
  const res = await apiFetch(`/puertos-red`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear el puerto de red')
  return res.json()
}

export async function updatePuertoRed(id: number, data: any) {
  const res = await apiFetch(`/puertos-red/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar el puerto de red')
  return res.json()
}

export async function deletePuertoRed(id: number) {
  const res = await apiFetch(`/puertos-red/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar el puerto de red')
  return res.json()
}

export async function crearPuertoRedVacio(tableroId: number) {
  const res = await apiFetch(`/puertos-red/vacio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tablero_id: tableroId }),
  })
  if (!res.ok) throw new Error('Error al crear el puerto de red')
  return res.json()
}

export async function duplicarPuertoRed(puertoId: number) {
  const res = await apiFetch(`/puertos-red/duplicar/${puertoId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al duplicar el puerto de red')
  return res.json()
}

export async function reordenarPuertosRed(ordenes: { id: number; orden: number }[]) {
  const res = await apiFetch(`/puertos-red/reordenar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordenes),
  })
  if (!res.ok) throw new Error('Error al reordenar los puertos de red')
  return res.json()
}
