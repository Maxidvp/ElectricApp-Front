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
  tension: string  // V — tensión de fase (EFN mono, EFF tri/bi)
  fp:      string  // cos θ
  in_:     string  // A — corriente nominal
  cf:      string  // conductores por fase (override)
  l:       string  // m — longitud
  r:       string  // Ω/km — resistencia a 90°C
  x:       string  // Ω/km — reactancia
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
  fpAuto:      number,
  largoAuto:   number | null,
  tensionAuto: number | null,
): { ev: number | null; epct: number | null } {
  const fp  = parseFloat(input.fp)  || fpAuto
  const in_ = parseFloat(input.in_)
  const cf  = parseFloat(input.cf)  || cfAuto || NaN
  const l   = parseFloat(input.l)   || largoAuto || NaN
  const r   = parseFloat(input.r)
  const x   = parseFloat(input.x)

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
