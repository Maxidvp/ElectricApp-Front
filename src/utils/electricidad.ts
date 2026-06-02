// ── Tipos mínimos ──────────────────────────────────────────────────────────

export interface CableInfo {
  nombre: string
  diametro: number | null
}

export interface FormacionInfo {
  Nfases:       number
  cond_por_fase: number
  Nneutro:      number
  cable:        CableInfo
  cable_neutro: CableInfo | null
  cable_tierra: CableInfo | null
}

export interface CaidaInput {
  tension:  string  // V — tensión de fase (EFN mono, EFF tri/bi)
  fp:       string  // cos θ
  in_:      string  // A — corriente nominal
  cf:       string  // conductores por fase (override)
  l:        string  // m — longitud
  r:        string  // Ω/km — resistencia a 90°C
  x:        string  // Ω/km — reactancia
  cable_id: string  // id del cable seleccionado (override de sección)
}

// ── Formación ─────────────────────────────────────────────────────────────

/**
 * Genera la descripción de una formación de cables.
 * Ej: "3x(2x95mm²)+50mm²N+T(G)"
 */
export function generarFormacion(f: FormacionInfo): string {
  const partes: string[] = []

  const fase = f.cond_por_fase > 1
    ? `${f.Nfases}x(${f.cond_por_fase}x${f.cable.nombre})`
    : `${f.Nfases}x${f.cable.nombre}`
  partes.push(fase)

  if (f.cable_neutro && f.Nneutro > 0) {
    partes.push(f.Nneutro > 1
      ? `${f.Nneutro}x${f.cable_neutro.nombre}N`
      : `${f.cable_neutro.nombre}N`)
  }

  if (f.cable_tierra) {
    partes.push(`${f.cable_tierra.nombre}(G)`)
  }

  return partes.join('+')
}

// ── Reactancia inductiva ──────────────────────────────────────────────────

/**
 * Calcula la reactancia inductiva de secuencia positiva a 50 Hz [Ω/km].
 *
 * Fórmula base:  X = 2πf · (μ₀/2π) · ln(GMD/GMR) · 1000
 *              = 0.0628 · ln(GMD/GMR)   [Ω/km]
 *
 * GMR (radio medio geométrico del conductor):
 *   - Para calibre mm²: GMR = 0.77 · √(A/π)   (conductor trenzado)
 *   - Para AWG/kcmil o sin sección: GMR = 0.25 · d_cable  (estimación)
 *
 * GMD (distancia media geométrica) según disposición:
 *   unipolar  trefoil      → GMD = d                 (trébol compacto, cables tocando)
 *   unipolar  trefoil_sep  → GMD = 2·d               (trébol, 1 diámetro de separación)
 *   unipolar  plana        → GMD = ∛2 · d ≈ 1.26·d  (plana compacta)
 *   unipolar  plana_sep    → GMD = ∛2 · 2·d ≈ 2.52·d (plana separada)
 *   multipolar             → GMD = 2.5·√(A/π)        (geometría interna estimada)
 */
export function calcReactancia(
  diametro:   number | null,
  seccionF:   string | null,
  calibre:    string | null,
  disposicion: string | null,
  cableNfases: number,
): number | null {
  if (!diametro || diametro <= 0 || !disposicion) return null

  const d = diametro  // mm — diámetro exterior del cable

  // GMR del conductor
  let GMR: number
  if (calibre === 'mm²' && seccionF) {
    const A = parseFloat(seccionF)
    GMR = (!isNaN(A) && A > 0) ? 0.77 * Math.sqrt(A / Math.PI) : 0.25 * d
  } else {
    GMR = 0.25 * d
  }

  // GMD según disposición
  let GMD: number
  if (cableNfases === 1) {
    // Cables unipolares: la disposición la elige el instalador
    switch (disposicion) {
      case 'trefoil':     GMD = d;                         break
      case 'trefoil_sep': GMD = 2 * d;                    break
      case 'plana':       GMD = Math.cbrt(2) * d;         break
      case 'plana_sep':   GMD = Math.cbrt(2) * 2 * d;     break
      default: return null
    }
  } else {
    // Cable multipolar: geometría interna
    if (disposicion !== 'multipolar') return null
    if (calibre === 'mm²' && seccionF) {
      const A = parseFloat(seccionF)
      GMD = (!isNaN(A) && A > 0) ? 2.5 * Math.sqrt(A / Math.PI) : 0.35 * d
    } else {
      GMD = 0.35 * d
    }
  }

  if (GMD <= GMR) return null
  // X = 0.0628 · ln(GMD/GMR)  [Ω/km a 50 Hz]
  return 0.0628 * Math.log(GMD / GMR)
}

