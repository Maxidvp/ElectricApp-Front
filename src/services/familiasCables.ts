const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function getFamiliasCables() {
  const res = await fetch(`${API_URL}/familias_cables`)
  if (!res.ok) throw new Error('Error al traer las familias de cables')
  return res.json()
}