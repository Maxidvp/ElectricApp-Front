// Carga EFECTIVA de un circuito (potencia, FP, tensión, corriente de diseño).
// Fuente única para Cargas, Ampacidad y Caídas: antes cada página la resolvía por
// su cuenta y solo Cargas contemplaba acometidas y alimentadores vinculados, así
// que justo esos circuitos (los más cargados) quedaban sin verificar en las otras dos.
import { calcCorriente } from '@/utils/electricidad'

export type Tensiones = { mono: number | null; bi: number | null; tri: number | null }

// Forma mínima de circuito/tablero que necesita este módulo — la cumplen tanto los
// tipos del context (Circuito/Tablero) como CircuitoAPI de la página de Cargas.
export type CircuitoCarga = {
  tipo: string | null
  potencia: number | null
  FP: number | null
  tipo_tension: string | null
  fase: string | null
  es_acometida: boolean
  tablero_destino_id: number | null
  // Para un ALIMENTADOR que llega a una acometida concreta del destino (ver resolverAlimentador)
  acometida_destino_id?: number | null
  id?: number
  circuito?: string
  orden?: number
  parent_id?: number | null
}

export type TableroCarga = {
  id: number
  categoria: string | null
  potencia_inst: number | null
  factor_potencia: number | null
  tension_mono: number | null
  tension_bi: number | null
  tension_tri: number | null
  circuitos: CircuitoCarga[]
}

// Circuito ya resuelto — con la potencia/FP EFECTIVA. Para un circuito común
// coincide con sus propios campos, pero para un ALIMENTADOR vinculado la potencia
// cruda (c.potencia) siempre es null en la DB: no se carga a mano, se toma del
// tablero destino.
export type CircuitoResuelto = {
  potencia: number | null
  FP: number | null
  tipo_tension: string | null
  fase: string | null
  es_acometida: boolean
}

export type CargaCircuito = {
  potencia: number | null     // kW
  fp: number | null
  tipo: string | null         // 'mono' | 'bi' | 'tri' — tipo de tensión efectivo
  tension: number | null      // V — la que corresponde a `tipo` en el tablero
  corriente: number | null    // A — corriente de diseño
  corrientesFase: { R: number; S: number; T: number } | null  // solo acometida
}

export const tensionesDe = (t: { tension_mono: number | null; tension_bi: number | null; tension_tri: number | null }): Tensiones =>
  ({ mono: t.tension_mono, bi: t.tension_bi, tri: t.tension_tri })

// Tipo de tensión "del tablero": el mayor disponible (tri > bi > mono).
export const tipoTensionTablero = (t: Tensiones): string | null =>
  t.tri != null ? 'tri' : t.bi != null ? 'bi' : t.mono != null ? 'mono' : null

const tensionDeTipo = (tipo: string | null, t: Tensiones): number | null =>
  tipo === 'mono' ? t.mono : tipo === 'bi' ? t.bi : tipo === 'tri' ? t.tri : null

// Tipo de tensión de un circuito común: el propio, o el único que tiene el tablero.
// Si el tablero tiene más de uno y el circuito no eligió, queda null (y la
// corriente también): no se adivina.
function tipoEfectivoCircuito(c: CircuitoCarga, t: Tensiones): string | null {
  if (c.tipo_tension) return c.tipo_tension
  const disponibles = (['mono', 'bi', 'tri'] as const).filter(k => t[k] != null)
  return disponibles.length === 1 ? disponibles[0] : null
}

// Versión de calcCorriente que retorna 0 (no null) para poder acumular corrientes
// por fase sin chequear nulos en cada iteración.
function corrienteFase(potencia_kW: number | null, fp: number | null, tension: number | null, factor: number): number {
  if (!potencia_kW || !fp || fp <= 0 || !tension || tension <= 0) return 0
  return (potencia_kW * 1000) / (factor * tension * fp)
}

