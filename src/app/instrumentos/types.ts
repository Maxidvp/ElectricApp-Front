export const TIPOS_SENAL = [
  { value: 'AI', label: 'AI — Entrada analógica' },
  { value: 'AO', label: 'AO — Salida analógica' },
  { value: 'DI', label: 'DI — Entrada digital' },
  { value: 'DO', label: 'DO — Salida digital' },
] as const

export type ColMeta = { colType: 'editable' | 'display' }
