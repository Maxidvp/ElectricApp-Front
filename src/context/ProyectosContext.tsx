'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as ruteoApi from '@/services/ruteo'
import * as circuitosApi from '@/services/circuitos'
import * as tablerosApi from '@/services/tableros'
import * as proyectosApi from '@/services/proyectos'
import type { Canio, Bandeja, Segmento, SegmentoCircuito, Conjunto, CreateSegmentoInput, Pared, CreateParedInput, Arquitectura } from '@/services/ruteo'
import type { FormacionPatch } from '@/services/circuitos'
import type { Proyecto as ProyectoMeta } from '@/services/proyectos'

export type { ProyectoMeta }
export type { Pared, Arquitectura }

// ── Types ───────────────────────────────────────────────────────

type Cable = {
  id: number
  nombre: string
  seccion_f: string
  diametro: number | null
  calibre_tipo: string
  familia_id: number
}

type Formacion = {
  id: number
  nombre: string
  cable_id: number
  cond_por_fase: number
  Nfases: number
  Nneutro: number
  cable_neutro_id: number | null
  cable_tierra_id: number | null
  cable: Cable
  cable_neutro: Cable | null
  cable_tierra: Cable | null
}

type Circuito = {
  id: number
  circuito: string
  descripcion: string | null
  tablero_id: number
  formacion_id: number | null
  formacion: Formacion | null
  FP: number | null
  Largo: number | null
}

type Tablero = {
  id: number
  tag: string
  sistema_tension: string
  nombre: string | null
  ubicacion: string | null
  tipo: string | null
  tension_fase: number | null
  tension_neutro: number | null
  frecuencia: number | null
  corriente_nom: number | null
  corriente_cc: number | null
  potencia_inst: number | null
  potencia_dem: number | null
  fabricante: string | null
  modelo: string | null
  norma: string | null
  grado_proteccion: string | null
  alimentado_por: string | null
  circuitos: Circuito[]
}

type SegPatch = Partial<Omit<Segmento, 'canio' | 'bandeja' | 'circuitos' | 'conjuntos'>>

// ── Temp IDs ─────────────────────────────────────────────────────
let _tempId = -1
const nextTempId = () => _tempId--

// ── Immutable helpers ─────────────────────────────────────────────
function mapCirc(tableros: Tablero[], circId: number, fn: (c: Circuito) => Circuito): Tablero[] {
  return tableros.map(t => ({ ...t, circuitos: t.circuitos.map(c => c.id === circId ? fn(c) : c) }))
}
function addCirc(tableros: Tablero[], tableroId: number, circ: Circuito): Tablero[] {
  return tableros.map(t => t.id === tableroId ? { ...t, circuitos: [...t.circuitos, circ] } : t)
}
function removeCirc(tableros: Tablero[], circId: number): Tablero[] {
  return tableros.map(t => ({ ...t, circuitos: t.circuitos.filter(c => c.id !== circId) }))
}
function replaceCirc(tableros: Tablero[], tempId: number, real: Circuito): Tablero[] {
  return tableros.map(t => ({ ...t, circuitos: t.circuitos.map(c => c.id === tempId ? real : c) }))
}
function deriveSegmentos(conjuntos: (Conjunto & { segmentos?: Segmento[] })[]): Segmento[] {
  const map = new Map<number, Segmento>()
  for (const c of conjuntos) {
    for (const s of (c as any).segmentos ?? []) {
      if (!map.has(s.id)) map.set(s.id, s)
    }
  }
  return Array.from(map.values())
}

