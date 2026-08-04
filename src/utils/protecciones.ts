import type { Proteccion } from '@/context/types'

export const TIPOS_PROTECCION = [
  { value: 'termomagnetico', label: 'Interruptor termomagnético' },
  { value: 'caja_moldeada',  label: 'Interruptor en caja moldeada' },
  { value: 'diferencial',    label: 'Diferencial' },
  { value: 'guardamotor',    label: 'Guardamotor' },
]

export const CURVAS = ['B', 'C', 'D', 'K', 'Z']

// Multiplicador [mín, máx] de In para el umbral de disparo magnético — IEC 60898/60947.
export const CURVA_MULTIPLICADOR: Record<string, [number, number]> = {
  B: [3, 5], C: [5, 10], D: [10, 20], K: [8, 14], Z: [2, 3],
}

// Etiqueta de la variante sola (polos/In/curva, o sensibilidad/clase, o rango) — sin
// marca/modelo, para usar dentro de la tabla de variantes de una familia ya conocida.
export function varianteLabel(p: Proteccion, tipo: string): string {
  const partes: string[] = []
  if (p.polos != null) partes.push(`${p.polos}P`)
  if (tipo === 'guardamotor') {
    if (p.rango_regulacion_min != null && p.rango_regulacion_max != null)
      partes.push(`${p.rango_regulacion_min}-${p.rango_regulacion_max}A`)
  } else {
    if (p.In != null) partes.push(`${p.In}A`)
    if (tipo === 'diferencial') {
      if (p.sensibilidad_mA != null) partes.push(`${p.sensibilidad_mA}mA`)
      if (p.clase_diferencial) partes.push(p.clase_diferencial)
    } else if (p.curva) {
      partes.push(`curva ${p.curva}`)
    }
  }
  return partes.join(' · ') || `Variante #${p.id}`
}

// Etiqueta completa (marca + modelo + variante) — para mostrar una protección ya
// asignada a un circuito, sin tener a mano el resto de su familia.
export function proteccionLabel(p: Proteccion): string {
  const partes: string[] = []
  if (p.familia?.marca) partes.push(p.familia.marca)
  if (p.familia?.modelo) partes.push(p.familia.modelo)
  const variante = varianteLabel(p, p.familia?.tipo ?? '')
  if (variante && !variante.startsWith('Variante #')) partes.push(variante)
  return partes.join(' · ') || `Protección #${p.id}`
}
