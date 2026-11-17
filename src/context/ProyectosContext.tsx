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
import * as checkpointsApi from '@/services/checkpoints'
import { apiFetch } from '@/services/apiFetch'
import type { Canio, Bandeja, Segmento, Conjunto, Arquitectura, Pared } from '@/services/ruteo'
import type { Caniero } from '@/services/canieros'
import { prefetchCablesFamilias } from '@/context/CablesContext'
import { getLastTableroId, setLastTableroId } from '@/utils/cookies'
import { useAuth } from '@/context/AuthContext'

import type { Tablero, Circuito, FuenteAlimentacion, GrupoDiferencial, LazoInstrumentacion, PuertoRed, ProyectosContextType, ProyectoMeta } from './types'
import { nextTempId, DESCRIPCION_CREANDO, mapCirc } from './helpers'
import { useCircuitosActions, type BorrarConDeshacer } from './useCircuitosActions'
import { useHistorial, sigueIgual } from './historial'
import { useRuteoActions } from './useRuteoActions'

export type { ProyectoMeta }
export type { Pared, Arquitectura }
export type { FuenteAlimentacion, GrupoDiferencial }
export type { LazoInstrumentacion, PuertoRed }

// ── Context ───────────────────────────────────────────────────────
const ProyectosContext = createContext<ProyectosContextType | null>(null)

