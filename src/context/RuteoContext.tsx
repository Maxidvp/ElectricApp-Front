'use client'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as api from '@/services/ruteo'
import type { Canio, Bandeja, Segmento, SegmentoCircuito } from '@/services/ruteo'

// Temp IDs are negative so they never clash with real DB ids
let _tempId = -1
const nextTempId = () => _tempId--

type Patch = Partial<Omit<Segmento, 'canio' | 'bandeja' | 'circuitos'>>

interface RuteoCtxType {
  segmentos: Segmento[]
  canios: Canio[]
  bandejas: Bandeja[]
  loading: boolean

  addSegmento     : (data: Omit<Segmento, 'id' | 'canio' | 'bandeja' | 'circuitos'>) => void
  previewSegmento : (id: number, patch: Patch) => void
  editSegmento    : (id: number, patch: Patch) => void
  removeSegmento  : (id: number) => void
  asignarCircuito : (segId: number, circId: number, circ: SegmentoCircuito) => void
  quitarCircuito  : (segId: number, circId: number) => void
}

const RuteoContext = createContext<RuteoCtxType | null>(null)

export function RuteoProvider({ children }: { children: React.ReactNode }) {
  const [segmentos, setSegmentos] = useState<Segmento[]>([])
  const [canios,    setCanios]    = useState<Canio[]>([])
  const [bandejas,  setBandejas]  = useState<Bandeja[]>([])
  const [loading,   setLoading]   = useState(true)

  // tempId → promise that resolves to the real Segmento once the API responds
  const pending = useRef<Map<number, Promise<Segmento>>>(new Map())
  // segId → version counter; incremented on each edit; response is ignored unless it matches
  const editVer = useRef<Map<number, number>>(new Map())

  // ── Bootstrap ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([api.getSegmentos(), api.getCanios(), api.getBandejas()])
      .then(([segs, can, ban]) => { setSegmentos(segs); setCanios(can); setBandejas(ban) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // ── Helper: resolve nested objects from IDs ────────────
  function resolvePatch(patch: Patch, prevSeg: Segmento): Segmento {
    const next: Segmento = { ...prevSeg, ...patch }
    if ('canio_id' in patch)
      next.canio = patch.canio_id != null ? (canios.find(c => c.id === patch.canio_id) ?? null) : null
    if ('bandeja_id' in patch)
      next.bandeja = patch.bandeja_id != null ? (bandejas.find(b => b.id === patch.bandeja_id) ?? null) : null
    return next
  }

  // ── Mutations ──────────────────────────────────────────

  function addSegmento(data: Omit<Segmento, 'id' | 'canio' | 'bandeja' | 'circuitos'>) {
    const tempId = nextTempId()
    const optimistic: Segmento = {
      ...data,
      id: tempId,
      canio:    data.canio_id   != null ? (canios.find(c => c.id === data.canio_id)     ?? null) : null,
      bandeja:  data.bandeja_id != null ? (bandejas.find(b => b.id === data.bandeja_id) ?? null) : null,
      circuitos: [],
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
    // Optimistic update immediately
    setSegmentos(prev => prev.map(s => s.id === id ? resolvePatch(patch, s) : s))

    const fire = (realId: number) => {
      const ver = (editVer.current.get(realId) ?? 0) + 1
      editVer.current.set(realId, ver)

      api.updateSegmento(realId, patch).then(real => {
        // Only apply response if no newer edit arrived while this was in-flight
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

  return (
    <RuteoContext.Provider value={{
      segmentos, canios, bandejas, loading,
      addSegmento, previewSegmento, editSegmento, removeSegmento,
      asignarCircuito, quitarCircuito,
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
