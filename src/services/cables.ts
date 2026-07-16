const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export async function getCablesPorFamilia(familiaId: number) {
  const res = await fetch(`${API_URL}/cables/familia/${familiaId}`)
  if (!res.ok) throw new Error('Error al traer los cables')
  return res.json()
}

export type CablePatch = {
  nombre: string
  calibre_tipo: string
  seccion_f: string
  seccion_n: string
  seccion_t: string
  Nfases: number
  Nneutro: number
  Ntierra: number
  diametro: number | null
  peso: number | null
  Iadm: number
}

export async function createCable(familiaId: number, data: CablePatch) {
  const res = await fetch(`${API_URL}/cables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, familia_id: familiaId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al crear el cable')
  }
  return res.json()
}

export async function createCablesBulk(familiaId: number, items: CablePatch[]) {
  const res = await fetch(`${API_URL}/cables/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familia_id: familiaId, items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al importar los cables')
  }
  return res.json()
}

export async function updateCable(id: number, patch: Partial<CablePatch>) {
  const res = await fetch(`${API_URL}/cables/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al actualizar el cable')
  }
  return res.json()
}

export async function deleteCable(id: number) {
  const res = await fetch(`${API_URL}/cables/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar el cable')
  return res.json()
}
