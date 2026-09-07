'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useToast } from '@/context/ToastContext'
import * as ruteoApi    from '@/services/ruteo'
import * as tablerosApi from '@/services/tableros'
import * as proyectosApi from '@/services/proyectos'
import * as fuentesApi  from '@/services/fuentesAlimentacion'
import * as gruposDiferencialesApi from '@/services/gruposDiferenciales'
import * as circuitosApi from '@/services/circuitos'
import * as lazosApi    from '@/services/lazosInstrumentacion'
import * as puertosRedApi from '@/services/puertosRed'
import { apiFetch } from '@/services/apiFetch'
import type { Canio, Bandeja, Segmento, Conjunto, Arquitectura, Pared } from '@/services/ruteo'
import type { Caniero } from '@/services/canieros'
import { prefetchCablesFamilias } from '@/context/CablesContext'
import { getLastTableroId, setLastTableroId } from '@/utils/cookies'
import { useAuth } from '@/context/AuthContext'

import type { Tablero, Circuito, FuenteAlimentacion, GrupoDiferencial, LazoInstrumentacion, PuertoRed, ProyectosContextType, ProyectoMeta } from './types'
import { deriveSegmentos, nextTempId, DESCRIPCION_CREANDO, mapCirc } from './helpers'
import { useCircuitosActions } from './useCircuitosActions'
import { useRuteoActions } from './useRuteoActions'

export type { ProyectoMeta }
export type { Pared, Arquitectura }
export type { FuenteAlimentacion, GrupoDiferencial }
export type { LazoInstrumentacion, PuertoRed }

// ── Context ───────────────────────────────────────────────────────
const ProyectosContext = createContext<ProyectosContextType | null>(null)