// ── Provider ──────────────────────────────────────────────────────
export function ProyectosProvider({ children }: { children: React.ReactNode }) {
  const { showError, showSuccess, showAccion } = useToast()
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
  // Tablero seleccionado — global: lo comparten todas las páginas y el Navbar. La
  // cookie es solo para recordarlo entre recargas.
  const [tableroSeleccionadoId, setTableroSeleccionadoId] = useState<number | null>(getLastTableroId)
  const seleccionarTablero = (id: number) => { setTableroSeleccionadoId(id); setLastTableroId(id) }

  const { usuario, loading: authLoading } = useAuth()

  const pendingCircuitos = useRef<Map<number, Promise<Circuito>>>(new Map())
  const pendingSegmentos = useRef<Map<number, Promise<Segmento>>>(new Map())
  const editVer          = useRef<Map<number, number>>(new Map())
  const proyectoActivoRef = useRef<ProyectoMeta | null>(null)
  // N° de la última carga de proyecto pedida: si el usuario cambia de proyecto antes
  // de que responda la anterior, la respuesta vieja se descarta en vez de pisar al nuevo.
  const cargaSeq = useRef(0)

  // ── Deshacer / rehacer (Ctrl+Z, Ctrl+Y) ────────────────────────
  const tablerosRef = useRef(tableros)
  tablerosRef.current = tableros
  const historial = useHistorial({ ok: showSuccess, error: showError })
  const historialRef = useRef(historial)
  historialRef.current = historial

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const tecla = e.key.toLowerCase()
      if (tecla !== 'z' && tecla !== 'y') return
      // Dentro de un campo de texto, Ctrl+Z es el deshacer propio del navegador.
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      e.preventDefault()
      if (tecla === 'y' || e.shiftKey) historialRef.current.rehacer()
      else historialRef.current.deshacer()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  // ── Borrado con deshacer ───────────────────────────────────────
  // El back hace borrado LÓGICO (marca la fila, no la elimina — Back/src/lib/
  // borradoLogico.ts), así que deshacer es pedirle que la restaure y volver a mostrar lo
  // que se había quitado de pantalla, con todo lo que colgaba de ella intacto. Se puede
  // deshacer mientras dure la ventana; el back elimina de verdad lo borrado al día.
  const borrarConDeshacer: BorrarConDeshacer = ({ descripcion, quitar, restaurar, ejecutar, restaurarEnServidor }) => {
    const alFallar = (err: unknown) => {
      console.error(err)
      showError('No se pudo eliminar: se recargó el proyecto.')
      recargar()
    }
    let borrado = Promise.resolve()
    const borrar = () => { quitar(); borrado = ejecutar().then(() => {}, alFallar) }
    const deshacer = async () => {
      await borrado
      try { await restaurarEnServidor() } catch (err) { console.error(err); return false }
      restaurar()
      return true
    }

    borrar()
    const paso = { descripcion: `eliminar ${descripcion}`, deshacer, rehacer: () => { borrar(); return true } }
    historial.registrar(paso)
    // Atajo visible; pasado el aviso sigue disponible con Ctrl+Z.
    showAccion(`Se eliminó ${descripcion}.`, { etiqueta: 'Deshacer', onClick: () => { historial.deshacerPaso(paso) } }, 6000)
  }

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
    // El estado se reemplaza entero: el historial de deshacer no sigue valiendo.
    historial.limpiar()
    const seq = ++cargaSeq.current
    const vigente = () => seq === cargaSeq.current
    if (!p) {
      setLoading(false)
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
        if (!vigente()) return
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
          const recordado = getLastTableroId()
          seleccionarTablero(tablerosList.some((t: Tablero) => t.id === recordado) ? recordado! : tablerosList[0].id)
        }

        const conjs: Conjunto[] = (data.conjuntos ?? []).map((c: any) => ({
          id: c.id, nombre: c.nombre, tableros: c.tableros ?? [], arquitecturas: c.arquitecturas ?? [],
        }))
        setConjuntos(conjs)
        setSegmentos(data.segmentos ?? [])

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
      .catch(err => { if (vigente()) setError(err.message) })
      .finally(() => { if (vigente()) setLoading(false) })
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

  // Restaurar pisa TODO el contenido del proyecto con IDs nuevos (y puede cambiarle
  // nombre/descripción/formatos): se recarga la meta desde la lista y después el
  // contenido entero vía setProyectoActivo. Los avisos van por toast porque la
  // recarga pasa por LoadingGate, que desmonta la página que llamó a esto.
  async function restaurarCheckpoint(checkpointId: number) {
    if (!proyectoActivo) return
    const { avisos } = await checkpointsApi.restaurarCheckpoint(checkpointId)
    const projs = await proyectosApi.getProyectos()
    setProyectos(projs)
    setProyectoActivo(projs.find(p => p.id === proyectoActivo.id) ?? null)
    showSuccess('Checkpoint restaurado')
    if (avisos.length) showError(`Restaurado con avisos: ${avisos.join('; ')}`)
  }

  // ── Tableros CRUD ─────────────────────────────────────────────
  const getTablero  = (id: number) => tableros.find(t => t.id === id)
  const getCircuito = (id: number) => {
    for (const t of tableros) {
      const c = t.circuitos.find(c => c.id === id)
      if (c) return c
    }
  }

  // ── Escrituras optimistas con vuelta atrás ─────────────────────
  // Antes, si el back rechazaba un cambio solo se mostraba un toast y la pantalla
  // seguía mostrando un valor que nunca se guardó.
  //   - Edición: se restaura el ítem tal como estaba.
  //   - Borrado: se recarga el proyecto (lo borrado pudo tener hijos en cascada que
  //     no conviene reconstruir a mano).
  type Coleccion = 'fuentes' | 'lazos' | 'puertos_red'

  function editarItem<D extends object>(col: Coleccion, id: number, data: D, guardar: (d: D) => Promise<unknown>, nombre: string) {
    type Item = { id: number }
    const claves = Object.keys(data)
    const aplicar = (valores: D) => {
      let previo: Item | undefined
      const mapear = (fn: (x: Item) => Item) =>
        setTableros(prev => prev.map(t => ({ ...t, [col]: (t[col] as Item[]).map(x => x.id === id ? fn(x) : x) })))
      mapear(x => { previo = x; return { ...x, ...valores } })
      const guardado = guardar(valores).catch(err => {
        console.error(err)
        if (previo) mapear(() => previo!)
        showError('No se pudo guardar el cambio: se restauró el valor anterior.')
      })
      return { guardado, previo: () => Object.fromEntries(claves.map(k => [k, (previo as Record<string, unknown> | undefined)?.[k]])) as D }
    }
    const { guardado, previo } = aplicar(data)
    const intercambiar = (valores: D, esperado: D) => {
      const actual = tablerosRef.current.flatMap(t => t[col] as Item[]).find(x => x.id === id)
      if (!actual || !sigueIgual(actual as Record<string, unknown>, esperado as Record<string, unknown>)) return false
      aplicar(valores)
      return true
    }
    historial.registrar({
      descripcion: `edición de ${nombre}`,
      deshacer: () => intercambiar(previo(), data),
      rehacer: () => intercambiar(data, previo()),
    })
    return guardado
  }

  // Borrado con deshacer de una fuente / lazo / puerto (ver borrarConDeshacer).
  function borrarItem(col: Coleccion, id: number, descripcion: string, ejecutar: () => Promise<unknown>, restaurarEnServidor: () => Promise<unknown>) {
    type Item = { id: number }
    let quitado: { tableroId: number; item: Item; indice: number } | null = null
    borrarConDeshacer({
      descripcion,
      quitar: () => setTableros(prev => prev.map(t => {
        const lista = t[col] as Item[]
        const indice = lista.findIndex(x => x.id === id)
        if (indice === -1) return t
        quitado = { tableroId: t.id, item: lista[indice], indice }
        return { ...t, [col]: lista.filter(x => x.id !== id) }
      })),
      restaurar: () => setTableros(prev => prev.map(t => {
        if (!quitado || t.id !== quitado.tableroId) return t
        const lista = [...(t[col] as Item[])]
        lista.splice(quitado.indice, 0, quitado.item)
        return { ...t, [col]: lista }
      })),
      ejecutar, restaurarEnServidor,
    })
  }

  async function agregarTablero(data: any): Promise<Tablero> {
    const real = await tablerosApi.createTablero({ ...data, proyecto_id: proyectoActivo?.id ?? null }) as Tablero
    setTableros(prev => [...prev, { ...real, circuitos: [], fuentes: [], lazos: [], puertos_red: [], elementos_unifilar: [], grupos_diferenciales: [] }])
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
      grupos_diferenciales: real.grupos_diferenciales ?? [],
    }])
    return real
  }

  async function actualizarTablero(id: number, data: Partial<Omit<Tablero, 'id' | 'circuitos'>>) {
    type Datos = typeof data
    const claves = Object.keys(data) as (keyof Tablero)[]
    const aplicar = (valores: Datos) => {
      let previo: Tablero | undefined
      setTableros(prev => prev.map(t => { if (t.id !== id) return t; previo = t; return { ...t, ...valores } }))
      const anteriores = () => Object.fromEntries(claves.map(k => [k, previo?.[k]])) as Datos
      const guardado = tablerosApi.updateTablero(id, valores).catch(err => {
        console.error(err)
        // Solo vuelven atrás los campos de esta edición: circuitos, fuentes, etc. pueden
        // haber cambiado mientras tanto y no hay que pisarlos.
        if (previo) setTableros(prev => prev.map(t => t.id === id ? { ...t, ...anteriores() } : t))
        showError('No se pudo guardar el cambio: se restauró el valor anterior.')
      })
      return { guardado, anteriores }
    }
    const { guardado, anteriores } = aplicar(data)
    const intercambiar = (valores: Datos, esperado: Datos) => {
      const actual = tablerosRef.current.find(t => t.id === id)
      if (!actual || !sigueIgual(actual as unknown as Record<string, unknown>, esperado as Record<string, unknown>)) return false
      aplicar(valores)
      return true
    }
    historial.registrar({
      descripcion: `edición del tablero ${tablerosRef.current.find(t => t.id === id)?.tag ?? ''}`.trim(),
      deshacer: () => intercambiar(anteriores(), data),
      rehacer: () => intercambiar(data, anteriores()),
    })
    await guardado
  }

  async function eliminarTablero(id: number) {
    let quitado: { tablero: Tablero; indice: number } | null = null
    borrarConDeshacer({
      descripcion: `el tablero ${tablerosRef.current.find(t => t.id === id)?.tag ?? ''}`.trim(),
      quitar: () => setTableros(prev => {
        const indice = prev.findIndex(t => t.id === id)
        if (indice === -1) return prev
        quitado = { tablero: prev[indice], indice }
        return prev.filter(t => t.id !== id)
      }),
      restaurar: () => setTableros(prev => {
        if (!quitado || prev.some(t => t.id === id)) return prev
        const next = [...prev]
        next.splice(quitado.indice, 0, quitado.tablero)
        return next
      }),
      ejecutar: () => tablerosApi.deleteTablero(id),
      restaurarEnServidor: () => tablerosApi.restaurarTablero(id),
    })
  }

  // ── Fuentes de alimentación CRUD ───────────────────────────────
  async function agregarFuente(tableroId: number, data: Omit<FuenteAlimentacion, 'id' | 'tablero_id'>) {
    const real: FuenteAlimentacion = await fuentesApi.createFuenteAlimentacion({ ...data, tablero_id: tableroId })
    setTableros(prev => prev.map(t => t.id === tableroId ? { ...t, fuentes: [...t.fuentes, real] } : t))
  }

  async function actualizarFuente(id: number, data: Omit<FuenteAlimentacion, 'id' | 'tablero_id'>) {
    await editarItem('fuentes', id, data, d => fuentesApi.updateFuenteAlimentacion(id, d), 'la fuente')
  }

  async function eliminarFuente(id: number) {
    borrarItem('fuentes', id, 'la fuente', () => fuentesApi.deleteFuenteAlimentacion(id), () => fuentesApi.restaurarFuenteAlimentacion(id))
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
    await editarItem('lazos', id, data, d => lazosApi.updateLazoInstrumentacion(id, d), 'el lazo')
  }

  async function eliminarLazo(id: number) {
    borrarItem('lazos', id, 'el lazo', () => lazosApi.deleteLazoInstrumentacion(id), () => lazosApi.restaurarLazoInstrumentacion(id))
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
      showError('No se pudo crear el lazo. Reintentá.')
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
    await editarItem('puertos_red', id, data, d => puertosRedApi.updatePuertoRed(id, d), 'el puerto')
  }

  async function eliminarPuertoRed(id: number) {
    borrarItem('puertos_red', id, 'el puerto', () => puertosRedApi.deletePuertoRed(id), () => puertosRedApi.restaurarPuertoRed(id))
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
      showError('No se pudo crear el puerto. Reintentá.')
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
  const circuitos = useCircuitosActions(tableros, setTableros, pendingCircuitos, recargar, tablerosRef, historial, borrarConDeshacer)

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
      agregarParticipante, quitarParticipante, restaurarCheckpoint,
      tableros, loading, error, recargar,
      tableroSeleccionadoId, seleccionarTablero,
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
