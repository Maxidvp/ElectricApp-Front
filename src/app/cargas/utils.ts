import { generarFormacion, calcCorriente, type FormatoFormacion } from '@/utils/electricidad'
import type { CircuitoAPI, CircuitoRow, FormacionData, Tensiones } from './types'

export function formacionData(c: CircuitoAPI): FormacionData | null {
  if (!c.formacion) return null
  return {
    familia_id:        String(c.formacion.cable.familia_id),
    cable_fase_id:     String(c.formacion.cable_id),
    cond_por_fase:     String(c.formacion.cond_por_fase),
    Nfases:            String(c.formacion.Nfases),
    familia_neutro_id: c.formacion.cable_neutro_id ? String(c.formacion.cable.familia_id) : '',
    cable_neutro_id:   c.formacion.cable_neutro_id ? String(c.formacion.cable_neutro_id) : '',
    Nneutro:           String(c.formacion.Nneutro),
    familia_tierra_id: c.formacion.cable_tierra_id ? String(c.formacion.cable.familia_id) : '',
    cable_tierra_id:   c.formacion.cable_tierra_id ? String(c.formacion.cable_tierra_id) : '',
    disposicion:       c.formacion.disposicion ?? '',
  }
}

// Versión simplificada de calcCorriente que retorna 0 (no null) para poder
// acumular corrientes por fase sin chequear nulos en cada iteración.
function corrienteFase(potencia_kW: number | null, fp: number | null, tension: number | null, factor: number): number {
  if (!potencia_kW || !fp || fp <= 0 || !tension || tension <= 0) return 0
  return (potencia_kW * 1000) / (factor * tension * fp)
}

// Forma mínima de un circuito ya resuelto — con la potencia/FP EFECTIVA — que
// necesitan calcCorrientesPorFase/calcAcometidaAgregada. Para un circuito común
// coincide con sus propios campos, pero para un ALIMENTADOR vinculado la potencia
// cruda (c.potencia) siempre es null en la DB — no se carga a mano, se toma del
// tablero destino — así que hace falta resolverla antes de agregar (ver resolverEfectivo).
type CircuitoResuelto = {
  potencia: number | null
  FP: number | null
  tipo_tension: string | null
  fase: string | null
  es_acometida: boolean
}

