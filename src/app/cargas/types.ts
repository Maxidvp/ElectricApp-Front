export const TIPOS_CIRCUITO = ['ACU', 'MOTOR', 'VDF', 'IUG', 'TUG', 'IUE', 'TUE', 'APM', 'RESERVA', 'ACOMETIDA', 'ALIMENTADOR'] as const

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
  es_acometida: boolean
  potencia: number | null
  tablero_destino_id: number | null
  tablero_destino: { id: number; tag: string; nombre: string | null } | null
  acometida_destino_id?: number | null
  factor_simultaneidad?: number | null
  cantidad_puntos?: number | null
  potencia_unitaria?: number | null
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
  es_acometida: boolean
  potencia: number | null
  corriente: number | null
  corrientesFase: { R: number; S: number; T: number } | null
  formacion: string
  formacionData: FormacionData | null
  tablero_destino_id: number | null
  tablero_destino: { id: number; tag: string; nombre: string | null } | null
  acometida_destino: string | null   // nombre de la acometida del destino a la que llega
  // Planilla de Análisis de Cargas: `potencia` es la INSTALADA; la simultánea es potencia × Fs
  potenciaSimultanea: number | null
  fs: number | null                  // Fs aplicado, o resultante en acometidas y alimentadores vinculados
  fsCargado: number | null           // lo que el usuario cargó (null = 1)
  cantidad_puntos: number | null
  potencia_unitaria: number | null
}

// Datos que necesita FormacionModal para pre-cargar un formulario
export type FormacionData = {
  familia_id: string
  cable_fase_id: string
  cond_por_fase: string
  Nfases: string
  familia_neutro_id: string
  cable_neutro_id: string
  Nneutro: string
  familia_tierra_id: string
  cable_tierra_id: string
  disposicion: string
}

export type ColMeta = { colType: 'editable' | 'result' | 'display' }

export type Tensiones = { mono: number | null; bi: number | null; tri: number | null }
