'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as ruteoApi    from '@/services/ruteo'
import * as tablerosApi from '@/services/tableros'
import * as proyectosApi from '@/services/proyectos'
import type { Canio, Bandeja, Segmento, Conjunto, Arquitectura, Pared } from '@/services/ruteo'
import { prefetchCablesFamilias } from '@/context/CablesContext'

import type { Tablero, Circuito, ProyectosContextType, ProyectoMeta } from './types'
import { deriveSegmentos } from './helpers'
import { useCircuitosActions } from './useCircuitosActions'
import { useRuteoActions } from './useRuteoActions'

export type { ProyectoMeta }
export type { Pared, Arquitectura }

// ── Context ───────────────────────────────────────────────────────
const ProyectosContext = createContext<ProyectosContextType | null>(null)

// ── Provider ──────────────────────────────────────────────────────
export function ProyectosProvider({ children }: { children: React.ReactNode }) {
  const [proyectos,           setProyectos]           = useState<ProyectoMeta[]>([])
  const [proyectoActivo,      setProyectoActivoState] = useState<ProyectoMeta | null>(null)
  const [tableros,            setTableros]            = useState<Tablero[]>([])
  const [conjuntos,           setConjuntos]           = useState<Conjunto[]>([])
  const [segmentos,           setSegmentos]           = useState<Segmento[]>([])
  const [canios,              setCanios]              = useState<Canio[]>([])
  const [bandejas,            setBandejas]            = useState<Bandeja[]>([])
  const [paredes,             setParedes]             = useState<Pared[]>([])
  const [tablaParedes,        setArquitecturaes]      = useState<Arquitectura[]>([])
  const [activeConjuntoId,    setActiveConjuntoIdState]    = useState<number | null>(null)
  const [activaArquitecturaId,setActivaArquitecturaIdState] = useState<number | null>(null)
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState<string | null>(null)

  const pendingCircuitos = useRef<Map<number, Promise<Circuito>>>(new Map())
  const pendingSegmentos = useRef<Map<number, Promise<Segmento>>>(new Map())
  const editVer          = useRef<Map<number, number>>(new Map())
  const proyectoActivoRef = useRef<ProyectoMeta | null>(null)

  const LS_PROYECTO    = 'ea_proyecto'
  const lsConjunto     = (id: number) => `ea_conjunto_${id}`
  const lsArquitectura = (id: number) => `ea_tabla_pared_${id}`

  const setActiveConjuntoId = (id: number) => {
    setActiveConjuntoIdState(id)
    if (proyectoActivoRef.current)
      localStorage.setItem(lsConjunto(proyectoActivoRef.current.id), String(id))
  }

  const setActivaArquitecturaId = (id: number | null) => {
    setActivaArquitecturaIdState(id)
    if (proyectoActivoRef.current) {
      if (id !== null) localStorage.setItem(lsArquitectura(proyectoActivoRef.current.id), String(id))
      else             localStorage.removeItem(lsArquitectura(proyectoActivoRef.current.id))
    }
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([proyectosApi.getProyectos(), ruteoApi.getCanios(), ruteoApi.getBandejas()])
      .then(([projs, cans, bans]) => {
        setProyectos(projs)
        setCanios(cans)
        setBandejas(bans)
        const savedId  = Number(localStorage.getItem(LS_PROYECTO)) || null
        const lastProj = savedId ? (projs.find(p => p.id === savedId) ?? null) : null
        if (lastProj) setProyectoActivo(lastProj)
        else          setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  // ── Carga del proyecto activo ─────────────────────────────────
  function setProyectoActivo(p: ProyectoMeta | null) {
    setProyectoActivoState(p)
    proyectoActivoRef.current = p
    if (!p) {
      localStorage.removeItem(LS_PROYECTO)
      setTableros([]); setConjuntos([]); setSegmentos([]); setParedes([]); setArquitecturaes([])
      setActiveConjuntoIdState(null); setActivaArquitecturaIdState(null)
      return
    }
    localStorage.setItem(LS_PROYECTO, String(p.id))
    setLoading(true)
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/proyectos/${p.id}`)
      .then(r => r.json())
      .then(data => {
        const tablerosList = data.tableros ?? []
        setTableros(tablerosList)

        const familiaIds = [...new Set<number>(
          tablerosList.flatMap((t: any) =>
            t.circuitos.flatMap((c: any) =>
              c.formacion?.cable?.familia_id != null ? [c.formacion.cable.familia_id] : []
            )
          )
        )]
        prefetchCablesFamilias(familiaIds)

        if (tablerosList.length > 0) {
          const cookieMatch = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
          const cookieId = cookieMatch ? Number(cookieMatch[1]) : null
          if (!cookieId || !tablerosList.find((t: any) => t.id === cookieId))
            document.cookie = `last_tablero_id=${tablerosList[0].id};path=/;max-age=31536000`
        }

        const conjs: Conjunto[] = (data.conjuntos ?? []).map((c: any) => ({
          id: c.id, nombre: c.nombre, tableros: c.tableros ?? [], arquitecturas: c.arquitecturas ?? [],
        }))
        setConjuntos(conjs)
        setSegmentos(deriveSegmentos(data.conjuntos ?? []))

        const tablas: Arquitectura[] = data.arquitecturas ?? []
        setArquitecturaes(tablas)
        setParedes(tablas.flatMap((tp: Arquitectura) => tp.paredes))

        const availableConjIds: number[] = (data.conjuntos ?? []).map((c: any) => c.id)
        const savedConjId  = Number(localStorage.getItem(lsConjunto(p.id))) || null
        const resolvedConj = savedConjId && availableConjIds.includes(savedConjId)
          ? savedConjId : (availableConjIds[0] ?? null)
        setActiveConjuntoIdState(resolvedConj)

        const availableTablaIds: number[] = tablas.map(tp => tp.id)
        const savedTablaId  = Number(localStorage.getItem(lsArquitectura(p.id))) || null
        const resolvedTabla = savedTablaId && availableTablaIds.includes(savedTablaId)
          ? savedTablaId : (availableTablaIds[0] ?? null)
        setActivaArquitecturaIdState(resolvedTabla)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  const recargar = () => { if (proyectoActivo) setProyectoActivo(proyectoActivo) }

  // ── Proyectos CRUD ────────────────────────────────────────────
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

  // ── Tableros CRUD ─────────────────────────────────────────────
  const getTablero  = (id: number) => tableros.find(t => t.id === id)
  const getCircuito = (id: number) => {
    for (const t of tableros) {
      const c = t.circuitos.find(c => c.id === id)
      if (c) return c
    }
  }

  async function agregarTablero(data: any): Promise<Tablero> {
    const real = await tablerosApi.createTablero({ ...data, proyecto_id: proyectoActivo?.id ?? null }) as Tablero
    setTableros(prev => [...prev, { ...real, circuitos: [] }])
    return real
  }

  async function duplicarTablero(id: number): Promise<Tablero> {
    const real = await tablerosApi.duplicarTablero(id) as Tablero
    setTableros(prev => [...prev, { ...real, circuitos: real.circuitos ?? [] }])
    return real
  }

  async function actualizarTablero(id: number, data: Partial<Omit<Tablero, 'id' | 'circuitos'>>) {
    setTableros(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    await tablerosApi.updateTablero(id, data).catch(console.error)
  }

  async function eliminarTablero(id: number) {
    setTableros(prev => prev.filter(t => t.id !== id))
    await tablerosApi.deleteTablero(id).catch(console.error)
  }

  // ── Domain action hooks ───────────────────────────────────────
  const circuitos = useCircuitosActions(tableros, setTableros, pendingCircuitos, recargar)

  const ruteo = useRuteoActions(
    conjuntos, canios, bandejas, tablaParedes,
    activeConjuntoId, activaArquitecturaId,
    proyectoActivo,
    setSegmentos, setConjuntos, setParedes, setArquitecturaes,
    setActiveConjuntoId, setActivaArquitecturaId,
    pendingSegmentos, editVer,
  )

  return (
    <ProyectosContext.Provider value={{
      proyectos, proyectoActivo, setProyectoActivo,
      crearProyecto, actualizarProyecto, eliminarProyecto,
      tableros, loading, error, recargar,
      getTablero, getCircuito,
      agregarTablero, duplicarTablero, actualizarTablero, eliminarTablero,
      ...circuitos,
      segmentos, canios, bandejas, conjuntos,
      activeConjuntoId, setActiveConjuntoId,
      paredes, tablaParedes, activaArquitecturaId, setActivaArquitecturaId,
      ...ruteo,
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
