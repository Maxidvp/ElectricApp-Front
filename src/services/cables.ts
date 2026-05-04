const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function getCablesPorFamilia(familiaId: number) {
  const res = await fetch(`${API_URL}/cables/familia/${familiaId}`)
  if (!res.ok) throw new Error('Error al traer los cables')
  return res.json()
}