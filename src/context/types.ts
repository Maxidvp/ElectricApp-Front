import type { Dispatch, SetStateAction } from 'react'
import type { Canio, Bandeja, Segmento, SegmentoCircuito, SegmentoLazo, SegmentoPuertoRed, Conjunto, CreateSegmentoInput, Pared, CreateParedInput, Arquitectura } from '@/services/ruteo'
import type { FormacionPatch } from '@/services/circuitos'
import type { Proyecto as ProyectoMeta } from '@/services/proyectos'
import type { Caniero } from '@/services/canieros'

export type { ProyectoMeta, Pared, Arquitectura, Caniero }
export type { Canio, Bandeja, Segmento, SegmentoCircuito, SegmentoLazo, SegmentoPuertoRed, Conjunto, CreateSegmentoInput, CreateParedInput, FormacionPatch }

// ── Model types ───────────────────────────────────────────────────

export type Cable = {
  id: number
  nombre: string
  seccion_f: string
  diametro: number | null
  calibre_tipo: string
  familia_id: number
  Nfases: number
  Iadm: number
  familia?: { material: string | null; temperatura: number | null; aislamiento: string | null; norma: string | null } | null
}

export type Formacion = {
  id: number
  cable_id: number
  cond_por_fase: number
  Nfases: number
  Nneutro: number
  cable_neutro_id: number | null
  cable_tierra_id: number | null
  disposicion: string | null
  cable: Cable
  cable_neutro: Cable | null
  cable_tierra: Cable | null
}

export type FamiliaProteccion = {
  id: number
  tipo: string   // 'termomagnetico' | 'diferencial' | 'guardamotor' | 'caja_moldeada'
  marca: string | null
  modelo: string | null
  catalogo: string | null
  norma: string | null
}

export type Proteccion = {
  id: number
  familia_id: number
  polos: number | null
  In: number | null
  Icu: number | null
  curva: string | null
  sensibilidad_mA: number | null
  clase_diferencial: string | null
  rango_regulacion_min: number | null
  rango_regulacion_max: number | null
  familia: FamiliaProteccion
}

// Protección diferencial que cubre a este circuito junto con sus hermanos de grupo
// (ver GrupoDiferencial más abajo) — independiente de `proteccion` (esa es la propia
// de este circuito, ej. el ITM).
// proteccion_id/proteccion nulos = grupo creado pero sin device elegido todavía — se
// dibuja igual en el unifilar, solo que sin datos de protección (ver DiferencialesModal).
export type GrupoDiferencial = {
  id: number
  tablero_id: number
  nombre: string | null
  proteccion_id: number | null
  proteccion: Proteccion | null
}

export type Circuito = {
  id: number
  orden: number
  circuito: string
  descripcion: string | null
  tipo: string | null
  tablero_id: number
  formacion_id: number | null
  formacion: Formacion | null
  proteccion_id: number | null
  proteccion: Proteccion | null
  grupo_diferencial_id: number | null
  grupo_diferencial: GrupoDiferencial | null
  FP: number | null
  Largo: number | null
  tipo_tension: string | null
  fase: string | null
  es_acometida: boolean
  potencia: number | null
  metodo_instalacion: string | null
  fc_manual: number | null
  ft_manual: number | null
  role: string | null       // null = principal, 'retorno', 'combinacion', 'ramal'
  parent_id: number | null
  // Solo aplica si tipo === 'ALIMENTADOR': tablero al que este circuito alimenta
  tablero_destino_id: number | null
  tablero_destino: { id: number; tag: string; nombre: string | null } | null
}

