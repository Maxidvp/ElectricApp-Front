import { apiFetch } from './apiFetch'

export async function getFamiliasCables() {
  const res = await apiFetch(`/familias_cables`)
  if (!res.ok) throw new Error('Error al traer las familias de cables')
  return res.json()
}

export type FamiliaCablePatch = {
  norma: string
  modelo: string | null
  material: string
  aislamiento: string
  tipo: string
  nombre: string
  catalogo: string | null
  tension_nom: string | null
  tension_aisl: number | null
  proteccion: string | null
  pantalla: string | null
  blindaje: string | null
  temperatura: number | null
  temperatura_imp: number | null
}

export async function createFamiliaCable(data: FamiliaCablePatch) {
  const res = await apiFetch(`/familias_cables`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al crear la familia de cable')
  }
  return res.json()
}

export async function updateFamiliaCable(id: number, data: FamiliaCablePatch) {
  const res = await apiFetch(`/familias_cables/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al editar la familia de cable')
  }
  return res.json()
}

export async function deleteFamiliaCable(id: number) {
  const res = await apiFetch(`/familias_cables/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar la familia')
  return res.json()
}
