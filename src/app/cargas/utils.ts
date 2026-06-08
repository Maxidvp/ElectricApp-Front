import { generarFormacion, calcCorriente } from '@/utils/electricidad'
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

// Mapea los circuitos del back a filas de la tabla, calculando corrientes y
// agregando los datos de formación. Los alimentadores suman los circuitos anteriores.
export function mapearCircuitos(data: CircuitoAPI[], tensiones: Tensiones): CircuitoRow[] {
  // Tipo predominante del tablero (tri > bi > mono) para alimentadores
  const tipoTablero = tensiones.tri != null ? 'tri' : tensiones.bi != null ? 'bi' : tensiones.mono != null ? 'mono' : null

  return data.map((c, idx) => {
    if (c.es_alimentador) {
      const above   = data.slice(0, idx).filter(x => !x.es_alimentador)
      const potencia = above.reduce((s, x) => s + (x.potencia ?? 0), 0) || null
      const conFP   = above.filter(x => x.FP != null && (x.potencia ?? 0) > 0)
      const sumPot  = conFP.reduce((s, x) => s + x.potencia!, 0)
      const fp      = sumPot > 0 ? conFP.reduce((s, x) => s + x.FP! * x.potencia!, 0) / sumPot : null
      const tension_v = tipoTablero === 'tri' ? tensiones.tri : tipoTablero === 'bi' ? tensiones.bi : tensiones.mono
      return {
        id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
        FP: fp ?? null, Largo: c.Largo, tipo_tension: tipoTablero, fase: c.fase,
        es_alimentador: true, potencia,
        corriente: calcCorriente(potencia, tipoTablero, tension_v, fp ?? null),
        formacion: c.formacion ? generarFormacion(c.formacion) : '—',
        formacionData: formacionData(c),
      }
    }

    const available = [tensiones.mono != null ? 'mono' : null, tensiones.bi != null ? 'bi' : null, tensiones.tri != null ? 'tri' : null].filter(Boolean) as string[]
    const tipoEfectivo = c.tipo_tension ?? (available.length === 1 ? available[0] : null)
    const tension_v = tipoEfectivo === 'mono' ? tensiones.mono
                    : tipoEfectivo === 'bi'   ? tensiones.bi
                    : tipoEfectivo === 'tri'  ? tensiones.tri
                    : null
    return {
      id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
      FP: c.FP, Largo: c.Largo, tipo_tension: c.tipo_tension, fase: c.fase,
      es_alimentador: false,
      potencia: c.potencia ?? null,
      corriente: calcCorriente(c.potencia ?? null, tipoEfectivo, tension_v, c.FP),
      formacion: c.formacion ? generarFormacion(c.formacion) : '—',
      formacionData: formacionData(c),
    }
  })
}
