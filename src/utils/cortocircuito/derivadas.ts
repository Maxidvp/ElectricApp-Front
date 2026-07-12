// Corrientes derivadas — spec §8.

// §8.1 — Factor de cresta κ (Método B, el que la spec marca como default)
export function calcularKappa(rx: number, Un_falla_V: number): number {
  const kappaB = 1.15 * (1.02 + 0.98 * Math.exp(-3 * rx))
  const limite = Un_falla_V <= 1000 ? 1.8 : 2.0
  return Math.max(1.0, Math.min(kappaB, limite))
}

export function calcularIp(kappa: number, Ik_ini_A: number): number {
  return kappa * Math.SQRT2 * Ik_ini_A
}

export function calcularIdc(t_s: number, f_hz: number, rx: number, Ik_ini_A: number): number {
  return Math.SQRT2 * Ik_ini_A * Math.exp(-2 * Math.PI * f_hz * t_s * rx)
}

// §8.3 — Factor de decaimiento μ (corte). Puntos tabulados en t_min = 0.02/0.05/0.10/≥0.25 s,
// interpolación lineal entre tramos.
function muEnPunto(t: number, q: number): number {
  if (t <= 0.02) return 0.84 + 0.26 * Math.exp(-0.26 * q)
  if (t <= 0.05) return 0.71 + 0.51 * Math.exp(-0.30 * q)
  if (t <= 0.10) return 0.62 + 0.72 * Math.exp(-0.32 * q)
  return 0.56 + 0.94 * Math.exp(-0.38 * q)
}

const PUNTOS_T = [0.02, 0.05, 0.10, 0.25]

export function calcularMu(t_min_s: number, q: number): number {
  let mu: number
  if (t_min_s <= PUNTOS_T[0]) mu = muEnPunto(PUNTOS_T[0], q)
  else if (t_min_s >= PUNTOS_T[3]) mu = muEnPunto(PUNTOS_T[3], q)
  else {
    let i = 0
    while (i < PUNTOS_T.length - 1 && t_min_s > PUNTOS_T[i + 1]) i++
    const t0 = PUNTOS_T[i], t1 = PUNTOS_T[i + 1]
    const m0 = muEnPunto(t0, q), m1 = muEnPunto(t1, q)
    mu = m0 + (m1 - m0) * ((t_min_s - t0) / (t1 - t0))
  }
  return Math.min(1.0, mu)
}

// Factor de decaimiento q para motores asíncronos (mismo esquema de interpolación).
// m_por_par_polos = PrM / (pares_de_polos * 1e6), con PrM en W.
function qMotorEnPunto(t: number, m: number): number {
  if (t <= 0.02) return 1.03 + 0.12 * Math.log(m)
  if (t <= 0.05) return 0.79 + 0.12 * Math.log(m)
  if (t <= 0.10) return 0.57 + 0.12 * Math.log(m)
  return 0.26 + 0.10 * Math.log(m)
}

export function calcularQMotor(t_min_s: number, m_por_par_polos: number): number {
  const m = Math.max(m_por_par_polos, 1e-6) // ln indefinido para m<=0
  let q: number
  if (t_min_s <= PUNTOS_T[0]) q = qMotorEnPunto(PUNTOS_T[0], m)
  else if (t_min_s >= PUNTOS_T[3]) q = qMotorEnPunto(PUNTOS_T[3], m)
  else {
    let i = 0
    while (i < PUNTOS_T.length - 1 && t_min_s > PUNTOS_T[i + 1]) i++
    const t0 = PUNTOS_T[i], t1 = PUNTOS_T[i + 1]
    const q0 = qMotorEnPunto(t0, m), q1 = qMotorEnPunto(t1, m)
    q = q0 + (q1 - q0) * ((t_min_s - t0) / (t1 - t0))
  }
  return Math.min(1.0, q)
}

// §8.5 — Factor térmico m (efecto de la componente CC). Guarda numérica: si
// kappa está en/por debajo de 1, ln(kappa-1) no está definido → m=0 (spec §7/§12.1).
export function calcularM(kappa: number, f_hz: number, Tk_s: number): number {
  if (Tk_s <= 0) return 0
  const arg = kappa - 1
  if (arg <= 1e-6) return 0
  const lnArg = Math.log(arg)
  const denominador = 2 * f_hz * Tk_s * lnArg
  if (denominador === 0) return 0
  const numerador = Math.exp(4 * f_hz * Tk_s * lnArg) - 1
  return numerador / denominador
}

// §8.5 — Factor térmico n (efecto de la componente CA). Lejos de generador n=1.
// Cerca de generador la spec remite a curvas (fig. 22) que no están tabuladas en
// el documento: se usa n=1 igual, que es conservador (Ith no queda subestimado).
export function calcularN(_cercaDeGenerador: boolean): number {
  return 1
}
