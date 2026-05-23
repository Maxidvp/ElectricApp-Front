const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function getCircuitos() {
  const res = await fetch(`${API_URL}/circuitos`)
  if (!res.ok) throw new Error('Error al traer los circuitos')
  return res.json()
}

export async function getCircuito(id: number) {
  const res = await fetch(`${API_URL}/circuitos/${id}`)
  if (!res.ok) throw new Error('Error al traer el circuito')
  return res.json()
}

export async function createCircuito(data: any) {
  const res = await fetch(`${API_URL}/circuitos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al crear el circuito')
  return res.json()
}

export async function updateCircuito(id: number, data: any) {
  const res = await fetch(`${API_URL}/circuitos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al actualizar el circuito')
  return res.json()
}

export async function deleteCircuito(id: number) {
  const res = await fetch(`${API_URL}/circuitos/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Error al eliminar el circuito')
  return res.json()
}

export async function updateDescripcionCircuito(id: number, descipcion: string | null) {
  const res = await fetch(`${API_URL}/circuitos/${id}/descripcion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descipcion }),
  })
  if (!res.ok) throw new Error('Error al actualizar la descripción')
  return res.json()
}

export async function updateNombreCircuito(id: number, circuito: string) {
  const res = await fetch(`${API_URL}/circuitos/${id}/nombre`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circuito })
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Error al actualizar el circuito')
  }
  return res.json()
}

export async function crearCircuitoVacio(tableroId: number) {
  const res = await fetch(`${API_URL}/circuitos/vacio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tablero_id: tableroId })
  })
  if (!res.ok) throw new Error('Error al crear el circuito')
  return res.json()
}

export async function duplicarCircuito(circuitoId: number) {
  const res = await fetch(`${API_URL}/circuitos/duplicar/${circuitoId}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Error al duplicar el circuito')
  return res.json()
}

export type FormacionPatch = {
  cable_id: number
  nombre: string
  cond_por_fase: number
  Nfases: number
  Nneutro: number
  cable_neutro_id: number | null
  cable_tierra_id: number | null
}

export async function reordenarCircuitos(ordenes: { id: number; orden: number }[]) {
  const res = await fetch(`${API_URL}/circuitos/reordenar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordenes),
  })
  if (!res.ok) throw new Error('Error al reordenar circuitos')
}

export async function updateFormacion(circuitoId: number, data: FormacionPatch) {
  const res = await fetch(`${API_URL}/circuitos/${circuitoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al actualizar la formación')
  return res.json()
}