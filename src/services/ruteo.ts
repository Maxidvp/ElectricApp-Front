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

export async function createConjunto(nombre: string): Promise<Conjunto> {
  const res = await fetch(`${API}/conjuntos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre }),
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

export async function addSegmentoToConjunto(segId: number, conjuntoId: number): Promise<void> {
  const res = await fetch(`${API}/conjuntos/${conjuntoId}/segmentos/${segId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al agregar segmento al conjunto')
}

export async function removeSegmentoFromConjunto(segId: number, conjuntoId: number): Promise<void> {
  const res = await fetch(`${API}/conjuntos/${conjuntoId}/segmentos/${segId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al quitar segmento del conjunto')
}
