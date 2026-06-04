export const TIPOS_CIRCUITO = ['ACU', 'MOTOR', 'VDF', 'IUG', 'TUG', 'IUE', 'TUE', 'APM', 'RESERVA', 'ALIMENTADOR'] as const

// Estructura que devuelve el back para un circuito
export type CircuitoAPI = {
  id: number
  circuito: string
  descripcion: string | null
  tipo: string | null
  FP: number | null
  Largo: number | null
  tipo_tension: string | null
  fase: string | null
  es_alimentador: boolean
  potencia: number | null
  formacion: {
    nombre: string
    cond_por_fase: number
    Nfases: number
    Nneutro: number
    cable_id: number
    cable_neutro_id: number | null
    cable_tierra_id: number | null
    disposicion: string | null
    cable: { nombre: string; seccion_f: string; diametro: number | null; calibre_tipo: string; familia_id: number }
    cable_neutro: { nombre: string; diametro: number | null } | null
    cable_tierra: { nombre: string; diametro: number | null } | null
  } | null
}

// Estructura que usa la tabla para renderizar cada fila
export type CircuitoRow = {
  id: number
  circuito: string
  descripcion: string | null
  tipo: string | null
  FP: number | null
  Largo: number | null
  tipo_tension: string | null
  fase: string | null
  es_alimentador: boolean
  potencia: number | null
  corriente: number | null
  formacion: string
  formacionData: FormacionData | null
}

// Datos que necesita FormacionModal para pre-cargar un formulario
export type FormacionData = {
  familia_id: string
  cable_fase_id: string
  cond_por_fase: string
  Nfases: string
  cable_neutro_id: string
  Nneutro: string
  familia_tierra_id: string
  cable_tierra_id: string
  disposicion: string
}

export type ColMeta = { colType: 'editable' | 'result' | 'display' }

export type Tensiones = { mono: number | null; bi: number | null; tri: number | null }
