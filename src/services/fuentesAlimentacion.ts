const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function createFuenteAlimentacion(data: any) {
  const res = await fetch(`${API_URL}/fuentes-alimentacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear la fuente de alimentación')
  return res.json()
}

export async function updateFuenteAlimentacion(id: number, data: any) {
  const res = await fetch(`${API_URL}/fuentes-alimentacion/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar la fuente de alimentación')
  return res.json()
}

export async function deleteFuenteAlimentacion(id: number) {
  const res = await fetch(`${API_URL}/fuentes-alimentacion/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar la fuente de alimentación')
  return res.json()
}