// ── Context type ──────────────────────────────────────────────────
type ProyectosContextType = {
  // Project management
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
  agregarCircuito: (tableroId: number) => void
  duplicarCircuito: (circuitoId: number) => void
  eliminarCircuito: (id: number) => void
  reordenarCircuitos: (tableroId: number, orderedIds: number[]) => void
  actualizarDescripcion: (id: number, descripcion: string | null) => void
  actualizarFP: (id: number, fp: number | null) => void
  actualizarLargo: (id: number, largo: number | null) => void
  actualizarFormacion: (circuitoId: number, data: FormacionPatch) => void
  agregarTablero: (data: any) => Promise<Tablero>

  // Segmentos & conjuntos
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
  asignarCircuito: (segId: number, circId: number, circ: SegmentoCircuito) => void
  quitarCircuito: (segId: number, circId: number) => void
  addConjunto: (nombre: string) => void
  renameConjunto: (id: number, nombre: string) => void
  deleteConjunto: (id: number) => void
  addSegmentoToConjunto: (segId: number, conjuntoId: number) => void
  removeSegmentoFromConjunto: (segId: number, conjuntoId: number) => void
  addTableroToConjunto: (conjuntoId: number, tableroId: number) => void
  removeTableroFromConjunto: (conjuntoId: number, tableroId: number) => void

  // Paredes
  paredes: Pared[]
  addPared: (data: CreateParedInput) => void
  editPared: (id: number, patch: Partial<Omit<Pared, 'id'>>) => void
  removePared: (id: number) => void

  // Tablas de paredes
  tablaParedes: Arquitectura[]
  activaArquitecturaId: number | null
  setActivaArquitecturaId: (id: number | null) => void
  addArquitectura: (nombre: string) => void
  renameArquitectura: (id: number, nombre: string) => void
  deleteArquitectura: (id: number) => void
  addArquitecturaToConjunto: (tablaParedId: number, conjuntoId: number) => void
  removeArquitecturaFromConjunto: (tablaParedId: number, conjuntoId: number) => void
}

const ProyectosContext = createContext<ProyectosContextType | null>(null)

