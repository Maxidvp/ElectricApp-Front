'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getTableros } from '@/services/tableros'
import * as circuitosApi from '@/services/circuitos'
import * as tablerosApi from '@/services/tableros'

// ── Types ──────────────────────────────────────────────────────

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
  descipcion: string | null
  tablero_id: number
  formacion_id: number | null
  formacion: Formacion | null
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

// ── Temp ID ────────────────────────────────────────────────────
let _tempId = -1
const nextTempId = () => _tempId--

// ── Context type ───────────────────────────────────────────────
type TablerosContextType = {
  tableros: Tablero[]
  loading: boolean
  error: string | null
  recargar: () => void
  getTablero: (id: number) => Tablero | undefined
  getCircuito: (id: number) => Circuito | undefined

  // Optimistic mutations
  renombrarCircuito  : (id: number, nombre: string) => void
  agregarCircuito    : (tableroId: number) => void
  duplicarCircuito   : (circuitoId: number) => void
  eliminarCircuito   : (id: number) => void
  reordenarCircuitos   : (tableroId: number, orderedIds: number[]) => void
  actualizarDescripcion: (id: number, descipcion: string | null) => void
  actualizarFormacion  : (circuitoId: number, data: circuitosApi.FormacionPatch) => void
  agregarTablero     : (data: any) => Promise<Tablero>
}

const TablerosContext = createContext<TablerosContextType | null>(null)

// ── Immutable helpers ──────────────────────────────────────────
function mapCirc(tableros: Tablero[], circId: number, fn: (c: Circuito) => Circuito): Tablero[] {
  return tableros.map(t => ({
    ...t,
    circuitos: t.circuitos.map(c => c.id === circId ? fn(c) : c),
  }))
}

function addCirc(tableros: Tablero[], tableroId: number, circ: Circuito): Tablero[] {
  return tableros.map(t =>
    t.id === tableroId ? { ...t, circuitos: [...t.circuitos, circ] } : t
  )
}

function removeCirc(tableros: Tablero[], circId: number): Tablero[] {
  return tableros.map(t => ({ ...t, circuitos: t.circuitos.filter(c => c.id !== circId) }))
}

function replaceCirc(tableros: Tablero[], tempId: number, real: Circuito): Tablero[] {
  return tableros.map(t => ({
    ...t,
    circuitos: t.circuitos.map(c => c.id === tempId ? real : c),
  }))
}

// ── Provider ───────────────────────────────────────────────────
export function TablerosProvider({ children }: { children: React.ReactNode }) {
  const [tableros, setTableros] = useState<Tablero[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // tempId → promise resolving to real Circuito (so queued ops can wait)
  const pendingCircuitos = useRef<Map<number, Promise<Circuito>>>(new Map())

  const cargar = () => {
    setLoading(true)
    getTableros()
      .then(data => setTableros(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const getTablero  = (id: number) => tableros.find(t => t.id === id)
  const getCircuito = (id: number) => {
    for (const t of tableros) {
      const c = t.circuitos.find(c => c.id === id)
      if (c) return c
    }
  }

  // ── renombrarCircuito ──────────────────────────────────────
  function renombrarCircuito(id: number, nombre: string) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, circuito: nombre })))
    circuitosApi.updateNombreCircuito(id, nombre).catch(console.error)
  }

  // ── agregarCircuito ────────────────────────────────────────
  function agregarCircuito(tableroId: number) {
    const tablero = tableros.find(t => t.id === tableroId)
    if (!tablero) return

    const tempId = nextTempId()
    const tag    = `${tablero.tag}-C${tablero.circuitos.length + 1}`
    const temp: Circuito = { id: tempId, circuito: tag, descipcion: null, tablero_id: tableroId, formacion_id: null, formacion: null }

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

  // ── duplicarCircuito ───────────────────────────────────────
  function duplicarCircuito(circuitoId: number) {
    const tablero = tableros.find(t => t.circuitos.find(c => c.id === circuitoId))
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

  // ── actualizarFormacion ────────────────────────────────────
  function actualizarFormacion(circuitoId: number, data: circuitosApi.FormacionPatch) {
    // Partial optimistic: update what we can without cable objects
    setTableros(prev => mapCirc(prev, circuitoId, c => ({
      ...c,
      formacion: c.formacion ? {
        ...c.formacion,
        nombre:        data.nombre,
        cond_por_fase: data.cond_por_fase,
        Nfases:        data.Nfases,
        Nneutro:       data.Nneutro,
        cable_id:      data.cable_id,
        cable_neutro_id: data.cable_neutro_id,
        cable_tierra_id: data.cable_tierra_id,
      } : c.formacion,
    })))

    // API response has full cable objects → replace to get accurate seccion/area
    circuitosApi.updateFormacion(circuitoId, data)
      .then(real => {
        setTableros(prev => mapCirc(prev, circuitoId, () => real as Circuito))
      })
      .catch(console.error)
  }

  // ── eliminarCircuito ───────────────────────────────────────
  function eliminarCircuito(circuitoId: number) {
    setTableros(prev => removeCirc(prev, circuitoId))
    circuitosApi.deleteCircuito(circuitoId).catch(err => { console.error(err); cargar() })
  }

  // ── reordenarCircuitos ────────────────────────────────────
  function reordenarCircuitos(tableroId: number, orderedIds: number[]) {
    setTableros(prev => prev.map(t => {
      if (t.id !== tableroId) return t
      const byId = new Map(t.circuitos.map(c => [c.id, c]))
      return {
        ...t,
        circuitos: orderedIds.map((id, i) => ({ ...byId.get(id)!, orden: i })),
      }
    }))
    const ordenes = orderedIds.map((id, i) => ({ id, orden: i }))
    circuitosApi.reordenarCircuitos(ordenes).catch(console.error)
  }

  // ── actualizarDescripcion ──────────────────────────────────
  function actualizarDescripcion(id: number, descipcion: string | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, descipcion })))
    circuitosApi.updateDescripcionCircuito(id, descipcion).catch(console.error)
  }

  // ── agregarTablero ─────────────────────────────────────────
  async function agregarTablero(data: any): Promise<Tablero> {
    const real = await tablerosApi.createTablero(data) as Tablero
    setTableros(prev => [...prev, { ...real, circuitos: [] }])
    return real
  }

  return (
    <TablerosContext.Provider value={{
      tableros, loading, error,
      recargar: cargar,
      getTablero, getCircuito,
      renombrarCircuito, agregarCircuito, duplicarCircuito, eliminarCircuito,
      reordenarCircuitos, actualizarDescripcion, actualizarFormacion, agregarTablero,
    }}>
      {children}
    </TablerosContext.Provider>
  )
}

export function useTableros() {
  const ctx = useContext(TablerosContext)
  if (!ctx) throw new Error('useTableros debe usarse dentro de TablerosProvider')
  return ctx
}
