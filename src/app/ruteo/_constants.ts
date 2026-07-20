import type { Segmento } from '@/services/ruteo'

export const GRID = 10
export const SNAP_EP_DIST = GRID * 1.5

// El item "activo" en la herramienta Asignar puede ser un Circuito (tableros
// POTENCIA), un LazoInstrumentacion (CONTROL) o un PuertoRed (DATOS) — los tres
// tienen su propia secuencia de IDs (podrían colisionar entre sí), por eso el
// tipo va siempre junto con el id.
export type ActiveTipo = 'circuito' | 'lazo' | 'puerto_red'
export type ActiveItem = { id: number; tipo: ActiveTipo } | null

export function segContieneItem(seg: Segmento, item: ActiveItem): boolean {
  if (!item) return false
  if (item.tipo === 'circuito')   return seg.circuitos.some(c => c.id === item.id)
  if (item.tipo === 'lazo')       return seg.lazos.some(l => l.id === item.id)
  return seg.puertos_red.some(p => p.id === item.id)
}

export const COLORS: Record<string, string> = {
  pared:   '#888780',
  bandeja: '#378ADD',
  canio:   '#E87C3A',
  punto:   '#47D5A6',
}

export const STROKE: Record<string, number> = {
  pared:   2,
  bandeja: 6,
  canio:   3,
  punto:   0,
}

export type ToolType = 'seleccionar' | 'asignar' | 'dividir' | 'medir' | 'pared' | 'canio' | 'bandeja' | 'punto' | 'vertical'

export const TOOLS: { id: ToolType; label: string; dot?: boolean }[] = [
  { id: 'seleccionar', label: 'Seleccionar' },
  { id: 'asignar',     label: 'Asignar'     },
  { id: 'dividir',     label: 'Dividir'     },
  { id: 'medir',       label: 'Medir'       },
  { id: 'pared',       label: 'Pared',    dot: true },
  { id: 'bandeja',     label: 'Bandeja',  dot: true },
  { id: 'canio',       label: 'Caño',     dot: true },
  { id: 'punto',       label: 'Punto',    dot: true },
  { id: 'vertical',    label: 'Vertical'            },
]

export function snap(v: number) { return Math.round(v / GRID) * GRID }

export function niceSpacing(worldPx: number): number {
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
  return steps.find(s => s >= worldPx) ?? 10000
}

export function formatM(cm: number): string {
  if (cm === 0) return '0'
  const m = cm / 100
  return m.toFixed(2).replace(/\.?0+$/, '') + 'm'
}
