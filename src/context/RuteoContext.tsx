'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as api from '@/services/ruteo'
import type { Canio, Bandeja, Segmento, SegmentoCircuito, Conjunto, CreateSegmentoInput } from '@/services/ruteo'

let _tempId = -1
const nextTempId = () => _tempId--

type Patch = Partial<Omit<Segmento, 'canio' | 'bandeja' | 'circuitos' | 'conjuntos'>>

interface RuteoCtxType {
  segmentos: Segmento[]
  canios: Canio[]
  bandejas: Bandeja[]
  conjuntos: Conjunto[]
  activeConjuntoId: number | null
  loading: boolean

  setActiveConjuntoId : (id: number) => void

  addSegmento             : (data: CreateSegmentoInput) => void
  previewSegmento         : (id: number, patch: Patch) => void
  editSegmento            : (id: number, patch: Patch) => void
  removeSegmento          : (id: number) => void
  asignarCircuito         : (segId: number, circId: number, circ: SegmentoCircuito) => void
  quitarCircuito          : (segId: number, circId: number) => void

  addConjunto             : (nombre: string) => void
  renameConjunto          : (id: number, nombre: string) => void
  deleteConjunto          : (id: number) => void
  addSegmentoToConjunto   : (segId: number, conjuntoId: number) => void
  removeSegmentoFromConjunto : (segId: number, conjuntoId: number) => void
}

const RuteoContext = createContext<RuteoCtxType | null>(null)

