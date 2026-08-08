import type { Canio } from './ruteo'
import { apiFetch } from './apiFetch'

export type CanioDeCanieroCircuito = {
  id: number
  circuito: string
  tablero: { tag: string }
}

export type CanioDeCaniero = {
  id: number
  fila: number
  orden: number
  caniero_id: number
  canio_id: number
  canio: Canio
  camisa_canio_id: number | null
  camisa_canio: Canio | null
  circuitos: CanioDeCanieroCircuito[]
}

export type Caniero = {
  id: number
  nombre: string
  tapada: number | null
  espaciamiento_horizontal: number | null
  espaciamiento_vertical: number | null
  hormigonado: boolean
  recubrimiento: number | null
  proyecto_id: number
  canios: CanioDeCaniero[]
}

export type CreateCanieroInput = {
  nombre: string
  proyecto_id: number
  tapada?: number | null
  espaciamiento_horizontal?: number | null
  espaciamiento_vertical?: number | null
  hormigonado?: boolean
  recubrimiento?: number | null
}

export async function getCanieros(proyectoId: number): Promise<Caniero[]> {
  const res = await apiFetch(`/canieros?proyecto_id=${proyectoId}`)
  if (!res.ok) throw new Error('Error al traer canieros')
  return res.json()
}

export async function getCaniero(id: number): Promise<Caniero> {
  const res = await apiFetch(`/canieros/${id}`)
  if (!res.ok) throw new Error('Error al traer el caniero')
  return res.json()
}

export async function createCaniero(data: CreateCanieroInput): Promise<Caniero> {
  const res = await apiFetch(`/canieros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear caniero')
  return res.json()
}

export async function updateCaniero(id: number, data: Partial<Omit<CreateCanieroInput, 'proyecto_id'>>): Promise<Caniero> {
  const res = await apiFetch(`/canieros/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar caniero')
  return res.json()
}

export async function deleteCaniero(id: number): Promise<void> {
  const res = await apiFetch(`/canieros/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar caniero')
}

export async function addCanioDeCaniero(canieroId: number, canioId: number, fila: number): Promise<Caniero> {
  const res = await apiFetch(`/canieros/${canieroId}/canios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canio_id: canioId, fila }),
  })
  if (!res.ok) throw new Error('Error al agregar caño')
  return res.json()
}

export async function updateCanioDeCaniero(id: number, data: { canio_id?: number; camisa_canio_id?: number | null }): Promise<CanioDeCaniero> {
  const res = await apiFetch(`/canios_de_caniero/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar caño')
  return res.json()
}

export async function deleteCanioDeCaniero(id: number): Promise<void> {
  const res = await apiFetch(`/canios_de_caniero/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar caño')
}

export async function addCircuitoToCanio(canioDeCanieroId: number, circuitoId: number): Promise<CanioDeCaniero> {
  const res = await apiFetch(`/canios_de_caniero/${canioDeCanieroId}/circuitos/${circuitoId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al agregar circuito al caño')
  return res.json()
}

export async function removeCircuitoFromCanio(canioDeCanieroId: number, circuitoId: number): Promise<CanioDeCaniero> {
  const res = await apiFetch(`/canios_de_caniero/${canioDeCanieroId}/circuitos/${circuitoId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al quitar circuito del caño')
  return res.json()
}
