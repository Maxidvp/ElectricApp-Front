const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export type FamiliaProteccionPatch = {
  tipo: string   // 'termomagnetico' | 'diferencial' | 'guardamotor' | 'caja_moldeada'
  marca: string | null
  modelo: string | null
  catalogo: string | null
  norma: string | null
}

export async function getFamiliasProtecciones(tipo?: string) {
  const res = await fetch(`${API_URL}/familias_protecciones${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ''}`)
  if (!res.ok) throw new Error('Error al traer las familias de protecciones')
  return res.json()
}

export async function createFamiliaProteccion(data: FamiliaProteccionPatch) {
  const res = await fetch(`${API_URL}/familias_protecciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al crear la familia de protección')
  }
  return res.json()
}

export async function updateFamiliaProteccion(id: number, data: FamiliaProteccionPatch) {
  const res = await fetch(`${API_URL}/familias_protecciones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al editar la familia de protección')
  }
  return res.json()
}

export async function deleteFamiliaProteccion(id: number) {
  const res = await fetch(`${API_URL}/familias_protecciones/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar la familia')
  return res.json()
}
