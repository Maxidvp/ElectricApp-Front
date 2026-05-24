const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export type Canio = {
  id: number
  nombre: string | null
  diametro_nominal: number
  diametro_interno: number | null
  color: string | null
}

export type Bandeja = {
  id: number
  nombre: string | null
  ancho: number
  alto: number | null
  color: string | null
}

export type SegmentoCircuito = {
  id: number
  circuito: string
  tablero: { tag: string }
}

export type Conjunto = {
  id: number
  nombre: string
  tableros: { id: number; tag: string }[]
  tabla_paredes: { id: number }[]
}

export type Segmento = {
  id: number
  tipo: string
  x1: number; y1: number; z1: number
  x2: number; y2: number; z2: number
  canio_id: number | null
  bandeja_id: number | null
  color: string | null
  canio: Canio | null
  bandeja: Bandeja | null
  circuitos: SegmentoCircuito[]
  conjuntos: Conjunto[]
}

export type CreateSegmentoInput = Omit<Segmento, 'id' | 'canio' | 'bandeja' | 'circuitos' | 'conjuntos' | 'color'> & {
  color?: string | null
  conjunto_ids?: number[]
}

// Canios
export async function getCanios(): Promise<Canio[]> {
  const res = await fetch(`${API}/canios`)
  if (!res.ok) throw new Error('Error al traer caños')
  return res.json()
}

export async function createCanio(data: Omit<Canio, 'id'>): Promise<Canio> {
  const res = await fetch(`${API}/canios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al crear caño')
  return res.json()
}

// Bandejas
export async function getBandejas(): Promise<Bandeja[]> {
  const res = await fetch(`${API}/bandejas`)
  if (!res.ok) throw new Error('Error al traer bandejas')
  return res.json()
}

export async function createBandeja(data: Omit<Bandeja, 'id'>): Promise<Bandeja> {
  const res = await fetch(`${API}/bandejas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al crear bandeja')
  return res.json()
}

// Segmentos
export async function getSegmentos(): Promise<Segmento[]> {
  const res = await fetch(`${API}/segmentos`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status} al traer segmentos`)
  }
  return res.json()
}

export async function createSegmento(data: CreateSegmentoInput): Promise<Segmento> {
  const res = await fetch(`${API}/segmentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status} al crear segmento`)
  }
  return res.json()
}

export async function updateSegmento(id: number, data: Partial<Omit<Segmento, 'canio' | 'bandeja' | 'circuitos' | 'conjuntos'>>): Promise<Segmento> {
  const res = await fetch(`${API}/segmentos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al actualizar segmento')
  return res.json()
}

export async function deleteSegmento(id: number): Promise<void> {
  const res = await fetch(`${API}/segmentos/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar segmento')
}

export async function addCircuitoToSegmento(segmentoId: number, circuitoId: number): Promise<Segmento> {
  const res = await fetch(`${API}/segmentos/${segmentoId}/circuitos/${circuitoId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al agregar circuito')
  return res.json()
}

export async function removeCircuitoFromSegmento(segmentoId: number, circuitoId: number): Promise<Segmento> {
  const res = await fetch(`${API}/segmentos/${segmentoId}/circuitos/${circuitoId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al quitar circuito')
  return res.json()
}

// Conjuntos
export async function getConjuntos(): Promise<Conjunto[]> {
  const res = await fetch(`${API}/conjuntos`)
  if (!res.ok) throw new Error('Error al traer conjuntos')
  return res.json()
}

export async function createConjunto(nombre: string, proyecto_id?: number | null): Promise<Conjunto> {
  const res = await fetch(`${API}/conjuntos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, proyecto_id }),
  })
  if (!res.ok) throw new Error('Error al crear conjunto')
  return res.json()
}

export async function updateConjunto(id: number, nombre: string): Promise<Conjunto> {
  const res = await fetch(`${API}/conjuntos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error('Error al renombrar conjunto')
  return res.json()
}

export async function deleteConjunto(id: number): Promise<void> {
  const res = await fetch(`${API}/conjuntos/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar conjunto')
}

export async function addTableroToConjunto(conjuntoId: number, tableroId: number): Promise<Conjunto> {
  const res = await fetch(`${API}/conjuntos/${conjuntoId}/tableros/${tableroId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al agregar tablero al conjunto')
  return res.json()
}

export async function removeTableroFromConjunto(conjuntoId: number, tableroId: number): Promise<Conjunto> {
  const res = await fetch(`${API}/conjuntos/${conjuntoId}/tableros/${tableroId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al quitar tablero del conjunto')
  return res.json()
}

export async function addSegmentoToConjunto(segId: number, conjuntoId: number): Promise<void> {
  const res = await fetch(`${API}/conjuntos/${conjuntoId}/segmentos/${segId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al agregar segmento al conjunto')
}

export async function removeSegmentoFromConjunto(segId: number, conjuntoId: number): Promise<void> {
  const res = await fetch(`${API}/conjuntos/${conjuntoId}/segmentos/${segId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al quitar segmento del conjunto')
}

// Paredes
export type Pared = {
  id: number
  nombre: string | null
  color: string | null
  x1: number; y1: number; z1: number
  x2: number; y2: number; z2: number
  tabla_pared_id: number | null
}

export type CreateParedInput = Omit<Pared, 'id'>

export async function createPared(data: CreateParedInput): Promise<Pared> {
  const res = await fetch(`${API}/paredes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear pared')
  return res.json()
}

export async function updatePared(id: number, data: Partial<Omit<Pared, 'id'>>): Promise<Pared> {
  const res = await fetch(`${API}/paredes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar pared')
  return res.json()
}

export async function deletePared(id: number): Promise<void> {
  const res = await fetch(`${API}/paredes/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar pared')
}

// Tablas de paredes
export type TablaPared = {
  id: number
  nombre: string
  paredes: Pared[]
  conjuntos: { id: number }[]
}

export async function createTablaPared(nombre: string, proyecto_id: number): Promise<TablaPared> {
  const res = await fetch(`${API}/tabla_paredes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, proyecto_id }),
  })
  if (!res.ok) throw new Error('Error al crear tabla de paredes')
  return res.json()
}

export async function updateTablaPared(id: number, nombre: string): Promise<TablaPared> {
  const res = await fetch(`${API}/tabla_paredes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
  })
  if (!res.ok) throw new Error('Error al renombrar tabla de paredes')
  return res.json()
}

export async function deleteTablaPared(id: number): Promise<void> {
  const res = await fetch(`${API}/tabla_paredes/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar tabla de paredes')
}

export async function addTablaParedToConjunto(tablaParedId: number, conjuntoId: number): Promise<TablaPared> {
  const res = await fetch(`${API}/tabla_paredes/${tablaParedId}/conjuntos/${conjuntoId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al aplicar tabla al conjunto')
  return res.json()
}

export async function removeTablaParedFromConjunto(tablaParedId: number, conjuntoId: number): Promise<TablaPared> {
  const res = await fetch(`${API}/tabla_paredes/${tablaParedId}/conjuntos/${conjuntoId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al quitar tabla del conjunto')
  return res.json()
}
