import { apiFetch } from './apiFetch'
import type { GrupoDiferencial } from '@/context/types'

type CrearGrupoDiferencial = { tablero_id: number; nombre: string | null; proteccion_id: number | null }
type EditarGrupoDiferencial = Partial<Omit<CrearGrupoDiferencial, 'tablero_id'>>

export async function createGrupoDiferencial(data: CrearGrupoDiferencial): Promise<GrupoDiferencial> {
  const res = await apiFetch(`/grupos-diferenciales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear el grupo diferencial')
  return res.json()
}

export async function updateGrupoDiferencial(id: number, data: EditarGrupoDiferencial): Promise<GrupoDiferencial> {
  const res = await apiFetch(`/grupos-diferenciales/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar el grupo diferencial')
  return res.json()
}

export async function deleteGrupoDiferencial(id: number): Promise<{ mensaje: string }> {
  const res = await apiFetch(`/grupos-diferenciales/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar el grupo diferencial')
  return res.json()
}