// ── Cortocircuito ─────────────────────────────────────────────────────────

/**
 * Corriente mínima de cortocircuito al final del circuito [A] (IEC 60364).
 * Considera una falla fase-neutro con ambos conductores de la misma sección.
 *
 *   Icc_min = (0.8 × U₀) / (2 × R_km × L/1000)
 *
 * U₀ = tensión fase-neutro, R_km = resistencia a temperatura máxima [Ω/km].
 * El factor 0.8 contempla variaciones de tensión y resistencia de arco.
 */
export function calcIccExtremo(
  U0:   number,   // V — tensión fase-neutro
  R_km: number,   // Ω/km — resistencia del conductor a temp. máxima
  L:    number,   // m — longitud del circuito
): number | null {
  if (!U0 || !R_km || !L || L <= 0) return null
  const R_loop = 2 * R_km * (L / 1000)  // Ω — lazo fase + neutro
  return (0.8 * U0) / R_loop
}

/**
 * Sección mínima del conductor para soportar la corriente de cortocircuito
 * durante el tiempo de despeje [mm²] (IEC 60364-5-54, fórmula adiabática).
 *
 *   S_mín = I_cc × √t / k
 *
 * Factores k:
 *   Cu / PVC (70 °C)  → 115
 *   Cu / XLPE (90 °C) → 143
 *   Al / PVC          → 74
 *   Al / XLPE         → 87
 */
export function calcSminCable(
  Icc_A:       number,         // A — corriente de CC
  t_s:         number,         // s — tiempo de despeje
  material?:   string | null,  // 'Cobre' | 'Aluminio'
  aislamiento?: string | null, // 'PVC' | 'XLPE' | 'EPR' | 'LSZH' …
): number | null {
  if (!Icc_A || Icc_A <= 0 || !t_s || t_s <= 0) return null
  const mat  = (material    ?? '').toLowerCase()
  const ais  = (aislamiento ?? '').toLowerCase()
  const isAlu  = mat.includes('alum') || mat === 'al'
  const isXLPE = ais.includes('xlpe') || ais.includes('epr')
  const k = isAlu ? (isXLPE ? 87 : 74) : (isXLPE ? 143 : 115)
  return (Icc_A * Math.sqrt(t_s)) / k
}

// ── Resistencia ───────────────────────────────────────────────────────────

// Tabla de conversión AWG → mm² (conductores de cobre, clase 2 IEC)
const AWG_MM2: Record<string, number> = {
  '14': 2.08,  '12': 3.31,  '10': 5.26,  '8': 8.37,   '6': 13.30,
  '4': 21.15,  '3': 26.67,  '2': 33.63,  '1': 42.41,
  '1/0': 53.49, '2/0': 67.43, '3/0': 85.01, '4/0': 107.2,
  '250': 126.7, '300': 152.0, '350': 177.4, '400': 202.7, '500': 253.4,
}

/**
 * Convierte la sección de un conductor a mm² sin importar el sistema de calibres.
 * Devuelve null si el calibre no es reconocido o la sección no es parseable.
 */
