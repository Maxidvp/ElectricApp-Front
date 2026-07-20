const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function createLazoInstrumentacion(data: any) {
  const res = await fetch(`${API_URL}/lazos-instrumentacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear el lazo de instrumentación')
  return res.json()
}

export async function updateLazoInstrumentacion(id: number, data: any) {
  const res = await fetch(`${API_URL}/lazos-instrumentacion/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar el lazo de instrumentación')
  return res.json()
}

export async function deleteLazoInstrumentacion(id: number) {
  const res = await fetch(`${API_URL}/lazos-instrumentacion/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar el lazo de instrumentación')
  return res.json()
}

export async function crearLazoVacio(tableroId: number) {
  const res = await fetch(`${API_URL}/lazos-instrumentacion/vacio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tablero_id: tableroId }),
  })
  if (!res.ok) throw new Error('Error al crear el lazo de instrumentación')
  return res.json()
}

export async function duplicarLazoInstrumentacion(lazoId: number) {
  const res = await fetch(`${API_URL}/lazos-instrumentacion/duplicar/${lazoId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al duplicar el lazo de instrumentación')
  return res.json()
}

export async function reordenarLazos(ordenes: { id: number; orden: number }[]) {
  const res = await fetch(`${API_URL}/lazos-instrumentacion/reordenar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordenes),
  })
  if (!res.ok) throw new Error('Error al reordenar los lazos de instrumentación')
  return res.json()
}