// ── Provider ──────────────────────────────────────────────────────
export function ProyectosProvider({ children }: { children: React.ReactNode }) {
  const { showError } = useToast()
  const [proyectos,           setProyectos]           = useState<ProyectoMeta[]>([])
  const [proyectoActivo,      setProyectoActivoState] = useState<ProyectoMeta | null>(null)
  const [tableros,            setTableros]            = useState<Tablero[]>([])
  const [conjuntos,           setConjuntos]           = useState<Conjunto[]>([])
  const [segmentos,           setSegmentos]           = useState<Segmento[]>([])
  const [canios,              setCanios]              = useState<Canio[]>([])
  const [bandejas,            setBandejas]            = useState<Bandeja[]>([])
  const [paredes,             setParedes]             = useState<Pared[]>([])
  const [tablaParedes,        setArquitecturaes]      = useState<Arquitectura[]>([])
  const [canieros,            setCanieros]            = useState<Caniero[]>([])
  const [activeConjuntoId,    setActiveConjuntoIdState]    = useState<number | null>(null)
  const [activaArquitecturaId,setActivaArquitecturaIdState] = useState<number | null>(null)
  const [loading,             setLoading]             = useState(true)
  const [error,               setError]               = useState<string | null>(null)

  const { usuario, loading: authLoading } = useAuth()

  const pendingCircuitos = useRef<Map<number, Promise<Circuito>>>(new Map())
  const pendingSegmentos = useRef<Map<number, Promise<Segmento>>>(new Map())
  const editVer          = useRef<Map<number, number>>(new Map())
  const proyectoActivoRef = useRef<ProyectoMeta | null>(null)

  const LS_PROYECTO    = 'ea_proyecto'
  const lsConjunto     = (id: number) => `ea_conjunto_${id}`
  const lsArquitectura = (id: number) => `ea_tabla_pared_${id}`

  const setActiveConjuntoId = (id: number) => {
    setActiveConjuntoIdState(id)
    if (proyectoActivoRef.current && id > 0)
      localStorage.setItem(lsConjunto(proyectoActivoRef.current.id), String(id))
    // Always sync arquitectura to whichever is linked to this conjunto (null if none)
    const conj = conjuntos.find(c => c.id === id)
    const linkedArqId = conj?.arquitecturas?.[0]?.id ?? null
    setActivaArquitecturaIdState(linkedArqId)
    if (proyectoActivoRef.current) {
      if (linkedArqId !== null) localStorage.setItem(lsArquitectura(proyectoActivoRef.current.id), String(linkedArqId))
      else                      localStorage.removeItem(lsArquitectura(proyectoActivoRef.current.id))
    }
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
    if (authLoading) return
    if (!usuario) { setLoading(false); return }
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
  }, [authLoading, usuario])

  // ── Carga del proyecto activo ─────────────────────────────────
  function setProyectoActivo(p: ProyectoMeta | null) {
    setProyectoActivoState(p)
    proyectoActivoRef.current = p
    if (!p) {
      localStorage.removeItem(LS_PROYECTO)
      setTableros([]); setConjuntos([]); setSegmentos([]); setParedes([]); setArquitecturaes([]); setCanieros([])
      setActiveConjuntoIdState(null); setActivaArquitecturaIdState(null)
      return
    }
    localStorage.setItem(LS_PROYECTO, String(p.id))
    setLoading(true)
    apiFetch(`/proyectos/${p.id}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() })
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
          const cookieId = getLastTableroId()
          if (!cookieId || !tablerosList.find((t: any) => t.id === cookieId))
            setLastTableroId(tablerosList[0].id)
        }

        const conjs: Conjunto[] = (data.conjuntos ?? []).map((c: any) => ({
          id: c.id, nombre: c.nombre, tableros: c.tableros ?? [], arquitecturas: c.arquitecturas ?? [],
        }))
        setConjuntos(conjs)
        setSegmentos(deriveSegmentos(data.conjuntos ?? []))

        const tablas: Arquitectura[] = data.arquitecturas ?? []
        setArquitecturaes(tablas)
        setParedes(tablas.flatMap((tp: Arquitectura) => tp.paredes))

        setCanieros(data.canieros ?? [])

        const availableConjIds: number[] = (data.conjuntos ?? []).map((c: any) => c.id)
        const savedConjId  = Number(localStorage.getItem(lsConjunto(p.id))) || null
        const resolvedConj = savedConjId && availableConjIds.includes(savedConjId)
          ? savedConjId : (availableConjIds[0] ?? null)
        setActiveConjuntoIdState(resolvedConj)

        // Derive active arquitectura from the resolved conjunto's linked one
        const activeConjData = (data.conjuntos ?? []).find((c: any) => c.id === resolvedConj)
        const resolvedTabla  = (activeConjData?.arquitecturas?.[0]?.id as number | undefined) ?? null
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

  async function actualizarProyecto(id: number, data: { nombre: string; descripcion?: string | null; formato_formacion?: string; nomenclatura_fases?: string }) {
    const updated = await proyectosApi.updateProyecto(id, data)
    setProyectos(prev => prev.map(p => p.id === id ? updated : p))
    if (proyectoActivo?.id === id) setProyectoActivoState(updated)
  }

  async function eliminarProyecto(id: number) {
    await proyectosApi.deleteProyecto(id)
    setProyectos(prev => prev.filter(p => p.id !== id))
    if (proyectoActivo?.id === id) setProyectoActivo(null)
  }

  async function agregarFamiliaProyecto(familiaId: number) {
    if (!proyectoActivo) return
    await proyectosApi.agregarFamiliaProyecto(proyectoActivo.id, familiaId)
    setProyectos(prev => prev.map(p =>
      p.id === proyectoActivo.id ? { ...p, familia_ids: [...p.familia_ids, familiaId] } : p
    ))
    setProyectoActivoState(prev => prev ? { ...prev, familia_ids: [...prev.familia_ids, familiaId] } : prev)
  }

  async function quitarFamiliaProyecto(familiaId: number) {
    if (!proyectoActivo) return
    await proyectosApi.quitarFamiliaProyecto(proyectoActivo.id, familiaId)
    setProyectos(prev => prev.map(p =>
      p.id === proyectoActivo.id ? { ...p, familia_ids: p.familia_ids.filter(id => id !== familiaId) } : p
    ))
    setProyectoActivoState(prev => prev ? { ...prev, familia_ids: prev.familia_ids.filter(id => id !== familiaId) } : prev)
  }

  async function agregarParticipante(email: string) {
    if (!proyectoActivo) return
    const actualizado = await proyectosApi.agregarParticipante(proyectoActivo.id, email)
    setProyectos(prev => prev.map(p => p.id === actualizado.id ? actualizado : p))
    setProyectoActivoState(actualizado)
  }

  async function quitarParticipante(usuarioId: number) {
    if (!proyectoActivo) return
    const actualizado = await proyectosApi.quitarParticipante(proyectoActivo.id, usuarioId)
    setProyectos(prev => prev.map(p => p.id === actualizado.id ? actualizado : p))
    setProyectoActivoState(actualizado)
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
    setTableros(prev => [...prev, { ...real, circuitos: [], fuentes: [], lazos: [], puertos_red: [], elementos_unifilar: [] }])
    return real
  }

  async function duplicarTablero(id: number): Promise<Tablero> {
    const real = await tablerosApi.duplicarTablero(id) as Tablero
    setTableros(prev => [...prev, {
      ...real,
      circuitos: real.circuitos ?? [],
      fuentes: real.fuentes ?? [],
      lazos: real.lazos ?? [],
      puertos_red: real.puertos_red ?? [],
      elementos_unifilar: real.elementos_unifilar ?? [],
    }])
    return real
  }

  async function actualizarTablero(id: number, data: Partial<Omit<Tablero, 'id' | 'circuitos'>>) {
    setTableros(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    await tablerosApi.updateTablero(id, data).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  async function eliminarTablero(id: number) {
    setTableros(prev => prev.filter(t => t.id !== id))
    await tablerosApi.deleteTablero(id).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  // ── Fuentes de alimentación CRUD ───────────────────────────────
  async function agregarFuente(tableroId: number, data: Omit<FuenteAlimentacion, 'id' | 'tablero_id'>) {
    const real: FuenteAlimentacion = await fuentesApi.createFuenteAlimentacion({ ...data, tablero_id: tableroId })
    setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, fuentes: [...t.fuentes, real] } : t))
  }

  async function actualizarFuente(id: number, data: Omit<FuenteAlimentacion, 'id' | 'tablero_id'>) {
    setTableros(prev => prev.map(t => ({
      ...t,
      fuentes: t.fuentes.map(f => f.id === id ? { ...f, ...data } : f),
    })))
    await fuentesApi.updateFuenteAlimentacion(id, data).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  async function eliminarFuente(id: number) {
    setTableros(prev => prev.map(t => ({ ...t, fuentes: t.fuentes.filter(f => f.id !== id) })))
    await fuentesApi.deleteFuenteAlimentacion(id).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  // ── Grupos diferenciales ────────────────────────────────────────
  // Reemplazo total en vez de diff campo a campo: DiferencialesModal ya calculó los
  // tramos finales (propagación + splits), así que es más simple borrar todos los
  // grupos viejos del tablero y recrear uno por tramo que tratar de reconciliar altas/
  // bajas/ediciones circuito por circuito.
  async function guardarGruposDiferenciales(tableroId: number, runs: { nombre: string; proteccionId: number | null; circuitoIds: number[] }[]) {
    const tablero = tableros.find(t => t.id === tableroId)
    if (!tablero) return
    const viejos = tablero.grupos_diferenciales

    // Orden importante: se crean los grupos nuevos y se reasignan los circuitos ANTES
    // de borrar los viejos. Si algo falla en el medio (red, 401, validación del back),
    // el throw sale sin tocar los grupos viejos — nada se pierde y el modal puede
    // reintentar. Antes se borraba primero, así que un fallo a mitad de la creación
    // dejaba el tablero sin ningún diferencial asignado.
    const nuevos: { grupo: GrupoDiferencial; circuitoIds: number[] }[] = await Promise.all(
      runs.map(async run => ({
        grupo: await gruposDiferencialesApi.createGrupoDiferencial({
          tablero_id: tableroId, nombre: run.nombre, proteccion_id: run.proteccionId,
        }),
        circuitoIds: run.circuitoIds,
      }))
    )

    await Promise.all(
      nuevos.flatMap(n => n.circuitoIds.map(cid => circuitosApi.updateGrupoDiferencialCircuito(cid, n.grupo.id)))
    )

    await Promise.all(viejos.map(g => gruposDiferencialesApi.deleteGrupoDiferencial(g.id)))

    setTableros(prev => {
      const viejosIds = new Set(viejos.map(g => g.id))
      const idsAsignados = new Set(nuevos.flatMap(n => n.circuitoIds))

      let next = prev
      for (const n of nuevos)
        for (const cid of n.circuitoIds)
          next = mapCirc(next, cid, c => ({ ...c, grupo_diferencial_id: n.grupo.id, grupo_diferencial: n.grupo }))
      // Circuitos que estaban en un grupo viejo pero se destildaron (no entraron en
      // ningún tramo nuevo) — el back ya los desvinculó vía onDelete: SetNull al borrar
      // el grupo viejo, esto solo sincroniza el estado local para no mostrar datos stale.
      for (const c of tablero.circuitos)
        if (c.grupo_diferencial_id != null && viejosIds.has(c.grupo_diferencial_id) && !idsAsignados.has(c.id))
          next = mapCirc(next, c.id, cc => ({ ...cc, grupo_diferencial_id: null, grupo_diferencial: null }))

      return next.map(t => t.id !== tableroId ? t : { ...t, grupos_diferenciales: nuevos.map(n => n.grupo) })
    })
  }

  // ── Lazos de instrumentación CRUD ──────────────────────────────
  async function agregarLazo(tableroId: number, data: Omit<LazoInstrumentacion, 'id' | 'tablero_id'>) {
    const real: LazoInstrumentacion = await lazosApi.createLazoInstrumentacion({ ...data, tablero_id: tableroId })
    setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, lazos: [...t.lazos, real] } : t))
  }

  async function actualizarLazo(id: number, data: Omit<LazoInstrumentacion, 'id' | 'tablero_id'>) {
    setTableros(prev => prev.map(t => ({
      ...t,
      lazos: t.lazos.map(l => l.id === id ? { ...l, ...data } : l),
    })))
    await lazosApi.updateLazoInstrumentacion(id, data).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  async function eliminarLazo(id: number) {
    setTableros(prev => prev.map(t => ({ ...t, lazos: t.lazos.filter(l => l.id !== id) })))
    await lazosApi.deleteLazoInstrumentacion(id).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  async function agregarLazoVacio(tableroId: number) {
    const tablero = tableros.find(t => t.id === tableroId)
    if (!tablero) return
    const tempId = nextTempId()
    const temp: LazoInstrumentacion = {
      id: tempId, orden: tablero.lazos.length, tag_lazo: `LAZO-${tablero.lazos.length + 1}`,
      tablero_id: tableroId, descripcion: DESCRIPCION_CREANDO, tipo_senal: null, protocolo: null,
      variable_proceso: null, rango_min: null, rango_max: null, unidad: null, direccion_plc: null,
      fabricante: null, modelo: null, ubicacion_campo: null, cable_id: null, cable: null, cantidad_cables: null,
    }
    setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, lazos: [...t.lazos, temp] } : t))
    try {
      const real: LazoInstrumentacion = await lazosApi.crearLazoVacio(tableroId)
      setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, lazos: t.lazos.map(l => l.id === tempId ? real : l) } : t))
    } catch (err) {
      console.error(err)
      setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, lazos: t.lazos.filter(l => l.id !== tempId) } : t))
    }
  }

  async function duplicarLazo(lazoId: number) {
    const tablero = tableros.find(t => t.lazos.some(l => l.id === lazoId))
    if (!tablero) return
    const real: LazoInstrumentacion = await lazosApi.duplicarLazoInstrumentacion(lazoId)
    setTableros(prev => prev.map(t => t.id === tablero.id ? { ...t, lazos: [...t.lazos, real] } : t))
  }

  function reordenarLazos(tableroId: number, orderedIds: number[]) {
    setTableros(prev => prev.map(t => {
      if (t.id !== tableroId) return t
      const byId = new Map(t.lazos.map(l => [l.id, l]))
      return { ...t, lazos: orderedIds.map((id, i) => ({ ...byId.get(id)!, orden: i })) }
    }))
    lazosApi.reordenarLazos(orderedIds.map((id, i) => ({ id, orden: i }))).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  // ── Puertos de red CRUD ─────────────────────────────────────────
  async function agregarPuertoRed(tableroId: number, data: Omit<PuertoRed, 'id' | 'tablero_id'>) {
    const real: PuertoRed = await puertosRedApi.createPuertoRed({ ...data, tablero_id: tableroId })
    setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, puertos_red: [...t.puertos_red, real] } : t))
  }

  async function actualizarPuertoRed(id: number, data: Omit<PuertoRed, 'id' | 'tablero_id'>) {
    setTableros(prev => prev.map(t => ({
      ...t,
      puertos_red: t.puertos_red.map(p => p.id === id ? { ...p, ...data } : p),
    })))
    await puertosRedApi.updatePuertoRed(id, data).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  async function eliminarPuertoRed(id: number) {
    setTableros(prev => prev.map(t => ({ ...t, puertos_red: t.puertos_red.filter(p => p.id !== id) })))
    await puertosRedApi.deletePuertoRed(id).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  async function agregarPuertoRedVacio(tableroId: number) {
    const tablero = tableros.find(t => t.id === tableroId)
    if (!tablero) return
    const tempId = nextTempId()
    const temp: PuertoRed = {
      id: tempId, orden: tablero.puertos_red.length, puerto: `PUERTO-${tablero.puertos_red.length + 1}`,
      tablero_id: tableroId, descripcion: DESCRIPCION_CREANDO, tipo: null, vlan: null,
      dispositivo_conectado: null, cable_tipo: null, velocidad: null,
      fabricante: null, modelo: null, cable_id: null, cable: null, cantidad_cables: null,
    }
    setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, puertos_red: [...t.puertos_red, temp] } : t))
    try {
      const real: PuertoRed = await puertosRedApi.crearPuertoRedVacio(tableroId)
      setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, puertos_red: t.puertos_red.map(p => p.id === tempId ? real : p) } : t))
    } catch (err) {
      console.error(err)
      setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, puertos_red: t.puertos_red.filter(p => p.id !== tempId) } : t))
    }
  }

  async function duplicarPuertoRed(puertoId: number) {
    const tablero = tableros.find(t => t.puertos_red.some(p => p.id === puertoId))
    if (!tablero) return
    const real: PuertoRed = await puertosRedApi.duplicarPuertoRed(puertoId)
    setTableros(prev => prev.map(t => t.id === tablero.id ? { ...t, puertos_red: [...t.puertos_red, real] } : t))
  }

  function reordenarPuertosRed(tableroId: number, orderedIds: number[]) {
    setTableros(prev => prev.map(t => {
      if (t.id !== tableroId) return t
      const byId = new Map(t.puertos_red.map(p => [p.id, p]))
      return { ...t, puertos_red: orderedIds.map((id, i) => ({ ...byId.get(id)!, orden: i })) }
    }))
    puertosRedApi.reordenarPuertosRed(orderedIds.map((id, i) => ({ id, orden: i }))).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
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
      agregarFamiliaProyecto, quitarFamiliaProyecto,
      agregarParticipante, quitarParticipante,
      tableros, loading, error, recargar,
      getTablero, getCircuito,
      agregarTablero, duplicarTablero, actualizarTablero, eliminarTablero,
      agregarFuente, actualizarFuente, eliminarFuente,
      guardarGruposDiferenciales,
      agregarLazo, actualizarLazo, eliminarLazo,
      agregarLazoVacio, duplicarLazo, reordenarLazos,
      agregarPuertoRed, actualizarPuertoRed, eliminarPuertoRed,
      agregarPuertoRedVacio, duplicarPuertoRed, reordenarPuertosRed,
      ...circuitos,
      segmentos, canios, bandejas, conjuntos,
      activeConjuntoId, setActiveConjuntoId,
      paredes, tablaParedes, activaArquitecturaId, setActivaArquitecturaId,
      canieros, setCanieros,
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