export function seccionEnMm2(seccionF: string | null, calibre: string | null): number | null {
  if (!seccionF) return null
  const cal = (calibre ?? '').toLowerCase().replace('²', '2').trim()
  if (cal === 'mm2') {
    const A = parseFloat(seccionF)
    return isNaN(A) || A <= 0 ? null : A
  }
  if (cal === 'awg') {
    return AWG_MM2[seccionF.trim()] ?? null
  }
  if (cal === 'kcmil') {
    const k = parseFloat(seccionF)
    return isNaN(k) || k <= 0 ? null : k * 0.5067
  }
  return null
}

/**
 * Calcula la resistencia del conductor a la temperatura de servicio [Ω/km].
 * Soporta mm² (IEC 60228 clase 2), AWG y kcmil.
 *
 * Resistividades base a 20 °C:
 *   Cobre    → ρ₂₀ = 18.34 Ω·mm²/km   α = 0.00393 /°C
 *   Aluminio → ρ₂₀ = 30.40 Ω·mm²/km   α = 0.00403 /°C
 *
 * Corrección: R(T) = (ρ₂₀ / A) × (1 + α × (T − 20))
 */
export function calcResistencia(
  seccionF:    string | null,
  calibre:     string | null,
  material?:   string | null,
  temperatura?: number | null,
): number | null {
  if (!seccionF) return null

  // Normalizar calibre: 'mm²', 'mm2', 'MM2', etc. → 'mm2'
  const cal = (calibre ?? '').toLowerCase().replace('²', '2').trim()

  let A: number
  if (cal === 'mm2') {
    A = parseFloat(seccionF)
    if (isNaN(A) || A <= 0) return null
  } else if (cal === 'awg') {
    const a = AWG_MM2[seccionF.trim()]
    if (!a) return null
    A = a
  } else if (cal === 'kcmil') {
    const k = parseFloat(seccionF)
    if (isNaN(k) || k <= 0) return null
    A = k * 0.5067  // 1 kcmil = 0.5067 mm²
  } else {
    return null
  }

  const mat = (material ?? '').toLowerCase()
  const isAlu = mat.includes('alum') || mat === 'al'
  const rho20 = isAlu ? 30.40 : 18.34
  const alpha = isAlu ? 0.00403 : 0.00393

  const T = temperatura ?? 90
  return (rho20 / A) * (1 + alpha * (T - 20))
}

// ── Corriente ─────────────────────────────────────────────────────────────

/**
 * Calcula la corriente nominal a partir de la potencia activa.
 *
 * Mono  : I = P / (V_FN × FP)
 * Bi    : I = P / (V_FF × FP)
 * Tri   : I = P / (√3 × V_FF × FP)
 */
export function calcCorriente(
  potencia_kW: number | null,
  tipo:        string | null,
  tension:     number | null,
  fp:          number | null,
): number | null {
  if (potencia_kW === null || !tipo || tension === null || tension <= 0 || !fp || fp <= 0) return null
  const p = potencia_kW * 1000
  const factor = tipo === 'tri' ? Math.sqrt(3) : 1
  return p / (factor * tension * fp)
}

// ── Área de ocupación ──────────────────────────────────────────────────────

/**
 * Calcula el área total de los conductores de una formación en mm².
 */
export function calcularAreaFormacion(f: FormacionInfo): number {
  const area = (d: number | null) => d !== null ? Math.PI * (d / 2) ** 2 : 0
  return (
    f.Nfases * f.cond_por_fase * area(f.cable.diametro) +
    f.Nneutro                  * area(f.cable_neutro?.diametro ?? null) +
                                 area(f.cable_tierra?.diametro ?? null)
  )
}

// ── Caída de tensión ───────────────────────────────────────────────────────

