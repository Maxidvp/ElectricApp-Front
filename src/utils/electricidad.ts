// ── Tipos mínimos ──────────────────────────────────────────────────────────

export interface CableInfo {
  nombre: string
  diametro: number | null
  Nfases?: number  // Nfases propio del CABLE (no de la formación) — >1 si el cable es multipolar
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
// Convierte "1x6 AWG" → "#6 AWG", "3x95 mm²" → "#95 mm²"
// El prefijo Nx del nombre indica el número de conductores del cable; lo quitamos
// porque en la formación el conteo real lo calculamos nosotros — pero solo para
// cables unipolares. En un cable multipolar (ej. "3x25+PE6") ese prefijo es parte
// del nombre real del producto, no una cuenta redundante, así que se conserva.
function cableBase(nombre: string, esMultipolar: boolean): string {
  return '#' + (esMultipolar ? nombre : nombre.replace(/^\d+x/, ''))
}

export type FormatoFormacion = 'ingles' | 'extendida' | 'copaipa' | 'resumida'

// Formato: 4C#10 AWG (3P-N)+1C#10 AWG (G)
// Si fase y neutro son del mismo cable se agrupan en un bloque con etiqueta (3P-N).
// La tierra siempre va por separado con etiqueta (G).
function generarFormacionIngles(f: FormacionInfo): string {
  const partes: string[] = []
  const nFaseCond = f.Nfases * f.cond_por_fase
  const mismoNombre = f.cable_neutro?.nombre === f.cable.nombre
  const faseEsMultipolar = (f.cable.Nfases ?? 1) > 1

  const pLabel = nFaseCond === 1 ? 'P' : `${nFaseCond}P`

  if (f.Nneutro > 0 && mismoNombre) {
    const nLabel = f.Nneutro === 1 ? 'N' : `${f.Nneutro}N`
    partes.push(`${nFaseCond + f.Nneutro}C${cableBase(f.cable.nombre, faseEsMultipolar)} (${pLabel}-${nLabel})`)
  } else {
    partes.push(`${nFaseCond}C${cableBase(f.cable.nombre, faseEsMultipolar)} (${pLabel})`)
    if (f.cable_neutro && f.Nneutro > 0) {
      const nLabel = f.Nneutro === 1 ? 'N' : `${f.Nneutro}N`
      partes.push(`${f.Nneutro}C${cableBase(f.cable_neutro.nombre, false)} (${nLabel})`)
    }
  }

  if (f.cable_tierra) {
    partes.push(`1C${cableBase(f.cable_tierra.nombre, false)} (G)`)
  }

  return partes.join('+')
}

export function generarFormacion(f: FormacionInfo, formato: FormatoFormacion = 'ingles'): string {
  switch (formato) {
    case 'ingles':    return generarFormacionIngles(f)
    case 'extendida': return 'A IMPLEMENTAR'
    case 'copaipa':   return 'A IMPLEMENTAR'
    case 'resumida':  return 'A IMPLEMENTAR'
  }
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
 *
 * Nota: GMD > GMR es necesario para que ln() sea positivo. Si GMD ≤ GMR
 * (caso degenerado por datos incorrectos) se retorna null.
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
 *
 * CF (conductores por fase): divide la corriente porque al poner N conductores
 * en paralelo cada uno conduce In/N amperes, reduciendo la caída proporcional.
 *
 * R y X están en Ω/km, L en metros → el término L/1000 convierte la longitud.
 * La fórmula es simplificada (ignora componente reactiva transversal) y es
 * exacta para cosφ cercanos a 1. Error < 0.5 % para cosφ > 0.7.
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
  const ev     = factor * (in_ / cf) * l /1000 * (r * cosφ + x * sinφ)

  const tension = parseFloat(input.tension) || tensionAuto || NaN
  const epct    = !isNaN(tension) && tension > 0 ? (ev / tension) * 100 : null
  return { ev, epct }
}

// ── Ocupación de canalizaciones ────────────────────────────────────────────

type SegCircuito = { id: number }
type GetFormacion = (circId: number) => FormacionInfo | null | undefined

// Lazos de instrumentación y puertos de red no tienen "formación": llevan un
// único cable simple (cable + cantidad_cables), no fase/neutro/tierra.
export interface CableSimpleInfo {
  cable: CableInfo | null
  cantidad_cables: number | null
}
type GetCableSimple = (id: number) => CableSimpleInfo | null | undefined

// Suma el área circular de todos los conductores (fase + neutro + tierra) de
// todos los circuitos asignados al caño, y la compara con el área interna del caño.
// NEC 2020 art. 40 fija el límite recomendado en 40% para 3+ conductores, pero
// en la práctica el proyecto usa 25% como umbral verde para facilitar tendido.
// cablesSimples cubre lazos/puertos_red: un mismo caño puede llevar cables de
// potencia, instrumentación y datos a la vez.
export function calcOcupacionCanio(
  dInterno: number,
  circuitos: SegCircuito[],
  getFormacion: GetFormacion,
  cablesSimples: SegCircuito[] = [],
  getCableSimple: GetCableSimple = () => null,
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
  for (const sc of cablesSimples) {
    const info = getCableSimple(sc.id)
    if (!info?.cable?.diametro) continue
    areaOcupada += (info.cantidad_cables ?? 1) * Math.PI * (info.cable.diametro / 2) ** 2
  }
  return { areaOcupada, areaTotal, pct: (areaOcupada / areaTotal) * 100 }
}

// Para bandejas se mide en ancho lineal, no en área: los cables se disponen
// en una sola capa sobre el fondo de la bandeja. Se suman los diámetros de
// todos los conductores de todos los circuitos. No aplica factor de empaque
// porque la norma asume tendido a una sola capa.
export function calcOcupacionBandeja(
  ancho: number,
  circuitos: SegCircuito[],
  getFormacion: GetFormacion,
  cablesSimples: SegCircuito[] = [],
  getCableSimple: GetCableSimple = () => null,
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
  for (const sc of cablesSimples) {
    const info = getCableSimple(sc.id)
    if (!info?.cable?.diametro) continue
    anchoOcupado += (info.cantidad_cables ?? 1) * info.cable.diametro
  }
  return { anchoOcupado, anchoTotal: ancho, pct: (anchoOcupado / ancho) * 100 }
}

// Bandeja: rojo >90% o <10%, amarillo >80% o <20%
// Caño:    rojo >35% o <5%,  amarillo >30% o <10%
export function colorOcupacion(pct: number, tipo: 'canio' | 'bandeja'): string {
  if (tipo === 'bandeja')
    return pct > 90 || pct < 10 ? 'var(--clr-danger-a10)'
      : pct > 80 || pct < 20   ? 'var(--clr-warning-a10)'
      : 'var(--clr-success-a10)'
  return pct > 35 || pct < 5  ? 'var(--clr-danger-a10)'
    : pct > 30 || pct < 10    ? 'var(--clr-warning-a10)'
    : 'var(--clr-success-a10)'
}

// ── Bancos de cañeros enterrados ────────────────────────────────────────────

/**
 * Tapada mínima [m] sugerida según nivel de tensión (AEA 90364 / IEC 60364-5-52),
 * medida desde el nivel de suelo hasta la parte más alta del caño. Es un
 * requisito de protección mecánica (evitar daño por excavación/tránsito), no
 * un cálculo térmico — por eso es un valor de tabla, no una fórmula. Editable
 * a mano si el proyecto exige otra cosa.
 */
export function tapadaSugerida(nivel: 'BT' | 'MT'): number {
  return nivel === 'MT' ? 1.0 : 0.5
}

// Espaciamientos típicos entre extremos más próximos (espacio libre, no entre
// ejes/centros) de caños enterrados [m] — IEC 60364-5-52 Anexo B (tabla
// B.52.17): a mayor separación, menor interacción térmica entre caños y menor
// derating por agrupamiento de la corriente admisible.
export const ESPACIAMIENTOS_TIPICOS_M = [0.125, 0.25, 0.5, 1.0]

// Recubrimiento mínimo de hormigón alrededor de la grilla de caños [m], para
// un caniero hormigonado (encofrado) en vez de enterrado directo en tierra —
// valor típico de práctica de diseño de duct banks (IEEE/NEMA, ~75 mm / 3").
// Editable: normas locales o el propio proyecto pueden pedir más.
export const RECUBRIMIENTO_HORMIGON_M = 0.075

// ── Ampacidad — factores de corrección FC/FT ───────────────────────────────

/**
 * Factor de corrección por temperatura ambiente (IEC 60364-5-52 Tabla B.52.14).
 * A diferencia de FC (agrupamiento), este factor SÍ tiene una fórmula analítica
 * cerrada — la tabla de la norma es justamente esta fórmula tabulada para
 * valores redondos de temperatura, así que se calcula en vez de copiarse:
 *
 *   FT = √((θmax − θamb) / (θmax − θref))
 *
 * θmax  = temperatura máxima de servicio del cable (FamiliaCable.temperatura:
 *         70 °C PVC, 90 °C XLPE/EPR, etc.)
 * θref  = temperatura de referencia de la tabla: 30 °C para instalaciones al
 *         aire, 20 °C para enterradas (según Anexo B).
 * θamb  = temperatura ambiente real del sitio.
 *
 * Devuelve null si falta algún dato o si la temperatura ambiente alcanza o
 * supera θmax (el cable no es apto a esa temperatura, no hay factor que valga).
 */
export function calcFT(
  tempAmbiente: number | null,
  tempMaxCable: number | null,
  metodo: string | null,
): number | null {
  if (tempAmbiente === null || tempMaxCable === null) return null
  const tempRef = metodo === 'enterrado' ? 20 : 30
  const denom = tempMaxCable - tempRef
  const numer = tempMaxCable - tempAmbiente
  if (denom <= 0 || numer <= 0) return null
  return Math.sqrt(numer / denom)
}

// Factor de corrección por agrupamiento (IEC 60364-5-52 Tabla B.52.17 —
// circuitos al aire/canalizados — y Tabla B.52.20 — circuitos enterrados).
// A diferencia de FT, acá no hay fórmula: son valores empíricos de interacción
// térmica entre conductores agrupados, tabulados por la norma. Los valores de
// "enterrado" asumen cables tocándose (el caso más desfavorable/conservador,
// ya que hoy no se cruza con el espaciamiento real del Caniero) — si el
// proyecto tiene datos más precisos, usar el override manual de FC.
//
// Cada tabla es [nMáximo, factor][]: se toma la primera entrada cuyo nMáximo
// sea ≥ n; para n mayores al máximo tabulado se usa el último factor (la
// norma no define más reducción más allá de ese punto, o el dato no está
// tabulado y este es el valor más conservador disponible).
const FC_BUNCHED: [number, number][] =    [[1, 1.00], [2, 0.80], [3, 0.70], [4, 0.65], [5, 0.60], [6, 0.57], [7, 0.54], [8, 0.52], [9, 0.50], [12, 0.45], [16, 0.41], [20, 0.38]]
const FC_BANDEJA_PERF: [number, number][] = [[1, 1.00], [2, 0.85], [3, 0.79], [4, 0.75], [5, 0.73], [6, 0.72], [7, 0.72], [8, 0.71], [9, 0.70]]
const FC_BANDEJA_ESC: [number, number][] =  [[1, 1.00], [2, 0.94], [3, 0.89], [4, 0.88], [5, 0.87], [6, 0.87], [7, 0.86], [8, 0.86], [9, 0.85]]
const FC_ENTERRADO: [number, number][] =    [[1, 1.00], [2, 0.75], [3, 0.65], [4, 0.60], [5, 0.55], [6, 0.50]]

function lookupFC(tabla: [number, number][], n: number): number {
  for (const [nMax, factor] of tabla) if (n <= nMax) return factor
  return tabla[tabla.length - 1][1]
}

export function calcFC(metodo: string | null, nAgrupados: number | null): number | null {
  if (!metodo || nAgrupados === null || nAgrupados < 1) return null
  switch (metodo) {
    case 'conduit_emb':
    case 'conduit_sup':  return lookupFC(FC_BUNCHED, nAgrupados)
    case 'bandeja_perf': return lookupFC(FC_BANDEJA_PERF, nAgrupados)
    case 'bandeja_esc':
    case 'aire_libre':   return lookupFC(FC_BANDEJA_ESC, nAgrupados)
    case 'enterrado':    return lookupFC(FC_ENTERRADO, nAgrupados)
    default: return null
  }
}

type SegCircAgrup = { tipo: string; circuitos: { id: number }[] }

/**
 * N° de circuitos agrupados para un circuito dado: el máximo de circuitos que
 * comparten con él algún segmento físico (caño/bandeja) de su recorrido — se
 * toma el máximo y no el promedio porque el tramo más cargado del recorrido
 * es el que manda térmicamente. `null` si el circuito todavía no está ruteado
 * (sin segmentos asignados), para no sugerir un FC optimista sin base real.
 */
export function contarAgrupamiento(circuitoId: number, segmentos: SegCircAgrup[]): number | null {
  const propios = segmentos.filter(s =>
    (s.tipo === 'canio' || s.tipo === 'bandeja') && s.circuitos.some(c => c.id === circuitoId)
  )
  if (propios.length === 0) return null
  return Math.max(...propios.map(s => s.circuitos.length))
}
