import { generarFormacion, calcCorriente, type FormatoFormacion } from '@/utils/electricidad'
import type { CircuitoAPI, CircuitoRow, FormacionData, Tensiones } from './types'

export function formacionData(c: CircuitoAPI): FormacionData | null {
  if (!c.formacion) return null
  return {
    familia_id:        String(c.formacion.cable.familia_id),
    cable_fase_id:     String(c.formacion.cable_id),
    cond_por_fase:     String(c.formacion.cond_por_fase),
    Nfases:            String(c.formacion.Nfases),
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

// Acumula la corriente por fase (R, S, T) de todos los circuitos no-alimentadores
// que están encima del alimentador en la tabla. Esto permite mostrar el desbalance
// de carga entre fases en la fila del alimentador.
// Los circuitos trifásicos suman igual en las tres fases (I = P / √3·V·FP).
// Los bifásicos suman en los dos conductores que usan según su asignación de fase.
// Los monofásicos suman solo en la fase asignada.
// Retorna null si ningún circuito tiene datos suficientes (evita mostrar 0/0/0).
function calcCorrientesPorFase(above: CircuitoAPI[], tensiones: Tensiones): { R: number; S: number; T: number } | null {
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

// Mapea los circuitos del back a filas de la tabla, calculando corrientes y
// agregando los datos de formación. Los alimentadores suman los circuitos anteriores.
export function mapearCircuitos(data: CircuitoAPI[], tensiones: Tensiones, formato: FormatoFormacion = 'ingles'): CircuitoRow[] {
  // Tipo predominante del tablero (tri > bi > mono) para alimentadores.
  // Se usa tri si el tablero tiene tensión trifásica definida, independientemente
  // de si hay circuitos mono o bifásicos — el alimentador lleva toda la carga.
  const tipoTablero = tensiones.tri != null ? 'tri' : tensiones.bi != null ? 'bi' : tensiones.mono != null ? 'mono' : null

  return data.map((c, idx) => {
    if (c.es_acometida) {
      // Un alimentador representa la acometida que alimenta a todos los circuitos
      // anteriores (encima de él en la tabla). Sumamos sus potencias para obtener
      // la demanda total, y usamos un FP ponderado por potencia:
      //   FP_equiv = Σ(FPᵢ · Pᵢ) / ΣPᵢ
      // Esto es equivalente a la potencia reactiva promedio ponderada y representa
      // correctamente el factor de potencia de la carga agregada.
      const above   = data.slice(0, idx).filter(x => !x.es_acometida)
      const potencia = above.reduce((s, x) => s + (x.potencia ?? 0), 0) || null
      const conFP   = above.filter(x => x.FP != null && (x.potencia ?? 0) > 0)
      const sumPot  = conFP.reduce((s, x) => s + x.potencia!, 0)
      const fp      = sumPot > 0 ? conFP.reduce((s, x) => s + x.FP! * x.potencia!, 0) / sumPot : null
      const tension_v = tipoTablero === 'tri' ? tensiones.tri : tipoTablero === 'bi' ? tensiones.bi : tensiones.mono
      return {
        id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
        FP: fp ?? null, Largo: c.Largo, tipo_tension: tipoTablero, fase: c.fase,
        es_acometida: true, potencia,
        corriente: calcCorriente(potencia, tipoTablero, tension_v, fp ?? null),
        corrientesFase: calcCorrientesPorFase(above, tensiones),
        formacion: c.formacion ? generarFormacion(c.formacion, formato) : '—',
        formacionData: formacionData(c),
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
    return {
      id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
      FP: c.FP, Largo: c.Largo, tipo_tension: c.tipo_tension, fase: c.fase,
      es_acometida: false,
      potencia: c.potencia ?? null,
      corriente: calcCorriente(c.potencia ?? null, tipoEfectivo, tension_v, c.FP),
      corrientesFase: null,
      formacion: c.formacion ? generarFormacion(c.formacion, formato) : '—',
      formacionData: formacionData(c),
    }
  })
}
