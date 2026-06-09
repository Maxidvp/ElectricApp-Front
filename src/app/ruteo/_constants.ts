export const GRID = 10
export const SNAP_EP_DIST = GRID * 1.5

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

export type ToolType = 'seleccionar' | 'asignar' | 'dividir' | 'pared' | 'canio' | 'bandeja' | 'punto' | 'vertical'

export const TOOLS: { id: ToolType; label: string; dot?: boolean }[] = [
  { id: 'seleccionar', label: 'Seleccionar' },
  { id: 'asignar',     label: 'Asignar'     },
  { id: 'dividir',     label: 'Dividir'     },
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