export function RuteoProvider({ children }: { children: React.ReactNode }) {
  const [segmentos,        setSegmentos]        = useState<Segmento[]>([])
  const [canios,           setCanios]           = useState<Canio[]>([])
  const [bandejas,         setBandejas]         = useState<Bandeja[]>([])
  const [conjuntos,        setConjuntos]        = useState<Conjunto[]>([])
  const [activeConjuntoId, setActiveConjuntoId] = useState<number | null>(null)
  const [loading,          setLoading]          = useState(true)

  const pending = useRef<Map<number, Promise<Segmento>>>(new Map())
  const editVer = useRef<Map<number, number>>(new Map())

  // ── Bootstrap ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([api.getSegmentos(), api.getCanios(), api.getBandejas(), api.getConjuntos()])
      .then(async ([segs, can, ban, conjs]) => {
        setSegmentos(segs)
        setCanios(can)
        setBandejas(ban)

        // Garantizar que siempre existe al menos el conjunto "Default"
        if (conjs.length === 0) {
          const def = await api.createConjunto('Default')
          setConjuntos([def])
          setActiveConjuntoId(def.id)
        } else {
          setConjuntos(conjs)
          setActiveConjuntoId(conjs[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── Helper ─────────────────────────────────────────────
  function resolvePatch(patch: Patch, prevSeg: Segmento): Segmento {
    const next: Segmento = { ...prevSeg, ...patch }
    if ('canio_id' in patch)
      next.canio = patch.canio_id != null ? (canios.find(c => c.id === patch.canio_id) ?? null) : null
    if ('bandeja_id' in patch)
      next.bandeja = patch.bandeja_id != null ? (bandejas.find(b => b.id === patch.bandeja_id) ?? null) : null
    return next
  }

  // ── Segmento mutations ─────────────────────────────────

  function addSegmento(data: CreateSegmentoInput) {
    const tempId = nextTempId()
    const conjuntosOptimistic = (data.conjunto_ids ?? [])
      .map(id => conjuntos.find(c => c.id === id))
      .filter(Boolean) as Conjunto[]

    const optimistic: Segmento = {
      ...data,
      id: tempId,
      canio:     data.canio_id   != null ? (canios.find(c => c.id === data.canio_id)     ?? null) : null,
      bandeja:   data.bandeja_id != null ? (bandejas.find(b => b.id === data.bandeja_id) ?? null) : null,
      circuitos: [],
      conjuntos: conjuntosOptimistic,
    }

    setSegmentos(prev => [...prev, optimistic])

    const promise = api.createSegmento(data).then(real => {
      setSegmentos(prev => prev.map(s => s.id === tempId ? real : s))
      pending.current.delete(tempId)
      return real
    }).catch(err => {
      console.error('createSegmento failed', err)
      return optimistic
    })

    pending.current.set(tempId, promise)
  }

  function previewSegmento(id: number, patch: Patch) {
    setSegmentos(prev => prev.map(s => s.id === id ? resolvePatch(patch, s) : s))
  }

  function editSegmento(id: number, patch: Patch) {
    setSegmentos(prev => prev.map(s => s.id === id ? resolvePatch(patch, s) : s))

    const fire = (realId: number) => {
      const ver = (editVer.current.get(realId) ?? 0) + 1
      editVer.current.set(realId, ver)

      api.updateSegmento(realId, patch).then(real => {
        if (editVer.current.get(realId) === ver) {
          editVer.current.delete(realId)
          setSegmentos(prev => prev.map(s => s.id === realId ? real : s))
        }
      }).catch(console.error)
    }

    if (id < 0 && pending.current.has(id)) {
      pending.current.get(id)!.then(real => fire(real.id))
    } else {
      fire(id)
    }
  }

  function removeSegmento(id: number) {
    setSegmentos(prev => prev.filter(s => s.id !== id))

    const fire = (realId: number) =>
      api.deleteSegmento(realId).catch(console.error)

    if (id < 0 && pending.current.has(id)) {
      pending.current.get(id)!.then(real => fire(real.id))
    } else {
      fire(id)
    }
  }

  function asignarCircuito(segId: number, circId: number, circ: SegmentoCircuito) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId && !s.circuitos.find(c => c.id === circId)
        ? { ...s, circuitos: [...s.circuitos, circ] }
        : s
    ))

    const fire = (realId: number) =>
      api.addCircuitoToSegmento(realId, circId).then(real => {
        setSegmentos(prev => prev.map(s => s.id === realId ? real : s))
      }).catch(console.error)

    if (segId < 0 && pending.current.has(segId)) {
      pending.current.get(segId)!.then(real => fire(real.id))
    } else {
      fire(segId)
    }
  }

  function quitarCircuito(segId: number, circId: number) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId
        ? { ...s, circuitos: s.circuitos.filter(c => c.id !== circId) }
        : s
    ))

    const fire = (realId: number) =>
      api.removeCircuitoFromSegmento(realId, circId).then(real => {
        setSegmentos(prev => prev.map(s => s.id === realId ? real : s))
      }).catch(console.error)

    if (segId < 0 && pending.current.has(segId)) {
      pending.current.get(segId)!.then(real => fire(real.id))
    } else {
      fire(segId)
    }
  }

  // ── Conjunto mutations ─────────────────────────────────

  function addConjunto(nombre: string) {
    api.createConjunto(nombre).then(real => {
      setConjuntos(prev => [...prev, real])
      setActiveConjuntoId(real.id)
    }).catch(console.error)
  }

  function renameConjunto(id: number, nombre: string) {
    setConjuntos(prev => prev.map(c => c.id === id ? { ...c, nombre } : c))
    setSegmentos(prev => prev.map(s => ({
      ...s,
      conjuntos: s.conjuntos.map(c => c.id === id ? { ...c, nombre } : c),
    })))
    api.updateConjunto(id, nombre).catch(console.error)
  }

  function deleteConjunto(id: number) {
    if (conjuntos.length <= 1) return  // siempre debe existir al menos uno
    const remaining = conjuntos.filter(c => c.id !== id)
    setConjuntos(remaining)
    setSegmentos(prev => prev.map(s => ({ ...s, conjuntos: s.conjuntos.filter(c => c.id !== id) })))
    if (activeConjuntoId === id) setActiveConjuntoId(remaining[0].id)
    api.deleteConjunto(id).catch(console.error)
  }

  function addSegmentoToConjunto(segId: number, conjuntoId: number) {
    const conjunto = conjuntos.find(c => c.id === conjuntoId)
    if (!conjunto) return
    setSegmentos(prev => prev.map(s =>
      s.id === segId && !s.conjuntos.find(c => c.id === conjuntoId)
        ? { ...s, conjuntos: [...s.conjuntos, { id: conjunto.id, nombre: conjunto.nombre }] }
        : s
    ))
    const fire = (realId: number) =>
      api.addSegmentoToConjunto(realId, conjuntoId).catch(console.error)

    if (segId < 0 && pending.current.has(segId)) {
      pending.current.get(segId)!.then(real => fire(real.id))
    } else {
      fire(segId)
    }
  }

  function removeSegmentoFromConjunto(segId: number, conjuntoId: number) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId
        ? { ...s, conjuntos: s.conjuntos.filter(c => c.id !== conjuntoId) }
        : s
    ))
    const fire = (realId: number) =>
      api.removeSegmentoFromConjunto(realId, conjuntoId).catch(console.error)

    if (segId < 0 && pending.current.has(segId)) {
      pending.current.get(segId)!.then(real => fire(real.id))
    } else {
      fire(segId)
    }
  }

  return (
    <RuteoContext.Provider value={{
      segmentos, canios, bandejas, conjuntos, activeConjuntoId, loading,
      setActiveConjuntoId,
      addSegmento, previewSegmento, editSegmento, removeSegmento,
      asignarCircuito, quitarCircuito,
      addConjunto, renameConjunto, deleteConjunto,
      addSegmentoToConjunto, removeSegmentoFromConjunto,
    }}>
      {children}
    </RuteoContext.Provider>
  )
}

export function useRuteo() {
  const ctx = useContext(RuteoContext)
  if (!ctx) throw new Error('useRuteo debe usarse dentro de RuteoProvider')
  return ctx
}
