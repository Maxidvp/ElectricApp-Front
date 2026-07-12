// Modelo de entrada/salida del motor de cálculo — spec §2 y §4.
import type { Complex } from './complex'
import type { Escenario, Material } from './constantes'

export type TipoFalla = 'TRIFASICA' | 'BIFASICA' | 'BIFASICA_TIERRA' | 'MONOFASICA_TIERRA'

// §2.2 — Red de alimentación.
// Nota: la spec no incluye un campo `nodo` en esta tabla, pero hace falta uno
// para poder ubicar la fuente en el grafo de la red — se agrega como campo
// obligatorio adicional (mínima desviación necesaria para que el algoritmo sea implementable).
export type NetworkFeeder = {
  id: string
  nodo: string
  tension_nominal: number        // V — Un_Q
  potencia_cc?: number           // VA — S"kQ (excluyente con corriente_cc)
  corriente_cc?: number          // A  — I"kQ
  relacion_rx?: number           // default 0.1
}

// §2.3 — Transformador
export type Transformer = {
  id: string
  potencia_nominal: number       // VA — SrT
  tension_primaria: number       // V  — UrT_HV
  tension_secundaria: number     // V  — UrT_LV
  ukr_porcentaje: number         // %
  perdidas_cobre?: number        // W — PkrT (alternativa a uRr_porcentaje)
  uRr_porcentaje?: number        // %
  grupo_conexion?: string
  impedancia_homopolar_ratio?: number  // Z0/Z1
  nodo_hv: string
  nodo_lv: string
}

// §2.4 — Generador síncrono
export type SyncGenerator = {
  id: string
  potencia_nominal: number       // VA — SrG
  tension_nominal: number        // V  — UrG
  xd_subtransitoria_pct: number  // % — x"d
  factor_potencia: number        // cos φrG, 0 < fp <= 1
  rg_sobre_xd?: number           // default según tabla 2.4
  nodo: string
}

// §2.5 — Conductor / cable / línea
export type Conductor = {
  id: string
  longitud: number                // m
  seccion: number                  // mm²
  n_conductores_por_fase?: number  // default 1
  material: Material
  reactancia_unitaria?: number     // Ω/m
  temperatura_servicio?: number    // °C, default 20 — se usa para Ik_min
  nodo_a: string
  nodo_b: string
}

// §2.6 — Motor asíncrono
export type AsyncMotor = {
  id: string
  potencia_nominal: number   // VA — SrM
  tension_nominal: number    // V  — UrM
  ilr_sobre_ir: number       // ILR/IrM, típ. 5-8
  pares_de_polos?: number
  n_motores_equivalentes?: number  // default 1
  nodo: string
}

// §2.7 — Punto de falla
export type FaultPoint = {
  id: string
  nodo: string
  tension_nominal: number   // V — Un en el punto
  tipos_falla: TipoFalla[]
  tiempo_minimo_apertura?: number  // s, default 0.1 — t_min para Ib
  duracion_falla?: number          // s, default 1.0 — Tk para Ith
  escenario: Escenario | 'AMBOS'
}

export type EntradaProyecto = {
  proyecto: {
    nombre: string
    frecuencia_hz: 50 | 60
    norma?: string
    bt_tolerancia_10pct?: boolean
  }
  red_alimentacion: NetworkFeeder
  transformadores: Transformer[]
  generadores: SyncGenerator[]
  conductores: Conductor[]
  motores: AsyncMotor[]
  puntos_falla: FaultPoint[]
}

// §4 — Salida por punto de falla / escenario / tipo de falla
export type ResultadoFalla = {
  punto_falla_id: string
  escenario: Escenario
  tipo_falla: TipoFalla
  c: number
  Z1: Complex
  Z2: Complex
  Z0: Complex | null
  rx_ratio: number
  kappa: number
  corrientes: {
    Ik_inicial_A: number
    Sk_VA: number
    ip_A: number
    Ib_A: number
    Ik_permanente_A: number
    Ith_A: number
  }
  advertencias: string[]
}
