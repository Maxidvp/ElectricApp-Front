// Fórmulas de impedancia por elemento — spec §5.
// Cada función devuelve Z1 (y Z0 cuando aplica) tal como quedan en la base propia
// del elemento (ver comentarios de "nivel"); referir esa impedancia al nivel de
// tensión de la falla es responsabilidad de quien arma el grafo (red.ts).
import { C, type Complex } from './complex'
import {
  obtenerC, RHO_20, ALPHA, X_UNITARIA_DEFAULT, z0z1DefaultPorGrupo, RX_DEFAULT,
  type Escenario, type Material,
} from './constantes'
import type { NetworkFeeder, Transformer, SyncGenerator, Conductor, AsyncMotor } from './tipos'

export type ImpedanciaElemento = { Z1: Complex; Z0: Complex; nivel: number; advertencias: string[] }

// §5.1 — Red de alimentación
//
// Nota de implementación: la spec escribe "c_Q = obtener_c(Un_Q, escenario)" usando
// la tensión propia de la red. Pero Z_referida_a_la_falla = Z_Q(a Un_Q) * (Un_falla/Un_Q)^2
// = c_Q * Un_Q^2/S"kQ * (Un_falla/Un_Q)^2 = c_Q * Un_falla^2/S"kQ — el Un_Q se cancela
// algebraicamente. El caso de prueba §11.1 (Z_Q ref. 400V ≈ 3.36e-4 Ω) solo reproduce
// evaluando c al nivel de la FALLA (400V → c=1.05), no al nivel propio de la red
// (20kV → c=1.10, que da 3.52e-4 Ω). Se implementa entonces evaluando c directamente
// a Un_falla, ya referido — es la interpretación consistente con el propio test de la norma.
export function impedanciaRed(
  red: NetworkFeeder, escenario: Escenario, Un_falla: number, btTolerancia10 = false,
): ImpedanciaElemento {
  const advertencias: string[] = []
  const c = obtenerC(Un_falla, escenario, btTolerancia10)

  let S_kQ: number
  if (red.potencia_cc != null) {
    S_kQ = red.potencia_cc
  } else if (red.corriente_cc != null) {
    S_kQ = Math.sqrt(3) * red.tension_nominal * red.corriente_cc
  } else {
    throw new Error(`Red "${red.id}": falta potencia_cc o corriente_cc`)
  }
  if (S_kQ <= 0) throw new Error(`Red "${red.id}": S"kQ debe ser mayor a cero`)

  const Z_Q = (c * Un_falla ** 2) / S_kQ // ya referido al nivel de la falla
  let rx = red.relacion_rx
  if (rx == null) { rx = RX_DEFAULT.RED; advertencias.push(`Red "${red.id}": R/X no provisto, se usó ${RX_DEFAULT.RED}`) }

  const X_Q = Z_Q / Math.sqrt(1 + rx ** 2)
  const R_Q = rx * X_Q
  const Z1 = C.of(R_Q, X_Q)

  // La spec no da una fórmula de Z0 para la red — se aproxima Z0=Z1 (simplificación documentada).
  advertencias.push(`Red "${red.id}": Z0 no especificado por la norma para la red, se aproximó Z0=Z1`)
  return { Z1, Z0: Z1, nivel: Un_falla, advertencias }
}

// §5.2 — Transformador (incluye factor de corrección K_T)
export function impedanciaTransformador(
  t: Transformer, btTolerancia10 = false,
): ImpedanciaElemento {
  const advertencias: string[] = []
  const Z_T = (t.ukr_porcentaje / 100) * (t.tension_secundaria ** 2 / t.potencia_nominal)

  let R_T: number
  if (t.perdidas_cobre != null) {
    R_T = (t.perdidas_cobre * t.tension_secundaria ** 2) / t.potencia_nominal ** 2
  } else if (t.uRr_porcentaje != null) {
    R_T = (t.uRr_porcentaje / 100) * (t.tension_secundaria ** 2 / t.potencia_nominal)
  } else {
    throw new Error(`Transformador "${t.id}": falta perdidas_cobre o uRr_porcentaje`)
  }
  if (R_T >= Z_T) throw new Error(`Transformador "${t.id}": uRr >= ukr, datos inconsistentes (R_T > Z_T)`)
  const X_T = Math.sqrt(Z_T ** 2 - R_T ** 2)

  const x_T = X_T / (t.tension_secundaria ** 2 / t.potencia_nominal)
  const c_max = obtenerC(t.tension_secundaria, 'MAXIMO', btTolerancia10)
  const K_T = (0.95 * c_max) / (1 + 0.6 * x_T)
  const Z1 = C.mulR(C.of(R_T, X_T), K_T)

  let ratioZ0: number
  if (t.impedancia_homopolar_ratio != null) {
    ratioZ0 = t.impedancia_homopolar_ratio
  } else {
    const d = z0z1DefaultPorGrupo(t.grupo_conexion)
    ratioZ0 = d.valor
    if (d.advertencia) advertencias.push(`Transformador "${t.id}": ${d.advertencia}`)
  }
  const Z0 = C.mulR(Z1, ratioZ0)

  return { Z1, Z0, nivel: t.tension_secundaria, advertencias }
}