export type FuenteAlimentacion = {
  id: number
  tipo: string   // 'RED' | 'GENERADOR' | 'UPS' | 'PANEL_SOLAR' | 'TRANSFORMADOR'
  nombre: string | null
  tablero_id: number
  tension_nominal: number | null
  potencia_nominal: number | null
  potencia_cc: number | null
  corriente_cc: number | null
  relacion_rx: number | null
  xd_subtransitoria_pct: number | null
  factor_potencia: number | null
  rg_sobre_xd: number | null
  corriente_limitada_pu: number | null
  tension_primaria: number | null
  ukr_porcentaje: number | null
  perdidas_cobre_w: number | null
  uRr_porcentaje: number | null
  grupo_conexion: string | null
  impedancia_homopolar_ratio: number | null
}

export type LazoInstrumentacion = {
  id: number
  orden: number
  tag_lazo: string
  tablero_id: number
  descripcion: string | null
  tipo_senal: string | null   // 'AI' | 'AO' | 'DI' | 'DO'
  protocolo: string | null
  variable_proceso: string | null
  rango_min: number | null
  rango_max: number | null
  unidad: string | null
  direccion_plc: string | null
  fabricante: string | null
  modelo: string | null
  ubicacion_campo: string | null
  cable_id: number | null
  cable: Cable | null
  cantidad_cables: number | null
}

export type PuertoRed = {
  id: number
  orden: number
  puerto: string
  tablero_id: number
  descripcion: string | null
  tipo: string | null   // 'PATCH_PANEL' | 'SWITCH' | 'SERVIDOR' | 'AP' | 'FIREWALL' | 'UPS_RED'
  vlan: string | null
  dispositivo_conectado: string | null
  cable_tipo: string | null
  velocidad: string | null
  fabricante: string | null
  modelo: string | null
  cable_id: number | null
  cable: Cable | null
  cantidad_cables: number | null
}

export type ElementoUnifilarAtributo = {
  id: number
  clave: string
  valor: string
}

// Elemento agregado a mano sobre el unifilar (líneas/textos/símbolos que no salen
// de Circuito/Formacion/Proteccion) — ver src/app/unifilares/_elementos.ts.
export type ElementoUnifilar = {
  id: number
  tablero_id: number
  tipo: string   // 'linea' | 'texto' | 'simbolo'
  circuito_id: number | null
  x1: number
  y1: number
  x2: number | null
  y2: number | null
  tipo_linea: string | null   // 'CONTINUOUS' | 'DASHED' | 'DASHDOT' | 'HIDDEN' | 'CENTER'
  grosor: number | null
  texto: string | null
  tamano: number | null
  negrita: boolean | null
  alineacion: string | null   // 'left' | 'center' | 'right'
  rotacion: number | null
  nombre_bloque: string | null
  atributos: ElementoUnifilarAtributo[]
  color: string | null
}

export type Tablero = {
  id: number
  tag: string
  nombre: string | null
  ubicacion: string | null
  tipo: string | null
  categoria: string | null   // 'POTENCIA' | 'CONTROL' | 'DATOS'
  sistema_montaje: string | null   // solo aplica si categoria = POTENCIA
  tension_mono: number | null
  tension_bi: number | null
  tension_tri: number | null
  frecuencia: number | null
  corriente_nom: number | null
  corriente_cc_max: number | null
  corriente_cc_min: number | null
  potencia_inst: number | null   // kW — en CONTROL/DATOS representa la carga total del tablero
  potencia_dem: number | null    // kW — solo aplica a categoria POTENCIA
  factor_potencia: number | null   // FP — solo aplica a categoria CONTROL/DATOS
  fabricante: string | null
  modelo: string | null
  norma: string | null
  grado_proteccion: string | null
  modulos: number | null
  circuitos: Circuito[]
  fuentes: FuenteAlimentacion[]
  lazos: LazoInstrumentacion[]
  puertos_red: PuertoRed[]
  elementos_unifilar: ElementoUnifilar[]
  grupos_diferenciales: GrupoDiferencial[]
}

export type SegPatch = Partial<Omit<Segmento, 'canio' | 'bandeja' | 'circuitos' | 'conjuntos'>>

// ── Context interface ─────────────────────────────────────────────

