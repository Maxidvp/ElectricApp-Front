import { apiFetch } from './apiFetch'

export type ProteccionPatch = {
  polos: number | null
  In: number | null
  Icu: number | null
  curva: string | null
  sensibilidad_mA: number | null
  clase_diferencial: string | null
  rango_regulacion_min: number | null
  rango_regulacion_max: number | null
}

export async function getProtecciones(tipo?: string) {
  const res = await apiFetch(`/protecciones${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ''}`)
  if (!res.ok) throw new Error('Error al traer las protecciones')
  return res.json()
}

export async function getProteccionesPorFamilia(familiaId: number) {
  const res = await apiFetch(`/protecciones/familia/${familiaId}`)
  if (!res.ok) throw new Error('Error al traer las protecciones de la familia')
  return res.json()
}

export async function createProteccion(familiaId: number, data: ProteccionPatch) {
  const res = await apiFetch(`/protecciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, familia_id: familiaId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al crear la protección')
  }
  return res.json()
}

export async function createProteccionesBulk(familiaId: number, items: ProteccionPatch[]) {
  const res = await apiFetch(`/protecciones/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familia_id: familiaId, items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al importar las protecciones')
  }
  return res.json()
}

export async function updateProteccion(id: number, data: Partial<ProteccionPatch>) {
  const res = await apiFetch(`/protecciones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Error al actualizar la protección')
  }
  return res.json()
}

export async function deleteProteccion(id: number) {
  const res = await apiFetch(`/protecciones/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar la protección')
  return res.json()
}
