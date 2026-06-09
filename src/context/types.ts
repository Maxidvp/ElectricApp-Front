import type { Canio, Bandeja, Segmento, SegmentoCircuito, Conjunto, CreateSegmentoInput, Pared, CreateParedInput, Arquitectura } from '@/services/ruteo'
import type { FormacionPatch } from '@/services/circuitos'
import type { Proyecto as ProyectoMeta } from '@/services/proyectos'

export type { ProyectoMeta, Pared, Arquitectura }
export type { Canio, Bandeja, Segmento, SegmentoCircuito, Conjunto, CreateSegmentoInput, CreateParedInput, FormacionPatch }

// ── Model types ───────────────────────────────────────────────────

export type Cable = {
  id: number
  nombre: string
  seccion_f: string
  diametro: number | null
  calibre_tipo: string
  familia_id: number
  Nfases: number
  familia?: { material: string | null; temperatura: number | null; aislamiento: string | null } | null
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

export type Circuito = {
  id: number
  orden: number
  circuito: string
  descripcion: string | null
  tipo: string | null
  tablero_id: number
  formacion_id: number | null
  formacion: Formacion | null
  FP: number | null
  Largo: number | null
  tipo_tension: string | null
  fase: string | null
  es_alimentador: boolean
  potencia: number | null
}

export type Tablero = {
  id: number
  tag: string
  nombre: string | null
  ubicacion: string | null
  tipo: string | null
  tension_mono: number | null
  tension_bi: number | null
  tension_tri: number | null
  frecuencia: number | null
  corriente_nom: number | null
  corriente_cc: number | null
  potencia_inst: number | null
  potencia_dem: number | null
  fabricante: string | null
  modelo: string | null
  norma: string | null
  grado_proteccion: string | null
  modulos: number | null
  circuitos: Circuito[]
}

export type SegPatch = Partial<Omit<Segmento, 'canio' | 'bandeja' | 'circuitos' | 'conjuntos'>>

// ── Context interface ─────────────────────────────────────────────

export type ProyectosContextType = {
  // Proyectos
  proyectos: ProyectoMeta[]
  proyectoActivo: ProyectoMeta | null
  setProyectoActivo: (p: ProyectoMeta | null) => void
  crearProyecto: (data: { nombre: string; descripcion?: string | null }) => Promise<ProyectoMeta>
  actualizarProyecto: (id: number, data: { nombre: string; descripcion?: string | null }) => Promise<void>
  eliminarProyecto: (id: number) => Promise<void>

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
  actualizarEsAlimentador: (id: number, val: boolean) => void
  agregarAlimentador: (tableroId: number, nombre: string, insertIndex: number) => void
  appendSegmentos: (segs: Segmento[]) => void
  appendParedes: (paredes: Pared[]) => void
  actualizarFormacion: (circuitoId: number, data: FormacionPatch, cables: { fase: Cable; neutro: Cable | null; tierra: Cable | null }) => void
  agregarTablero: (data: any) => Promise<Tablero>
  duplicarTablero: (id: number) => Promise<Tablero>
  actualizarTablero: (id: number, data: Partial<Omit<Tablero, 'id' | 'circuitos'>>) => Promise<void>
  eliminarTablero: (id: number) => Promise<void>

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
  asignarCircuito: (segId: number, circId: number, circ: SegmentoCircuito) => void
  quitarCircuito: (segId: number, circId: number) => void
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
}
