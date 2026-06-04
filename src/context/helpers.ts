import type { Tablero, Circuito } from './types'
import type { Segmento, Conjunto } from '@/services/ruteo'

// ── Temp ID generator ─────────────────────────────────────────────
// IDs negativos decrecientes para diferenciar circuitos/segmentos pendientes de confirmación del back.
let _tempId = -1
export const nextTempId = () => _tempId--

// ── Immutable helpers para tableros/circuitos ──────────────────────

export function mapCirc(tableros: Tablero[], circId: number, fn: (c: Circuito) => Circuito): Tablero[] {
  return tableros.map(t => ({ ...t, circuitos: t.circuitos.map(c => c.id === circId ? fn(c) : c) }))
}

export function addCirc(tableros: Tablero[], tableroId: number, circ: Circuito): Tablero[] {
  return tableros.map(t => t.id === tableroId ? { ...t, circuitos: [...t.circuitos, circ] } : t)
}

export function removeCirc(tableros: Tablero[], circId: number): Tablero[] {
  return tableros.map(t => ({ ...t, circuitos: t.circuitos.filter(c => c.id !== circId) }))
}

export function replaceCirc(tableros: Tablero[], tempId: number, real: Circuito): Tablero[] {
  return tableros.map(t => ({ ...t, circuitos: t.circuitos.map(c => c.id === tempId ? real : c) }))
}

// Fusiona el circuito real del back con el estado actual del temp,
// preservando cualquier edición que el usuario haya hecho antes de que el back respondiera.
export function mergeWithTemp(real: Circuito, temp: Circuito | undefined): Circuito {
  if (!temp) return real
  return {
    ...real,
    circuito:     temp.circuito,
    descripcion:  temp.descripcion  !== null ? temp.descripcion  : real.descripcion,
    tipo:         temp.tipo         !== null ? temp.tipo         : real.tipo,
    FP:           temp.FP           !== null ? temp.FP           : real.FP,
    Largo:        temp.Largo        !== null ? temp.Largo        : real.Largo,
    potencia:     temp.potencia     !== null ? temp.potencia     : real.potencia,
    tipo_tension: temp.tipo_tension !== null ? temp.tipo_tension : real.tipo_tension,
    fase:         temp.fase         !== null ? temp.fase         : real.fase,
  }
}

// Extrae un Map deduplicado de segmentos a partir de los conjuntos cargados desde el back.
export function deriveSegmentos(conjuntos: (Conjunto & { segmentos?: Segmento[] })[]): Segmento[] {
  const map = new Map<number, Segmento>()
  for (const c of conjuntos) {
    for (const s of (c as any).segmentos ?? []) {
      if (!map.has(s.id)) map.set(s.id, s)
    }
  }
  return Array.from(map.values())
}