// §5.3 — Conductor / cable / línea
export function impedanciaConductor(cnd: Conductor, escenario: Escenario): ImpedanciaElemento {
  const advertencias: string[] = []
  const n = cnd.n_conductores_por_fase ?? 1

  // Corrección térmica: 20 °C para Ik_max, temperatura de servicio para Ik_min
  const theta = escenario === 'MINIMO' ? (cnd.temperatura_servicio ?? 20) : 20
  const rho_theta = RHO_20[cnd.material] * (1 + ALPHA[cnd.material] * (theta - 20))

  const R_L = (rho_theta * cnd.longitud) / (cnd.seccion * n)

  let xUnit = cnd.reactancia_unitaria
  if (xUnit == null) {
    xUnit = X_UNITARIA_DEFAULT.CABLE_BT_MULTIPOLAR
    advertencias.push(`Conductor "${cnd.id}": reactancia_unitaria no provista, se usó ${xUnit} Ω/m (cable BT multipolar)`)
  }
  const X_L = (xUnit * cnd.longitud) / n
  const Z1 = C.of(R_L, X_L)

  advertencias.push(`Conductor "${cnd.id}": Z0 no especificado por la norma para conductores, se aproximó Z0=Z1`)
  return { Z1, Z0: Z1, nivel: NaN, advertencias } // nivel: un conductor no cambia de nivel, se toma el del nodo
}

// §5.4 — Generador síncrono (incluye factor de corrección K_G, ya referido a Un_falla)
export function impedanciaGenerador(
  g: SyncGenerator, Un_falla: number, btTolerancia10 = false,
): { Z1: Complex; advertencias: string[] } {
  const advertencias: string[] = []
  const Z_G = (g.xd_subtransitoria_pct / 100) * (g.tension_nominal ** 2 / g.potencia_nominal)

  let rg = g.rg_sobre_xd
  if (rg == null) {
    if (g.tension_nominal > 1000 && g.potencia_nominal >= 100e6) rg = 0.05
    else if (g.tension_nominal > 1000) rg = 0.07
    else rg = 0.15
    advertencias.push(`Generador "${g.id}": R/X"d no provisto, se usó ${rg}`)
  }
  const X_G = Z_G / Math.sqrt(1 + rg ** 2)
  const R_G = rg * X_G

  const sin_phi = Math.sqrt(Math.max(0, 1 - g.factor_potencia ** 2))
  const xd_pu = g.xd_subtransitoria_pct / 100
  const c_max = obtenerC(Un_falla, 'MAXIMO', btTolerancia10)
  const K_G = ((Un_falla / g.tension_nominal) * c_max) / (1 + xd_pu * sin_phi)

  // Z_G_corregida ya queda expresada al nivel de Un_falla (el factor Un_falla/UrG
  // está incluido en K_G) — no se le debe aplicar además la conversión genérica
  // de nivel que se usa para el resto de los elementos.
  const Z1 = C.mulR(C.of(R_G, X_G), K_G)
  advertencias.push(`Generador "${g.id}": Z0 no especificado por la norma, se omite del cálculo de fallas a tierra en este nodo`)
  return { Z1, advertencias }
}

// §5.5 — Motor asíncrono
export function impedanciaMotor(m: AsyncMotor): { Z1: Complex; advertencias: string[] } {
  const advertencias: string[] = []
  const Z_M = (1 / m.ilr_sobre_ir) * (m.tension_nominal ** 2 / m.potencia_nominal)

  let rx: number
  if (m.tension_nominal <= 1000) {
    rx = RX_DEFAULT.MOTOR_BT
  } else if (m.pares_de_polos != null) {
    const mPorPolo = m.potencia_nominal / 1e6 / m.pares_de_polos
    rx = mPorPolo >= 1 ? RX_DEFAULT.MOTOR_MT_GE_1MW_POR_POLO : RX_DEFAULT.MOTOR_MT_LT_1MW_POR_POLO
  } else {
    rx = RX_DEFAULT.MOTOR_MT_GE_1MW_POR_POLO
    advertencias.push(`Motor "${m.id}": pares_de_polos no provisto, se usó R/X=${rx} (MT ≥ 1MW/polo)`)
  }
  const X_M = Z_M / Math.sqrt(1 + rx ** 2)
  const R_M = rx * X_M
  const n = m.n_motores_equivalentes ?? 1
  const Z1 = C.divR(C.of(R_M, X_M), n)

  return { Z1, advertencias }
}

// Corriente nominal del motor — se usa en el criterio de inclusión (§5.6) y en
// las fórmulas de decaimiento de Ib (§8.3).
export function corrienteNominalMotor(m: AsyncMotor): number {
  return (m.potencia_nominal / (Math.sqrt(3) * m.tension_nominal)) * (m.n_motores_equivalentes ?? 1)
}

export function corrienteNominalGenerador(g: SyncGenerator): number {
  return g.potencia_nominal / (Math.sqrt(3) * g.tension_nominal)
}
