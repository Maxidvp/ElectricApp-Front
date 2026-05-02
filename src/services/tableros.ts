const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function getTableros() {
  const res = await fetch(`${API_URL}/tableros`)
  if (!res.ok) throw new Error('Error al traer los tableros')
  return res.json()
}

export async function getTablero(id: number) {
  const res = await fetch(`${API_URL}/tableros/${id}`)
  if (!res.ok) throw new Error('Error al traer el tablero')
  return res.json()
}

export async function createTablero(data: any) {
  const res = await fetch(`${API_URL}/tableros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al crear el tablero')
  return res.json()
}

export async function updateTablero(id: number, data: any) {
  const res = await fetch(`${API_URL}/tableros/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al actualizar el tablero')
  return res.json()
}

export async function deleteTablero(id: number) {
  const res = await fetch(`${API_URL}/tableros/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Error al eliminar el tablero')
  return res.json()
}