export type ProyectosContextType = {
  // Proyectos
  proyectos: ProyectoMeta[]
  proyectoActivo: ProyectoMeta | null
  setProyectoActivo: (p: ProyectoMeta | null) => void
  crearProyecto: (data: { nombre: string; descripcion?: string | null }) => Promise<ProyectoMeta>
  actualizarProyecto: (id: number, data: { nombre: string; descripcion?: string | null; formato_formacion?: string; nomenclatura_fases?: string }) => Promise<void>
  eliminarProyecto: (id: number) => Promise<void>
  agregarFamiliaProyecto: (familiaId: number) => Promise<void>
  quitarFamiliaProyecto: (familiaId: number) => Promise<void>
  agregarParticipante: (email: string) => Promise<void>
  quitarParticipante: (usuarioId: number) => Promise<void>
  restaurarCheckpoint: (checkpointId: number) => Promise<void>

  // Tableros & circuitos
  tableros: Tablero[]
  loading: boolean
  error: string | null
  recargar: () => void
  getTablero: (id: number) => Tablero | undefined
  getCircuito: (id: number) => Circuito | undefined
  renombrarCircuito: (id: number, nombre: string) => void
  agregarCircuito: (tableroId: number, insertIndex?: number) => void
  duplicarCircuito: (circuitoId: number) => void
  eliminarCircuito: (id: number) => void
  reordenarCircuitos: (tableroId: number, orderedIds: number[]) => void
  actualizarDescripcion: (id: number, descripcion: string | null) => void
  actualizarFP: (id: number, fp: number | null) => void
  actualizarLargo: (id: number, largo: number | null) => void
  actualizarPotencia: (id: number, potencia: number | null) => void
  actualizarTipoTension: (id: number, tipo: string | null) => void
  actualizarFase: (id: number, fase: string | null) => void
  actualizarTipo: (id: number, tipo: string | null) => void
  actualizarEsAcometida: (id: number, val: boolean) => void
  actualizarMetodoInstalacion: (id: number, metodo: string | null) => void
  actualizarFcManual: (id: number, fc: number | null) => void
  actualizarFtManual: (id: number, ft: number | null) => void
  vincularTableroAlimentador: (id: number, tableroDestinoId: number | null) => void
  agregarAcometida: (tableroId: number, nombre: string, insertIndex: number) => void
  crearCircuitoAuxiliar: (parentId: number, role: 'retorno' | 'combinacion' | 'ramal') => Promise<Circuito>
  reordenarSubcircuitos: (orderedHijoIds: number[]) => void
  appendSegmentos: (segs: Segmento[]) => void
  appendParedes: (paredes: Pared[]) => void
  actualizarFormacion: (circuitoId: number, data: FormacionPatch, cables: { fase: Cable; neutro: Cable | null; tierra: Cable | null }) => void
  actualizarProteccion: (circuitoId: number, proteccion: Proteccion | null) => void
  asignarGrupoDiferencial: (circuitoId: number, grupo: GrupoDiferencial | null) => void
  agregarTablero: (data: any) => Promise<Tablero>
  duplicarTablero: (id: number) => Promise<Tablero>
  actualizarTablero: (id: number, data: Partial<Omit<Tablero, 'id' | 'circuitos' | 'fuentes' | 'lazos' | 'puertos_red'>>) => Promise<void>
  eliminarTablero: (id: number) => Promise<void>
  agregarFuente: (tableroId: number, data: Omit<FuenteAlimentacion, 'id' | 'tablero_id'>) => Promise<void>
  actualizarFuente: (id: number, data: Omit<FuenteAlimentacion, 'id' | 'tablero_id'>) => Promise<void>
  eliminarFuente: (id: number) => Promise<void>
  // Reemplaza TODOS los grupos diferenciales del tablero por los tramos calculados en
  // DiferencialesModal (borra los viejos, crea uno por tramo y reasigna los circuitos)
  // — más simple que diffear altas/bajas/ediciones circuito por circuito.
  guardarGruposDiferenciales: (tableroId: number, runs: { nombre: string; proteccionId: number | null; circuitoIds: number[] }[]) => Promise<void>
  agregarLazo: (tableroId: number, data: Omit<LazoInstrumentacion, 'id' | 'tablero_id'>) => Promise<void>
  actualizarLazo: (id: number, data: Omit<LazoInstrumentacion, 'id' | 'tablero_id'>) => Promise<void>
  eliminarLazo: (id: number) => Promise<void>
  agregarLazoVacio: (tableroId: number) => Promise<void>
  duplicarLazo: (lazoId: number) => Promise<void>
  reordenarLazos: (tableroId: number, orderedIds: number[]) => void
  agregarPuertoRed: (tableroId: number, data: Omit<PuertoRed, 'id' | 'tablero_id'>) => Promise<void>
  actualizarPuertoRed: (id: number, data: Omit<PuertoRed, 'id' | 'tablero_id'>) => Promise<void>
  eliminarPuertoRed: (id: number) => Promise<void>
  agregarPuertoRedVacio: (tableroId: number) => Promise<void>
  duplicarPuertoRed: (puertoId: number) => Promise<void>
  reordenarPuertosRed: (tableroId: number, orderedIds: number[]) => void

  // Ruteo: segmentos & conjuntos
  segmentos: Segmento[]
  canios: Canio[]
  bandejas: Bandeja[]
  conjuntos: Conjunto[]
  activeConjuntoId: number | null
  setActiveConjuntoId: (id: number) => void
  addSegmento: (data: CreateSegmentoInput) => void
  previewSegmento: (id: number, patch: SegPatch) => void
  editSegmento: (id: number, patch: SegPatch) => void
  removeSegmento: (id: number) => void
  removeSegmentos: (ids: number[]) => void
  editSegmentosZ: (ids: number[], z: number) => void
  splitSegmento: (id: number, x: number, y: number, z: number) => void
  hasPendingSegmento: (id: number) => boolean
  asignarCircuito: (segId: number, circId: number, circ: SegmentoCircuito) => void
  quitarCircuito: (segId: number, circId: number) => void
  asignarLazo: (segId: number, lazoId: number, lazo: SegmentoLazo) => void
  quitarLazo: (segId: number, lazoId: number) => void
  asignarPuertoRed: (segId: number, puertoId: number, puerto: SegmentoPuertoRed) => void
  quitarPuertoRed: (segId: number, puertoId: number) => void
  addConjunto: (nombre: string) => Promise<Conjunto>
  renameConjunto: (id: number, nombre: string) => void
  deleteConjunto: (id: number) => void
  addSegmentoToConjunto: (segId: number, conjuntoId: number) => void
  removeSegmentoFromConjunto: (segId: number, conjuntoId: number) => void
  addTableroToConjunto: (conjuntoId: number, tableroId: number) => void
  removeTableroFromConjunto: (conjuntoId: number, tableroId: number) => void

  // Paredes & arquitecturas
  paredes: Pared[]
  addPared: (data: CreateParedInput) => void
  editPared: (id: number, patch: Partial<Omit<Pared, 'id'>>) => void
  removePared: (id: number) => void
  tablaParedes: Arquitectura[]
  activaArquitecturaId: number | null
  setActivaArquitecturaId: (id: number | null) => void
  addArquitectura: (nombre: string) => Promise<Arquitectura | null>
  renameArquitectura: (id: number, nombre: string) => void
  deleteArquitectura: (id: number) => void
  addArquitecturaToConjunto: (tablaParedId: number, conjuntoId: number) => void
  removeArquitecturaFromConjunto: (tablaParedId: number, conjuntoId: number) => void

  // Canieros enterrados — se cargan junto con el resto del proyecto para que
  // /caneros no necesite su propio fetch al entrar.
  canieros: Caniero[]
  setCanieros: Dispatch<SetStateAction<Caniero[]>>
}