// Acumula la corriente por fase (R, S, T) de los circuitos que alimenta una
// acometida, para mostrar el desbalance entre fases.
// Trifásicos: suman igual en las tres fases (I = P / √3·V·FP). Bifásicos: en los
// dos conductores de su asignación. Monofásicos: solo en la fase asignada.
// Retorna null si ningún circuito tiene datos suficientes (evita mostrar 0/0/0).
export function calcCorrientesPorFase(above: CircuitoResuelto[], tensiones: Tensiones): { R: number; S: number; T: number } | null {
  const disponibles = (['mono', 'bi', 'tri'] as const).filter(k => tensiones[k] != null)
  let R = 0, S = 0, T = 0

  for (const c of above) {
    const tipo = c.tipo_tension ?? (disponibles.length === 1 ? disponibles[0] : null)
    if (tipo === 'mono') {
      const i = corrienteFase(c.potencia, c.FP, tensiones.mono, 1)
      if (c.fase === 'R') R += i
      else if (c.fase === 'S') S += i
      else if (c.fase === 'T') T += i
    } else if (tipo === 'bi') {
      const i = corrienteFase(c.potencia, c.FP, tensiones.bi, 1)
      if (c.fase === 'RS') { R += i; S += i }
      else if (c.fase === 'ST') { S += i; T += i }
      else if (c.fase === 'TR') { T += i; R += i }
    } else if (tipo === 'tri') {
      const i = corrienteFase(c.potencia, c.FP, tensiones.tri, Math.sqrt(3))
      R += i; S += i; T += i
    }
  }

  return R === 0 && S === 0 && T === 0 ? null : { R, S, T }
}

// Suma la potencia y el FP ponderado por potencia de los circuitos que alimenta
// una acometida: FP_equiv = Σ(FPᵢ · Pᵢ) / ΣPᵢ.
export function calcAcometidaAgregada(circuitos: CircuitoResuelto[], tensiones: Tensiones) {
  const tipoTablero = tipoTensionTablero(tensiones)
  const above    = circuitos.filter(x => !x.es_acometida)
  const potencia = above.reduce((s, x) => s + (x.potencia ?? 0), 0) || null
  const conFP    = above.filter(x => x.FP != null && (x.potencia ?? 0) > 0)
  const sumPot   = conFP.reduce((s, x) => s + x.potencia!, 0)
  const fp       = sumPot > 0 ? conFP.reduce((s, x) => s + x.FP! * x.potencia!, 0) / sumPot : null
  const tension  = tensionDeTipo(tipoTablero, tensiones)
  return {
    tipoTablero, potencia, fp, tension,
    corriente: calcCorriente(potencia, tipoTablero, tension, fp),
    corrientesFase: calcCorrientesPorFase(above, tensiones),
  }
}

// Desequilibrio de corrientes entre fases, en %: (I máx − I mín) / I promedio.
// null si no hay corriente en ninguna fase.
export function desequilibrioFases(f: { R: number; S: number; T: number }): number | null {
  const prom = (f.R + f.S + f.T) / 3
  if (!(prom > 0)) return null
  return (Math.max(f.R, f.S, f.T) - Math.min(f.R, f.S, f.T)) / prom * 100
}

// Potencia/FP EFECTIVA de un ALIMENTADOR vinculado a otro tablero — null si `c` no
// es un alimentador vinculado o el destino no se encontró.
// Destino POTENCIA: se suma su acometida (sus circuitos propios, recursivamente).
// Destino CONTROL/DATOS: no tiene circuitos propios, es una carga simple
// (potencia_inst / factor_potencia).
// Si el alimentador está vinculado a una acometida concreta del destino
// (`acometida_destino_id`), toma solo lo que esa acometida alimenta: los circuitos que
// tiene ARRIBA en el orden del tablero (ej. la de emergencia → solo las cargas
// esenciales). Sin vínculo, o si esa acometida ya no existe, toma todo el tablero.
// `visitados` corta un eventual ciclo de alimentadores (A→B→A) cargado por error.
export function resolverAlimentador(
  c: CircuitoCarga, tableros: TableroCarga[], visitados: Set<number> = new Set(),
): { potencia: number | null; fp: number | null; tipoTableroFallback: string | null } | null {
  if (c.tipo !== 'ALIMENTADOR' || c.tablero_destino_id == null) return null
  const destino = tableros.find(t => t.id === c.tablero_destino_id)
  if (!destino || visitados.has(destino.id)) return null
  if (destino.categoria === 'CONTROL' || destino.categoria === 'DATOS')
    return { potencia: destino.potencia_inst ?? null, fp: destino.factor_potencia ?? null, tipoTableroFallback: null }

  const sub = new Set(visitados).add(destino.id)
  const acometida = c.acometida_destino_id != null
    ? destino.circuitos.find(x => x.id === c.acometida_destino_id && x.es_acometida) : undefined
  const alimentados = acometida
    ? destino.circuitos.filter(x => x.parent_id == null && (x.orden ?? 0) < (acometida.orden ?? 0))
    : destino.circuitos
  const agregado = calcAcometidaAgregada(
    resolverParaSuma(alimentados, tableros, sub),
    tensionesDe(destino),
  )
  return { potencia: agregado.potencia, fp: agregado.fp, tipoTableroFallback: agregado.tipoTablero }
}

