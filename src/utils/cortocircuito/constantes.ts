// Constantes y tablas normalizadas — spec §3.

export type Escenario = 'MAXIMO' | 'MINIMO'
export type Material = 'COBRE' | 'ALUMINIO'

// §3.1 — Factor de tensión c (IEC 60909-0, Tabla 1)
export function obtenerC(Un_volts: number, escenario: Escenario, bt_tolerancia_10pct = false): number {
  if (Un_volts <= 1000) {
    if (escenario === 'MAXIMO') return bt_tolerancia_10pct ? 1.10 : 1.05
    return 0.95
  }
  return escenario === 'MAXIMO' ? 1.10 : 1.00
}

// §3.2 — Resistividad (Ω·mm²/m) y coeficiente térmico (1/K) a 20 °C
export const RHO_20: Record<Material, number> = { COBRE: 0.017241, ALUMINIO: 0.028264 }
export const ALPHA: Record<Material, number> = { COBRE: 0.00393, ALUMINIO: 0.00403 }

export function rhoATemperatura(material: Material, theta: number): number {
  return RHO_20[material] * (1 + ALPHA[material] * (theta - 20))
}

// §3.3 — Reactancia unitaria por defecto (Ω/m)
export const X_UNITARIA_DEFAULT = {
  CABLE_BT_MULTIPOLAR: 8.0e-5,
  CABLE_BT_UNIPOLAR_JUNTOS: 9.0e-5,
  CABLE_BT_UNIPOLAR_SEPARADOS: 1.3e-4,
  CABLE_MT: 1.0e-4,
  LINEA_AEREA: 3.0e-4,
  BARRA: 1.5e-4,
}

// §3.4 — Relación Z0/Z1 por defecto en transformadores, según grupo de conexión.
// Si no hay dato de grupo, se asume Z0/Z1 = 1 (Z0 = Z1) y se advierte — la spec
// no da un valor por defecto para el caso "sin grupo conocido".
export function z0z1DefaultPorGrupo(grupo?: string | null): { valor: number; advertencia?: string } {
  if (!grupo) return { valor: 1, advertencia: 'Z0/Z1 no provisto y sin grupo de conexión: se asumió Z0=Z1' }
  const g = grupo.toUpperCase()
  if (g.startsWith('DYN')) return { valor: 0.95 }
  if (g.startsWith('YYN')) return { valor: 12 }
  if (g.startsWith('YZN')) return { valor: 0.10 }
  if (g.startsWith('YND')) return { valor: 0.90 }
  return { valor: 1, advertencia: `Grupo de conexión "${grupo}" no reconocido: se asumió Z0=Z1` }
}

// §3.5 — Relación R/X por defecto
export const RX_DEFAULT = {
  RED: 0.10,
  MOTOR_MT_GE_1MW_POR_POLO: 0.10,
  MOTOR_MT_LT_1MW_POR_POLO: 0.15,
  MOTOR_BT: 0.42,
}

// §8.5 — Constante K del material/aislación para sección mínima adiabática
export const K_MATERIAL: Record<string, number> = {
  'COBRE/PVC': 115,
  'COBRE/XLPE': 143,
  'COBRE/EPR': 143,
  'ALUMINIO/PVC': 76,
  'ALUMINIO/XLPE': 94,
  'ALUMINIO/EPR': 94,
}