// Acumula la corriente por fase (R, S, T) de todos los circuitos no-acometida
// que están encima de la acometida en la tabla. Esto permite mostrar el desbalance
// de carga entre fases en la fila de la acometida.
// Los circuitos trifásicos suman igual en las tres fases (I = P / √3·V·FP).
// Los bifásicos suman en los dos conductores que usan según su asignación de fase.
// Los monofásicos suman solo en la fase asignada.
// Retorna null si ningún circuito tiene datos suficientes (evita mostrar 0/0/0).
function calcCorrientesPorFase(above: CircuitoResuelto[], tensiones: Tensiones): { R: number; S: number; T: number } | null {
  const available = ([
    tensiones.mono != null ? 'mono' : null,
    tensiones.bi   != null ? 'bi'   : null,
    tensiones.tri  != null ? 'tri'  : null,
  ] as (string | null)[]).filter(Boolean) as string[]

  let R = 0, S = 0, T = 0

  for (const c of above) {
    const tipo = c.tipo_tension ?? (available.length === 1 ? available[0] : null)
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

// Suma la potencia y el FP ponderado de un conjunto de circuitos (los que alimenta
// una acometida). FP_equiv = Σ(FPᵢ · Pᵢ) / ΣPᵢ — equivalente a la potencia reactiva
// promedio ponderada, representa correctamente el factor de potencia de la carga agregada.
function calcAcometidaAgregada(circuitos: CircuitoResuelto[], tensiones: Tensiones) {
  const tipoTablero = tensiones.tri != null ? 'tri' : tensiones.bi != null ? 'bi' : tensiones.mono != null ? 'mono' : null
  const above   = circuitos.filter(x => !x.es_acometida)
  const potencia = above.reduce((s, x) => s + (x.potencia ?? 0), 0) || null
  const conFP   = above.filter(x => x.FP != null && (x.potencia ?? 0) > 0)
  const sumPot  = conFP.reduce((s, x) => s + x.potencia!, 0)
  const fp      = sumPot > 0 ? conFP.reduce((s, x) => s + x.FP! * x.potencia!, 0) / sumPot : null
  const tension_v = tipoTablero === 'tri' ? tensiones.tri : tipoTablero === 'bi' ? tensiones.bi : tensiones.mono
  return {
    tipoTablero, potencia, fp,
    corriente: calcCorriente(potencia, tipoTablero, tension_v, fp ?? null),
    corrientesFase: calcCorrientesPorFase(above, tensiones),
  }
}

// Resuelve la potencia/FP EFECTIVA de un circuito ALIMENTADOR vinculado a otro
// tablero — null si `c` no es un alimentador vinculado o el destino no se encontró.
// Si el destino es POTENCIA se suma su acometida (circuitos propios); si es
// CONTROL/DATOS no tiene circuitos propios, es una carga simple: se toma directo
// su potencia_inst/factor_potencia. `tipoTableroFallback` es el tipo de tensión
// del destino, usado como respaldo si el alimentador no tiene tipo_tension propio.
function resolverAlimentador(
  c: CircuitoAPI, tableros: any[],
): { potencia: number | null; fp: number | null; tipoTableroFallback: string | null } | null {
  if (c.tipo !== 'ALIMENTADOR' || c.tablero_destino_id == null) return null
  const destino = tableros.find((t: any) => t.id === c.tablero_destino_id)
  if (!destino) return null
  const esCargaSimple = destino.categoria === 'CONTROL' || destino.categoria === 'DATOS'
  if (esCargaSimple) {
    return { potencia: destino.potencia_inst ?? null, fp: destino.factor_potencia ?? null, tipoTableroFallback: null }
  }
  const agregado = calcAcometidaAgregada(
    destino.circuitos.map((x: CircuitoAPI) => resolverEfectivo(x, tableros)),
    { mono: destino.tension_mono, bi: destino.tension_bi, tri: destino.tension_tri },
  )
  return { potencia: agregado.potencia, fp: agregado.fp, tipoTableroFallback: agregado.tipoTablero }
}

// Potencia/FP efectiva de cualquier circuito para agregar en una acometida — la
// propia si es un circuito común, o la de su tablero destino si es un ALIMENTADOR
// vinculado (cuya potencia cruda en la DB siempre es null, no se carga a mano).
function resolverEfectivo(c: CircuitoAPI, tableros: any[]): CircuitoResuelto {
  const alim = resolverAlimentador(c, tableros)
  return {
    potencia: alim ? alim.potencia : (c.potencia ?? null),
    FP: alim ? alim.fp : c.FP,
    tipo_tension: c.tipo_tension, fase: c.fase, es_acometida: c.es_acometida,
  }
}

// Mapea los circuitos del back a filas de la tabla, calculando corrientes y
// agregando los datos de formación. La acometida suma los circuitos anteriores.
// `tableros` (opcional) es la lista completa del proyecto, usada para resolver la
// demanda de un ALIMENTADOR vinculado a otro tablero (se toma de SU acometida).
export function mapearCircuitos(
  data: CircuitoAPI[], tensiones: Tensiones, formato: FormatoFormacion = 'ingles', tableros: any[] = [],
): CircuitoRow[] {
  return data.map((c, idx) => {
    if (c.es_acometida) {
      const resueltos = data.slice(0, idx).map(x => resolverEfectivo(x, tableros))
      const agregado = calcAcometidaAgregada(resueltos, tensiones)
      return {
        id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
        FP: agregado.fp, Largo: c.Largo, tipo_tension: agregado.tipoTablero, fase: c.fase,
        es_acometida: true, potencia: agregado.potencia,
        corriente: agregado.corriente,
        corrientesFase: agregado.corrientesFase,
        formacion: c.formacion ? generarFormacion(c.formacion, formato) : '—',
        formacionData: formacionData(c),
        tablero_destino_id: null, tablero_destino: null,
      }
    }

    // Para circuitos comunes: si no tiene tipo_tension asignado pero el tablero
    // solo tiene un tipo de tensión disponible, se lo asignamos automáticamente.
    // Si tiene más de uno disponible y no hay asignación, la corriente será null.
    const available = [tensiones.mono != null ? 'mono' : null, tensiones.bi != null ? 'bi' : null, tensiones.tri != null ? 'tri' : null].filter(Boolean) as string[]
    const tipoEfectivo = c.tipo_tension ?? (available.length === 1 ? available[0] : null)
    const tension_v = tipoEfectivo === 'mono' ? tensiones.mono
                    : tipoEfectivo === 'bi'   ? tensiones.bi
                    : tipoEfectivo === 'tri'  ? tensiones.tri
                    : null

    const alim = resolverAlimentador(c, tableros)
    if (alim) {
      return {
        id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
        FP: alim.fp, Largo: c.Largo, tipo_tension: c.tipo_tension, fase: c.fase,
        es_acometida: false,
        potencia: alim.potencia,
        corriente: calcCorriente(alim.potencia, tipoEfectivo ?? alim.tipoTableroFallback, tension_v, alim.fp),
        corrientesFase: null,
        formacion: c.formacion ? generarFormacion(c.formacion, formato) : '—',
        formacionData: formacionData(c),
        tablero_destino_id: c.tablero_destino_id, tablero_destino: c.tablero_destino,
      }
    }

    return {
      id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
      FP: c.FP, Largo: c.Largo, tipo_tension: c.tipo_tension, fase: c.fase,
      es_acometida: false,
      potencia: c.potencia ?? null,
      corriente: calcCorriente(c.potencia ?? null, tipoEfectivo, tension_v, c.FP),
      corrientesFase: null,
      formacion: c.formacion ? generarFormacion(c.formacion, formato) : '—',
      formacionData: formacionData(c),
      tablero_destino_id: c.tablero_destino_id, tablero_destino: c.tablero_destino,
    }
  })
}