/**
 * Calcula la caída de tensión absoluta (V) y relativa (%).
 *
 * Monofásico 2h : e = 2 × (In/CF) × L × (R·cosφ + X·sinφ),  %e = e / EFN × 100
 * Trifásico     : e = √3 × (In/CF) × L × (R·cosφ + X·sinφ),  %e = e / EFF × 100
 * Bifásico 3h   : e = 2 × (In/CF) × L × (R·cosφ + X·sinφ),  %e = e / EFF × 100
 *
 * Los parámetros `fpAuto`, `largoAuto` y `tensionAuto` son valores guardados en la
 * base de datos que se usan cuando el campo manual correspondiente está vacío.
 */
export function calcDrops(
  input:       CaidaInput,
  nfases:      number,
  cfAuto:      number | null,
  fpAuto:      number | null,
  largoAuto:   number | null,
  tensionAuto: number | null,
  xAuto:       number | null = null,
  inAuto:      number | null = null,
  rAuto:       number | null = null,
): { ev: number | null; epct: number | null } {
  const fp  = parseFloat(input.fp)  || (fpAuto  ?? NaN)
  const in_ = parseFloat(input.in_) || (inAuto  ?? NaN)
  const cf  = parseFloat(input.cf)  || cfAuto   || NaN
  const l   = parseFloat(input.l)   || largoAuto || NaN
  const r   = parseFloat(input.r)   || (rAuto   ?? NaN)
  const x   = parseFloat(input.x)   || (xAuto   ?? NaN)

  if ([fp, in_, cf, l, r, x].some(isNaN) || cf <= 0) return { ev: null, epct: null }

  const cosφ   = Math.min(1, Math.max(0, fp))
  const sinφ   = Math.sqrt(Math.max(0, 1 - cosφ ** 2))
  const factor = nfases >= 3 ? Math.sqrt(3) : 2
  const ev     = factor * (in_ / cf) * l * (r * cosφ + x * sinφ)

  const tension = parseFloat(input.tension) || tensionAuto || NaN
  const epct    = !isNaN(tension) && tension > 0 ? (ev / tension) * 100 : null

  return { ev, epct }
}

// ── Ocupación de canalizaciones ────────────────────────────────────────────

type SegCircuito = { id: number }
type GetFormacion = (circId: number) => FormacionInfo | null | undefined

export function calcOcupacionCanio(
  dInterno: number,
  circuitos: SegCircuito[],
  getFormacion: GetFormacion,
): { areaOcupada: number; areaTotal: number; pct: number } {
  const areaTotal = Math.PI * (dInterno / 2) ** 2
  let areaOcupada = 0
  for (const sc of circuitos) {
    const f = getFormacion(sc.id)
    if (!f) continue
    if (f.cable.diametro)
      areaOcupada += f.Nfases * f.cond_por_fase * Math.PI * (f.cable.diametro / 2) ** 2
    if (f.Nneutro > 0 && f.cable_neutro?.diametro)
      areaOcupada += f.Nneutro * Math.PI * (f.cable_neutro.diametro / 2) ** 2
    if (f.cable_tierra?.diametro)
      areaOcupada += Math.PI * (f.cable_tierra.diametro / 2) ** 2
  }
  return { areaOcupada, areaTotal, pct: (areaOcupada / areaTotal) * 100 }
}

export function calcOcupacionBandeja(
  ancho: number,
  circuitos: SegCircuito[],
  getFormacion: GetFormacion,
): { anchoOcupado: number; anchoTotal: number; pct: number } {
  let anchoOcupado = 0
  for (const sc of circuitos) {
    const f = getFormacion(sc.id)
    if (!f) continue
    if (f.cable.diametro)
      anchoOcupado += f.Nfases * f.cond_por_fase * f.cable.diametro
    if (f.Nneutro > 0 && f.cable_neutro?.diametro)
      anchoOcupado += f.Nneutro * f.cable_neutro.diametro
    if (f.cable_tierra?.diametro)
      anchoOcupado += f.cable_tierra.diametro
  }
  return { anchoOcupado, anchoTotal: ancho, pct: (anchoOcupado / ancho) * 100 }
}
