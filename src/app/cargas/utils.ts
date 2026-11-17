import { generarFormacion, type FormatoFormacion } from '@/utils/electricidad'
import { resolverCargaCircuito, type TableroCarga, type Tensiones } from '@/utils/cargas'
import type { CircuitoAPI, CircuitoRow, FormacionData } from './types'

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

// Mapea los circuitos del back a filas de la tabla. La carga efectiva de cada fila
// (acometida que suma los circuitos anteriores, ALIMENTADOR que toma la demanda de
// su tablero destino) sale de utils/cargas.ts, compartido con Ampacidad y Caídas.
// `tableros` es la lista completa del proyecto, para resolver alimentadores vinculados.
export function mapearCircuitos(
  data: CircuitoAPI[], tensiones: Tensiones, formato: FormatoFormacion = 'ingles', tableros: TableroCarga[] = [],
): CircuitoRow[] {
  return data.map((c, idx) => {
    const carga = resolverCargaCircuito(c, data.slice(0, idx), tensiones, tableros)
    return {
      id: c.id, circuito: c.circuito, descripcion: c.descripcion, tipo: c.tipo,
      FP: carga.fp, Largo: c.Largo,
      tipo_tension: c.es_acometida ? carga.tipo : c.tipo_tension,
      fase: c.fase, es_acometida: c.es_acometida,
      // La columna editable "Potencia" es la INSTALADA; la corriente sale de la simultánea.
      potencia: carga.potenciaInstalada, potenciaSimultanea: carga.potencia, fs: carga.fs,
      fsCargado: c.factor_simultaneidad ?? null,
      cantidad_puntos: c.cantidad_puntos ?? null, potencia_unitaria: c.potencia_unitaria ?? null,
      corriente: carga.corriente, corrientesFase: carga.corrientesFase,
      formacion: c.formacion ? generarFormacion(c.formacion, formato) : '—',
      formacionData: formacionData(c),
      tablero_destino_id: c.es_acometida ? null : c.tablero_destino_id,
      tablero_destino: c.es_acometida ? null : c.tablero_destino,
      acometida_destino: c.acometida_destino_id == null ? null
        : tableros.find(t => t.id === c.tablero_destino_id)?.circuitos.find(x => x.id === c.acometida_destino_id && x.es_acometida)?.circuito ?? null,
    }
  })
}