// ── Provider ──────────────────────────────────────────────────────
export function ProyectosProvider({ children }: { children: React.ReactNode }) {
  const [proyectos,      setProyectos]      = useState<ProyectoMeta[]>([])
  const [proyectoActivo, setProyectoActivoState] = useState<ProyectoMeta | null>(null)

  const [tableros,           setTableros]           = useState<Tablero[]>([])
  const [conjuntos,          setConjuntos]          = useState<Conjunto[]>([])
  const [segmentos,          setSegmentos]          = useState<Segmento[]>([])
  const [canios,             setCanios]             = useState<Canio[]>([])
  const [bandejas,           setBandejas]           = useState<Bandeja[]>([])
  const [paredes,            setParedes]            = useState<Pared[]>([])
  const [tablaParedes,       setArquitecturaes]       = useState<Arquitectura[]>([])
  const [activeConjuntoId,   setActiveConjuntoIdState]   = useState<number | null>(null)
  const [activaArquitecturaId, setActivaArquitecturaIdState] = useState<number | null>(null)
  const [loading,            setLoading]            = useState(true)
  const [error,              setError]              = useState<string | null>(null)

  const pendingCircuitos = useRef<Map<number, Promise<Circuito>>>(new Map())
  const pendingSegmentos = useRef<Map<number, Promise<Segmento>>>(new Map())
  const editVer          = useRef<Map<number, number>>(new Map())
  const proyectoActivoRef = useRef<ProyectoMeta | null>(null)

  const LS_PROYECTO   = 'ea_proyecto'
  const lsConjunto    = (id: number) => `ea_conjunto_${id}`
  const lsArquitectura  = (id: number) => `ea_tabla_pared_${id}`

  const setActiveConjuntoId = (id: number) => {
    setActiveConjuntoIdState(id)
    if (proyectoActivoRef.current) {
      localStorage.setItem(lsConjunto(proyectoActivoRef.current.id), String(id))
    }
  }

  const setActivaArquitecturaId = (id: number | null) => {
    setActivaArquitecturaIdState(id)
    if (proyectoActivoRef.current) {
      if (id !== null) localStorage.setItem(lsArquitectura(proyectoActivoRef.current.id), String(id))
      else localStorage.removeItem(lsArquitectura(proyectoActivoRef.current.id))
    }
  }

  // ── Bootstrap: project list + catalog ────────────────────────
  useEffect(() => {
    Promise.all([
      proyectosApi.getProyectos(),
      ruteoApi.getCanios(),
      ruteoApi.getBandejas(),
    ])
      .then(([projs, cans, bans]) => {
        setProyectos(projs)
        setCanios(cans)
        setBandejas(bans)
        const savedId  = Number(localStorage.getItem(LS_PROYECTO)) || null
        const lastProj = savedId ? (projs.find(p => p.id === savedId) ?? null) : null
        if (lastProj) {
          setProyectoActivo(lastProj) // su propio finally maneja setLoading(false)
        } else {
          setLoading(false)
        }
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  // ── Load full project data when active project changes ────────
  function setProyectoActivo(p: ProyectoMeta | null) {
    setProyectoActivoState(p)
    proyectoActivoRef.current = p
    if (!p) {
      localStorage.removeItem(LS_PROYECTO)
      setTableros([])
      setConjuntos([])
      setSegmentos([])
      setParedes([])
      setArquitecturaes([])
      setActiveConjuntoIdState(null)
      setActivaArquitecturaIdState(null)
      return
    }
    localStorage.setItem(LS_PROYECTO, String(p.id))
    setLoading(true)
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/proyectos/${p.id}`)
      .then(r => r.json())
      .then(data => {
        setTableros(data.tableros ?? [])

        const conjs: Conjunto[] = (data.conjuntos ?? []).map((c: any) => ({
          id: c.id,
          nombre: c.nombre,
          tableros: c.tableros ?? [],
          arquitecturas: c.arquitecturas ?? [],
        }))
        setConjuntos(conjs)
        setSegmentos(deriveSegmentos(data.conjuntos ?? []))

        const tablas: Arquitectura[] = data.arquitecturas ?? []
        setArquitecturaes(tablas)
        setParedes(tablas.flatMap((tp: Arquitectura) => tp.paredes))

        // Restore active conjunto
        const availableConjIds: number[] = (data.conjuntos ?? []).map((c: any) => c.id)
        const savedConjId  = Number(localStorage.getItem(lsConjunto(p.id))) || null
        const resolvedConj = savedConjId && availableConjIds.includes(savedConjId)
          ? savedConjId : (availableConjIds[0] ?? null)
        setActiveConjuntoIdState(resolvedConj)

        // Restore active tabla de paredes
        const availableTablaIds: number[] = tablas.map(tp => tp.id)
        const savedTablaId  = Number(localStorage.getItem(lsArquitectura(p.id))) || null
        const resolvedTabla = savedTablaId && availableTablaIds.includes(savedTablaId)
          ? savedTablaId : (availableTablaIds[0] ?? null)
        setActivaArquitecturaIdState(resolvedTabla)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  const recargar = () => {
    if (proyectoActivo) setProyectoActivo(proyectoActivo)
  }

  // ── Project CRUD ─────────────────────────────────────────────
  async function crearProyecto(data: { nombre: string; descripcion?: string | null }) {
    const nuevo = await proyectosApi.createProyecto(data)
    setProyectos(prev => [...prev, nuevo])
    return nuevo
  }

  async function actualizarProyecto(id: number, data: { nombre: string; descripcion?: string | null }) {
    const updated = await proyectosApi.updateProyecto(id, data)
    setProyectos(prev => prev.map(p => p.id === id ? updated : p))
    if (proyectoActivo?.id === id) setProyectoActivoState(updated)
  }

  async function eliminarProyecto(id: number) {
    await proyectosApi.deleteProyecto(id)
    setProyectos(prev => prev.filter(p => p.id !== id))
    if (proyectoActivo?.id === id) setProyectoActivo(null)
  }

  // ── Getters ──────────────────────────────────────────────────
  const getTablero  = (id: number) => tableros.find(t => t.id === id)
  const getCircuito = (id: number) => {
    for (const t of tableros) {
      const c = t.circuitos.find(c => c.id === id)
      if (c) return c
    }
  }

  // ── Circuito mutations ───────────────────────────────────────
  function renombrarCircuito(id: number, nombre: string) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, circuito: nombre })))
    circuitosApi.updateNombreCircuito(id, nombre).catch(console.error)
  }

  function agregarCircuito(tableroId: number) {
    const tablero = tableros.find(t => t.id === tableroId)
    if (!tablero) return
    const tempId = nextTempId()
    const tag    = `${tablero.tag}-C${tablero.circuitos.length + 1}`
    const temp: Circuito = { id: tempId, circuito: tag, descripcion: null, tablero_id: tableroId, formacion_id: null, formacion: null, FP: null, Largo: null }
    setTableros(prev => addCirc(prev, tableroId, temp))
    const promise = circuitosApi.crearCircuitoVacio(tableroId)
      .then(real => {
        setTableros(prev => replaceCirc(prev, tempId, real as Circuito))
        pendingCircuitos.current.delete(tempId)
        return real as Circuito
      })
      .catch(err => { console.error(err); return temp })
    pendingCircuitos.current.set(tempId, promise)
  }

  function duplicarCircuito(circuitoId: number) {
    const tablero  = tableros.find(t => t.circuitos.find(c => c.id === circuitoId))
    const original = tablero?.circuitos.find(c => c.id === circuitoId)
    if (!tablero || !original) return
    const tempId = nextTempId()
    const tag    = `${tablero.tag}-C${tablero.circuitos.length + 1}`
    const temp: Circuito = { ...original, id: tempId, circuito: tag }
    setTableros(prev => addCirc(prev, tablero.id, temp))
    const promise = circuitosApi.duplicarCircuito(circuitoId)
      .then(real => {
        setTableros(prev => replaceCirc(prev, tempId, real as Circuito))
        pendingCircuitos.current.delete(tempId)
        return real as Circuito
      })
      .catch(err => { console.error(err); return temp })
    pendingCircuitos.current.set(tempId, promise)
  }

  function eliminarCircuito(circuitoId: number) {
    setTableros(prev => removeCirc(prev, circuitoId))
    circuitosApi.deleteCircuito(circuitoId).catch(err => { console.error(err); recargar() })
  }

  function reordenarCircuitos(tableroId: number, orderedIds: number[]) {
    setTableros(prev => prev.map(t => {
      if (t.id !== tableroId) return t
      const byId = new Map(t.circuitos.map(c => [c.id, c]))
      return { ...t, circuitos: orderedIds.map((id, i) => ({ ...byId.get(id)!, orden: i })) }
    }))
    circuitosApi.reordenarCircuitos(orderedIds.map((id, i) => ({ id, orden: i }))).catch(console.error)
  }

  function actualizarDescripcion(id: number, descripcion: string | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, descripcion })))
    circuitosApi.updateDescripcionCircuito(id, descripcion).catch(console.error)
  }

  function actualizarFP(id: number, fp: number | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, FP: fp })))
    circuitosApi.updateFPCircuito(id, fp).catch(console.error)
  }

  function actualizarLargo(id: number, largo: number | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, Largo: largo })))
    circuitosApi.updateLargoCircuito(id, largo).catch(console.error)
  }

  function actualizarFormacion(circuitoId: number, data: FormacionPatch) {
    setTableros(prev => mapCirc(prev, circuitoId, c => ({
      ...c,
      formacion: c.formacion ? { ...c.formacion, ...data } : c.formacion,
    })))
    circuitosApi.updateFormacion(circuitoId, data)
      .then(real => setTableros(prev => mapCirc(prev, circuitoId, () => real as Circuito)))
      .catch(console.error)
  }

  async function agregarTablero(data: any): Promise<Tablero> {
    const real = await tablerosApi.createTablero({
      ...data,
      proyecto_id: proyectoActivo?.id ?? null,
    }) as Tablero
    setTableros(prev => [...prev, { ...real, circuitos: [] }])
    return real
  }

  // ── Segmento helpers ─────────────────────────────────────────
  function resolveSegPatch(patch: SegPatch, prev: Segmento): Segmento {
    const next: Segmento = { ...prev, ...patch }
    if ('canio_id'   in patch) next.canio   = patch.canio_id   != null ? (canios.find(c => c.id === patch.canio_id)     ?? null) : null
    if ('bandeja_id' in patch) next.bandeja = patch.bandeja_id != null ? (bandejas.find(b => b.id === patch.bandeja_id) ?? null) : null
    return next
  }

  // ── Segmento mutations ───────────────────────────────────────
  function addSegmento(data: CreateSegmentoInput) {
    const tempId = nextTempId()
    const conjOptimistic = (data.conjunto_ids ?? [])
      .map(id => conjuntos.find(c => c.id === id))
      .filter(Boolean) as Conjunto[]
    const optimistic: Segmento = {
      ...data, color: data.color ?? null, id: tempId,
      canio:     data.canio_id   != null ? (canios.find(c => c.id === data.canio_id)     ?? null) : null,
      bandeja:   data.bandeja_id != null ? (bandejas.find(b => b.id === data.bandeja_id) ?? null) : null,
      circuitos: [],
      conjuntos: conjOptimistic,
    }
    setSegmentos(prev => [...prev, optimistic])
    const promise = ruteoApi.createSegmento(data)
      .then(real => {
        setSegmentos(prev => prev.map(s => s.id === tempId ? real : s))
        pendingSegmentos.current.delete(tempId)
        return real
      })
      .catch(err => { console.error(err); return optimistic })
    pendingSegmentos.current.set(tempId, promise)
  }

  function previewSegmento(id: number, patch: SegPatch) {
    setSegmentos(prev => prev.map(s => s.id === id ? resolveSegPatch(patch, s) : s))
  }

  function editSegmento(id: number, patch: SegPatch) {
    setSegmentos(prev => prev.map(s => s.id === id ? resolveSegPatch(patch, s) : s))
    const fire = (realId: number) => {
      const ver = (editVer.current.get(realId) ?? 0) + 1
      editVer.current.set(realId, ver)
      ruteoApi.updateSegmento(realId, patch).then(real => {
        if (editVer.current.get(realId) === ver) {
          editVer.current.delete(realId)
          setSegmentos(prev => prev.map(s => s.id === realId ? real : s))
        }
      }).catch(console.error)
    }
    if (id < 0 && pendingSegmentos.current.has(id)) {
      pendingSegmentos.current.get(id)!.then(real => fire(real.id))
    } else {
      fire(id)
    }
  }

  function removeSegmento(id: number) {
    setSegmentos(prev => prev.filter(s => s.id !== id))
    const fire = (realId: number) => ruteoApi.deleteSegmento(realId).catch(console.error)
    if (id < 0 && pendingSegmentos.current.has(id)) {
      pendingSegmentos.current.get(id)!.then(real => fire(real.id))
    } else {
      fire(id)
    }
  }

  function asignarCircuito(segId: number, circId: number, circ: SegmentoCircuito) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId && !s.circuitos.find(c => c.id === circId)
        ? { ...s, circuitos: [...s.circuitos, circ] } : s
    ))
    const fire = (realId: number) =>
      ruteoApi.addCircuitoToSegmento(realId, circId)
        .then(real => setSegmentos(prev => prev.map(s => s.id === realId ? real : s)))
        .catch(console.error)
    if (segId < 0 && pendingSegmentos.current.has(segId)) {
      pendingSegmentos.current.get(segId)!.then(real => fire(real.id))
    } else { fire(segId) }
  }

  function quitarCircuito(segId: number, circId: number) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId ? { ...s, circuitos: s.circuitos.filter(c => c.id !== circId) } : s
    ))
    const fire = (realId: number) =>
      ruteoApi.removeCircuitoFromSegmento(realId, circId)
        .then(real => setSegmentos(prev => prev.map(s => s.id === realId ? real : s)))
        .catch(console.error)
    if (segId < 0 && pendingSegmentos.current.has(segId)) {
      pendingSegmentos.current.get(segId)!.then(real => fire(real.id))
    } else { fire(segId) }
  }

  // ── Conjunto mutations ───────────────────────────────────────
  function addConjunto(nombre: string) {
    ruteoApi.createConjunto(nombre, proyectoActivo?.id)
      .then(real => {
        setConjuntos(prev => [...prev, real])
        setActiveConjuntoId(real.id as number)
      })
      .catch(console.error)
  }

  function renameConjunto(id: number, nombre: string) {
    setConjuntos(prev => prev.map(c => c.id === id ? { ...c, nombre } : c))
    setSegmentos(prev => prev.map(s => ({
      ...s,
      conjuntos: s.conjuntos.map(c => c.id === id ? { ...c, nombre } : c),
    })))
    ruteoApi.updateConjunto(id, nombre).catch(console.error)
  }

  function deleteConjunto(id: number) {
    if (conjuntos.length <= 1) return
    const remaining = conjuntos.filter(c => c.id !== id)
    setConjuntos(remaining)
    setSegmentos(prev => prev.map(s => ({ ...s, conjuntos: s.conjuntos.filter(c => c.id !== id) })))
    if (activeConjuntoId === id) setActiveConjuntoId(remaining[0].id as number)
    ruteoApi.deleteConjunto(id).catch(console.error)
  }

  function addSegmentoToConjunto(segId: number, conjuntoId: number) {
    const conjunto = conjuntos.find(c => c.id === conjuntoId)
    if (!conjunto) return
    setSegmentos(prev => prev.map(s =>
      s.id === segId && !s.conjuntos.find(c => c.id === conjuntoId)
        ? { ...s, conjuntos: [...s.conjuntos, conjunto] } : s
    ))
    const fire = (realId: number) => ruteoApi.addSegmentoToConjunto(realId, conjuntoId).catch(console.error)
    if (segId < 0 && pendingSegmentos.current.has(segId)) {
      pendingSegmentos.current.get(segId)!.then(real => fire(real.id))
    } else { fire(segId) }
  }

  function removeSegmentoFromConjunto(segId: number, conjuntoId: number) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId ? { ...s, conjuntos: s.conjuntos.filter(c => c.id !== conjuntoId) } : s
    ))
    const fire = (realId: number) => ruteoApi.removeSegmentoFromConjunto(realId, conjuntoId).catch(console.error)
    if (segId < 0 && pendingSegmentos.current.has(segId)) {
      pendingSegmentos.current.get(segId)!.then(real => fire(real.id))
    } else { fire(segId) }
  }

  function addTableroToConjunto(conjuntoId: number, tableroId: number) {
    ruteoApi.addTableroToConjunto(conjuntoId, tableroId)
      .then(updated => setConjuntos(prev => prev.map(c => c.id === conjuntoId ? updated : c)))
      .catch(console.error)
  }

  function removeTableroFromConjunto(conjuntoId: number, tableroId: number) {
    setConjuntos(prev => prev.map(c =>
      c.id === conjuntoId ? { ...c, tableros: c.tableros.filter(t => t.id !== tableroId) } : c
    ))
    ruteoApi.removeTableroFromConjunto(conjuntoId, tableroId).catch(console.error)
  }

  // ── Pared mutations ──────────────────────────────────────────
  function addPared(data: CreateParedInput) {
    const tempId = nextTempId()
    const optimistic: Pared = { ...data, id: tempId }
    setParedes(prev => [...prev, optimistic])
    ruteoApi.createPared(data)
      .then(real => {
        setParedes(prev => prev.map(p => p.id === tempId ? real : p))
        setArquitecturaes(prev => prev.map(tp =>
          tp.id === real.tabla_pared_id
            ? { ...tp, paredes: [...tp.paredes.filter(p => p.id !== tempId), real] }
            : tp
        ))
      })
      .catch(err => { console.error(err); setParedes(prev => prev.filter(p => p.id !== tempId)) })
  }

  function editPared(id: number, patch: Partial<Omit<Pared, 'id'>>) {
    setParedes(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
    ruteoApi.updatePared(id, patch)
      .then(real => setParedes(prev => prev.map(p => p.id === id ? real : p)))
      .catch(console.error)
  }

  function removePared(id: number) {
    setParedes(prev => prev.filter(p => p.id !== id))
    setArquitecturaes(prev => prev.map(tp => ({ ...tp, paredes: tp.paredes.filter(p => p.id !== id) })))
    ruteoApi.deletePared(id).catch(console.error)
  }

  // ── Arquitectura mutations ─────────────────────────────────────
  function addArquitectura(nombre: string) {
    if (!proyectoActivo) return
    ruteoApi.createArquitectura(nombre, proyectoActivo.id)
      .then(real => {
        setArquitecturaes(prev => [...prev, real])
        setActivaArquitecturaId(real.id)
      })
      .catch(console.error)
  }

  function renameArquitectura(id: number, nombre: string) {
    setArquitecturaes(prev => prev.map(tp => tp.id === id ? { ...tp, nombre } : tp))
    ruteoApi.updateArquitectura(id, nombre).catch(console.error)
  }

  function deleteArquitectura(id: number) {
    setArquitecturaes(prev => prev.filter(tp => tp.id !== id))
    setParedes(prev => prev.filter(p => p.tabla_pared_id !== id))
    setConjuntos(prev => prev.map(c => ({
      ...c,
      arquitecturas: c.arquitecturas.filter(tp => tp.id !== id),
    })))
    if (activaArquitecturaId === id) {
      const remaining = tablaParedes.filter(tp => tp.id !== id)
      setActivaArquitecturaId(remaining[0]?.id ?? null)
    }
    ruteoApi.deleteArquitectura(id).catch(console.error)
  }

  function addArquitecturaToConjunto(tablaParedId: number, conjuntoId: number) {
    setArquitecturaes(prev => prev.map(tp =>
      tp.id === tablaParedId && !tp.conjuntos.some(c => c.id === conjuntoId)
        ? { ...tp, conjuntos: [...tp.conjuntos, { id: conjuntoId }] }
        : tp
    ))
    setConjuntos(prev => prev.map(c =>
      c.id === conjuntoId && !c.arquitecturas.some(tp => tp.id === tablaParedId)
        ? { ...c, arquitecturas: [...c.arquitecturas, { id: tablaParedId }] }
        : c
    ))
    ruteoApi.addArquitecturaToConjunto(tablaParedId, conjuntoId).catch(console.error)
  }

  function removeArquitecturaFromConjunto(tablaParedId: number, conjuntoId: number) {
    setArquitecturaes(prev => prev.map(tp =>
      tp.id === tablaParedId
        ? { ...tp, conjuntos: tp.conjuntos.filter(c => c.id !== conjuntoId) }
        : tp
    ))
    setConjuntos(prev => prev.map(c =>
      c.id === conjuntoId
        ? { ...c, arquitecturas: c.arquitecturas.filter(tp => tp.id !== tablaParedId) }
        : c
    ))
    ruteoApi.removeArquitecturaFromConjunto(tablaParedId, conjuntoId).catch(console.error)
  }

  return (
    <ProyectosContext.Provider value={{
      proyectos, proyectoActivo, setProyectoActivo,
      crearProyecto, actualizarProyecto, eliminarProyecto,
      tableros, loading, error, recargar,
      getTablero, getCircuito,
      renombrarCircuito, agregarCircuito, duplicarCircuito, eliminarCircuito,
      reordenarCircuitos, actualizarDescripcion, actualizarFP, actualizarLargo, actualizarFormacion, agregarTablero,
      segmentos, canios, bandejas, conjuntos, activeConjuntoId, setActiveConjuntoId,
      addSegmento, previewSegmento, editSegmento, removeSegmento,
      asignarCircuito, quitarCircuito,
      addConjunto, renameConjunto, deleteConjunto,
      addSegmentoToConjunto, removeSegmentoFromConjunto,
      addTableroToConjunto, removeTableroFromConjunto,
      paredes, addPared, editPared, removePared,
      tablaParedes, activaArquitecturaId, setActivaArquitecturaId,
      addArquitectura, renameArquitectura, deleteArquitectura,
      addArquitecturaToConjunto, removeArquitecturaFromConjunto,
    }}>
      {children}
    </ProyectosContext.Provider>
  )
}

export function useProyectos() {
  const ctx = useContext(ProyectosContext)
  if (!ctx) throw new Error('useProyectos debe usarse dentro de ProyectosProvider')
  return ctx
}