// Circuitos de un tablero listos para SUMAR en su acometida. Varios alimentadores del
// mismo tablero hacia un mismo destino (barra partida, normal + emergencia) son
// alimentaciones alternativas de la misma carga: cada uno se dimensiona para la demanda
// que le toca (todo el destino, o lo de su acometida), pero en la suma del tablero de
// origen el destino entra una sola vez — con la mayor de esas demandas, que ya incluye
// a las otras (la principal incluye a las esenciales). Los demás quedan sin potencia.
export function resolverParaSuma(circuitos: CircuitoCarga[], tableros: TableroCarga[], visitados: Set<number> = new Set()): CircuitoResuelto[] {
  const resueltos = circuitos.map(c => resolverEfectivo(c, tableros, visitados))
  const mayorPorDestino = new Map<number, number>()   // destino → índice del que cuenta
  circuitos.forEach((c, i) => {
    if (c.tipo !== 'ALIMENTADOR' || c.tablero_destino_id == null) return
    const j = mayorPorDestino.get(c.tablero_destino_id)
    if (j === undefined || (resueltos[i].potencia ?? 0) > (resueltos[j].potencia ?? 0)) mayorPorDestino.set(c.tablero_destino_id, i)
  })
  return resueltos.map((r, i) => {
    const destino = circuitos[i].tipo === 'ALIMENTADOR' ? circuitos[i].tablero_destino_id : null
    return destino != null && mayorPorDestino.get(destino) !== i ? { ...r, potencia: null } : r
  })
}

// Potencia/FP efectiva de cualquier circuito para agregar en una acometida.
export function resolverEfectivo(c: CircuitoCarga, tableros: TableroCarga[], visitados: Set<number> = new Set()): CircuitoResuelto {
  const alim = resolverAlimentador(c, tableros, visitados)
  return {
    potencia: alim ? alim.potencia : (c.potencia ?? null),
    FP: alim ? alim.fp : c.FP,
    tipo_tension: c.tipo_tension, fase: c.fase, es_acometida: c.es_acometida,
  }
}

/**
 * Carga efectiva de un circuito dentro de su tablero.
 *
 * @param c          el circuito
 * @param anteriores circuitos principales que están ANTES que `c` en el orden del
 *                   tablero — una acometida suma los que tiene encima
 * @param tensiones  tensiones del tablero de `c`
 * @param tableros   todos los tableros del proyecto (para alimentadores vinculados)
 */
export function resolverCargaCircuito(
  c: CircuitoCarga, anteriores: CircuitoCarga[], tensiones: Tensiones, tableros: TableroCarga[],
): CargaCircuito {
  if (c.es_acometida) {
    const a = calcAcometidaAgregada(resolverParaSuma(anteriores, tableros), tensiones)
    return { potencia: a.potencia, fp: a.fp, tipo: a.tipoTablero, tension: a.tension, corriente: a.corriente, corrientesFase: a.corrientesFase }
  }

  const tipo = tipoEfectivoCircuito(c, tensiones)
  const tension = tensionDeTipo(tipo, tensiones)

  const alim = resolverAlimentador(c, tableros)
  if (alim) {
    return {
      potencia: alim.potencia, fp: alim.fp, tipo, tension,
      corriente: calcCorriente(alim.potencia, tipo ?? alim.tipoTableroFallback, tension, alim.fp),
      corrientesFase: null,
    }
  }

  const potencia = c.potencia ?? null
  return { potencia, fp: c.FP, tipo, tension, corriente: calcCorriente(potencia, tipo, tension, c.FP), corrientesFase: null }
}
