import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import * as ruteoApi from '@/services/ruteo'
import type { Segmento, SegmentoCircuito, Conjunto, CreateSegmentoInput, Pared, CreateParedInput, Arquitectura, Canio, Bandeja } from '@/services/ruteo'
import type { ProyectoMeta, SegPatch } from './types'
import { nextTempId } from './helpers'

type SetState<T> = Dispatch<SetStateAction<T>>

export function useRuteoActions(
  conjuntos:              Conjunto[],
  canios:                 Canio[],
  bandejas:               Bandeja[],
  tablaParedes:           Arquitectura[],
  activeConjuntoId:       number | null,
  activaArquitecturaId:   number | null,
  proyectoActivo:         ProyectoMeta | null,
  setSegmentos:           SetState<Segmento[]>,
  setConjuntos:           SetState<Conjunto[]>,
  setParedes:             SetState<Pared[]>,
  setArquitecturaes:      SetState<Arquitectura[]>,
  setActiveConjuntoId:    (id: number) => void,
  setActivaArquitecturaId:(id: number | null) => void,
  pendingSegmentos:       MutableRefObject<Map<number, Promise<Segmento>>>,
  editVer:                MutableRefObject<Map<number, number>>,
) {
  // Aplica un patch a un segmento resolviendo las referencias de canio/bandeja.
  function resolveSegPatch(patch: SegPatch, prev: Segmento): Segmento {
    const next: Segmento = { ...prev, ...patch }
    if ('canio_id'   in patch) next.canio   = patch.canio_id   != null ? (canios.find(c => c.id === patch.canio_id)     ?? null) : null
    if ('bandeja_id' in patch) next.bandeja = patch.bandeja_id != null ? (bandejas.find(b => b.id === patch.bandeja_id) ?? null) : null
    return next
  }

  function firePendingSeg(id: number, fn: (realId: number) => void) {
    if (id < 0 && pendingSegmentos.current.has(id)) pendingSegmentos.current.get(id)!.then(real => fn(real.id))
    else fn(id)
  }

  // ── Segmentos ─────────────────────────────────────────────────

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
    firePendingSeg(id, fire)
  }

  function removeSegmento(id: number) {
    setSegmentos(prev => prev.filter(s => s.id !== id))
    firePendingSeg(id, realId => ruteoApi.deleteSegmento(realId).catch(console.error))
  }

  function asignarCircuito(segId: number, circId: number, circ: SegmentoCircuito) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId && !s.circuitos.find(c => c.id === circId)
        ? { ...s, circuitos: [...s.circuitos, circ] } : s
    ))
    firePendingSeg(segId, realId =>
      ruteoApi.addCircuitoToSegmento(realId, circId)
        .then(real => setSegmentos(prev => prev.map(s => s.id === realId ? real : s)))
        .catch(console.error)
    )
  }

  function quitarCircuito(segId: number, circId: number) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId ? { ...s, circuitos: s.circuitos.filter(c => c.id !== circId) } : s
    ))
    firePendingSeg(segId, realId =>
      ruteoApi.removeCircuitoFromSegmento(realId, circId)
        .then(real => setSegmentos(prev => prev.map(s => s.id === realId ? real : s)))
        .catch(console.error)
    )
  }

  function appendSegmentos(segs: Segmento[]) {
    setSegmentos(prev => [...prev, ...segs])
  }

  // ── Conjuntos ─────────────────────────────────────────────────

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
    firePendingSeg(segId, realId => ruteoApi.addSegmentoToConjunto(realId, conjuntoId).catch(console.error))
  }

  function removeSegmentoFromConjunto(segId: number, conjuntoId: number) {
    setSegmentos(prev => prev.map(s =>
      s.id === segId ? { ...s, conjuntos: s.conjuntos.filter(c => c.id !== conjuntoId) } : s
    ))
    firePendingSeg(segId, realId => ruteoApi.removeSegmentoFromConjunto(realId, conjuntoId).catch(console.error))
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

  // ── Paredes ───────────────────────────────────────────────────

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

  function appendParedes(nuevasParedes: Pared[]) {
    setParedes(prev => [...prev, ...nuevasParedes])
    setArquitecturaes(prev => prev.map(tp => {
      const extras = nuevasParedes.filter(p => p.tabla_pared_id === tp.id)
      return extras.length ? { ...tp, paredes: [...tp.paredes, ...extras] } : tp
    }))
  }

  // ── Arquitecturas ─────────────────────────────────────────────

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

  return {
    addSegmento, previewSegmento, editSegmento, removeSegmento,
    asignarCircuito, quitarCircuito, appendSegmentos,
    addConjunto, renameConjunto, deleteConjunto,
    addSegmentoToConjunto, removeSegmentoFromConjunto,
    addTableroToConjunto, removeTableroFromConjunto,
    addPared, editPared, removePared, appendParedes,
    addArquitectura, renameArquitectura, deleteArquitectura,
    addArquitecturaToConjunto, removeArquitecturaFromConjunto,
  }
}
