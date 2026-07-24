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

export function replaceCirc(tableros: Tablero[], tempId: number, real: Circuito): Tablero[] {
  return tableros.map(t => ({ ...t, circuitos: t.circuitos.map(c => c.id === tempId ? real : c) }))
}

// Texto optimista mostrado en "Descripción" mientras una fila nueva todavía no fue
// confirmada por el back. Se trata como equivalente a null en mergeWithTemp: es un
// placeholder, no una edición real del usuario, así que no debe pisar la respuesta real.
export const DESCRIPCION_CREANDO = 'Creando…'

// Fusiona el circuito real del back con el estado actual del temp,
// preservando cualquier edición que el usuario haya hecho antes de que el back respondiera.
// El problema que resuelve: el usuario puede editar campos (FP, potencia, etc.) antes
// de que el POST inicial haya respondido con el ID real. Cuando ese ID llega, no queremos
// pisarle las ediciones — la respuesta del back contiene los valores por defecto, no los
// que el usuario ya cambió. Regla: el valor del temp gana siempre que no sea null (o el
// placeholder "Creando…", que tampoco cuenta como edición real).
export function mergeWithTemp(real: Circuito, temp: Circuito | undefined): Circuito {
  if (!temp) return real
  const tempDescripcion = temp.descripcion === DESCRIPCION_CREANDO ? null : temp.descripcion
  return {
    ...real,
    circuito:      temp.circuito,
    es_acometida: temp.es_acometida,
    descripcion:  tempDescripcion   !== null ? tempDescripcion  : real.descripcion,
    tipo:         temp.tipo         !== null ? temp.tipo         : real.tipo,
    FP:           temp.FP           !== null ? temp.FP           : real.FP,
    Largo:        temp.Largo        !== null ? temp.Largo        : real.Largo,
    potencia:     temp.potencia     !== null ? temp.potencia     : real.potencia,
    tipo_tension: temp.tipo_tension !== null ? temp.tipo_tension : real.tipo_tension,
    fase:         temp.fase         !== null ? temp.fase         : real.fase,
  }
}

// Extrae un Map deduplicado de segmentos a partir de los conjuntos cargados desde el back.
// Un segmento puede pertenecer a más de un conjunto; el back lo devuelve anidado en
// cada conjunto al que pertenece, por eso hay que deduplicar por id antes de exponer
// la lista plana de segmentos al resto de la app.
export function deriveSegmentos(conjuntos: (Conjunto & { segmentos?: Segmento[] })[]): Segmento[] {
  const map = new Map<number, Segmento>()
  for (const c of conjuntos) {
    for (const s of (c as any).segmentos ?? []) {
      if (!map.has(s.id)) map.set(s.id, s)
    }
  }
  return Array.from(map.values())
}
