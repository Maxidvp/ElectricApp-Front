import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import * as circuitosApi from '@/services/circuitos'
import type { FormacionPatch } from '@/services/circuitos'
import type { Tablero, Circuito, Cable } from './types'
import { nextTempId, mapCirc, addCirc, removeCirc, replaceCirc, mergeWithTemp } from './helpers'

type SetTableros = Dispatch<SetStateAction<Tablero[]>>
type PendingMap  = MutableRefObject<Map<number, Promise<Circuito>>>

// Dispara un PATCH inmediato o lo encola tras confirmar el ID real si el circuito aún es temporal.
function firePending(id: number, pending: PendingMap, fn: (realId: number) => void) {
  if (id < 0 && pending.current.has(id)) pending.current.get(id)!.then(r => fn(r.id))
  else fn(id)
}

export function useCircuitosActions(
  tableros: Tablero[],
  setTableros: SetTableros,
  pendingCircuitos: PendingMap,
  recargar: () => void,
) {
  function renombrarCircuito(id: number, nombre: string) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, circuito: nombre })))
    circuitosApi.updateNombreCircuito(id, nombre).catch(console.error)
  }

  function agregarCircuito(tableroId: number, insertIndex?: number) {
    const tablero = tableros.find(t => t.id === tableroId)
    if (!tablero) return
    const tempId = nextTempId()
    const tag    = `${tablero.tag}-C${tablero.circuitos.length + 1}`
    const sorted = [...tablero.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
    const idx    = insertIndex ?? sorted.length
    const temp: Circuito = {
      id: tempId, orden: idx, circuito: tag, descripcion: null, tipo: null,
      tablero_id: tableroId, formacion_id: null, formacion: null,
      FP: null, Largo: null, tipo_tension: null, fase: null, es_alimentador: false, potencia: null,
    }
    setTableros(prev => {
      const t = prev.find(t => t.id === tableroId)
      if (!t) return prev
      const s = [...t.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
      const i = insertIndex ?? s.length
      s.splice(i, 0, { ...temp, orden: i })
      return prev.map(t => t.id === tableroId ? { ...t, circuitos: s.map((c, j) => ({ ...c, orden: j })) } : t)
    })
    const promise = circuitosApi.crearCircuitoVacio(tableroId)
      .then(async real => {
        const currentSorted = tableros
          .find(t => t.id === tableroId)?.circuitos
          .slice().sort((a, b) => (a as any).orden - (b as any).orden) ?? []
        const newOrder = currentSorted
          .map((c, i) => ({ id: c.id === tempId ? real.id : c.id, orden: i }))
          .filter(({ id }) => id > 0)
        if (newOrder.length > 0) await circuitosApi.reordenarCircuitos(newOrder)
        const realCircuito = { ...(real as Circuito), orden: idx }
        setTableros(prev => {
          const currentTemp = prev.flatMap(t => t.circuitos).find(c => c.id === tempId)
          return replaceCirc(prev, tempId, mergeWithTemp(realCircuito, currentTemp))
        })
        pendingCircuitos.current.set(tempId, Promise.resolve(realCircuito))
        return realCircuito
      })
      .catch(err => { console.error(err); return temp })
    pendingCircuitos.current.set(tempId, promise)
  }

  function duplicarCircuito(circuitoId: number) {
    const tablero  = tableros.find(t => t.circuitos.find(c => c.id === circuitoId))
    const original = tablero?.circuitos.find(c => c.id === circuitoId)
    if (!tablero || !original) return
    const tempId   = nextTempId()
    const numMatch = original.circuito.match(/^(.*?)(\d+)$/)
    let tag: string
    if (numMatch) {
      const prefix = numMatch[1]
      const nums = tablero.circuitos
        .map(c => { const m = c.circuito.match(/^(.*?)(\d+)$/); return m && m[1] === prefix ? parseInt(m[2]) : null })
        .filter((n): n is number => n !== null)
      tag = `${prefix}${nums.length > 0 ? Math.max(...nums) + 1 : parseInt(numMatch[2]) + 1}`
    } else {
      tag = `${tablero.tag}-C${tablero.circuitos.length + 1}`
    }
    const temp: Circuito = { ...original, id: tempId, circuito: tag, orden: tablero.circuitos.length }
    setTableros(prev => addCirc(prev, tablero.id, temp))
    const promise = circuitosApi.duplicarCircuito(circuitoId)
      .then(real => {
        setTableros(prev => {
          const currentTemp = prev.flatMap(t => t.circuitos).find(c => c.id === tempId)
          return replaceCirc(prev, tempId, mergeWithTemp(real as Circuito, currentTemp))
        })
        pendingCircuitos.current.set(tempId, Promise.resolve(real as Circuito))
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
    const realIds = orderedIds.filter(id => id > 0)
    circuitosApi.reordenarCircuitos(realIds.map((id, i) => ({ id, orden: i }))).catch(console.error)
  }

  function actualizarDescripcion(id: number, descripcion: string | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, descripcion })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateDescripcionCircuito(rid, descripcion).catch(console.error))
  }

  function actualizarFP(id: number, fp: number | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, FP: fp })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateFPCircuito(rid, fp).catch(console.error))
  }

  function actualizarLargo(id: number, largo: number | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, Largo: largo })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateLargoCircuito(rid, largo).catch(console.error))
  }

  function actualizarPotencia(id: number, potencia: number | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, potencia })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updatePotenciaCircuito(rid, potencia).catch(console.error))
  }

  function actualizarTipoTension(id: number, tipo: string | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, tipo_tension: tipo })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateTipoTensionCircuito(rid, tipo).catch(console.error))
  }

  function actualizarFase(id: number, fase: string | null) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, fase })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateFaseCircuito(rid, fase).catch(console.error))
  }

  function actualizarTipo(id: number, tipo: string | null) {
    const esAlimentador = tipo === 'ALIMENTADOR'
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, tipo, es_alimentador: esAlimentador })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateTipoCircuito(rid, tipo).catch(console.error))
  }

  function actualizarEsAlimentador(id: number, val: boolean) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, es_alimentador: val })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateEsAlimentadorCircuito(rid, val).catch(console.error))
  }

  function agregarAlimentador(tableroId: number, nombre: string, insertIndex: number) {
    const tempId = nextTempId()
    const temp: Circuito = {
      id: tempId, orden: insertIndex, circuito: nombre, descripcion: null, tipo: 'ALIMENTADOR',
      tablero_id: tableroId, formacion_id: null, formacion: null,
      FP: null, Largo: null, tipo_tension: null, fase: null, es_alimentador: true, potencia: null,
    }
    setTableros(prev => {
      const t = prev.find(t => t.id === tableroId)
      if (!t) return prev
      const s = [...t.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
      s.splice(insertIndex, 0, temp)
      return prev.map(t => t.id === tableroId ? { ...t, circuitos: s.map((c, i) => ({ ...c, orden: i })) } : t)
    })
    const promise = circuitosApi.crearCircuitoVacio(tableroId)
      .then(async real => {
        await circuitosApi.updateEsAlimentadorCircuito(real.id, true)
        await circuitosApi.updateNombreCircuito(real.id, nombre)
        const currentSorted = tableros
          .find(t => t.id === tableroId)?.circuitos
          .slice().sort((a, b) => (a as any).orden - (b as any).orden) ?? []
        const newOrder = currentSorted
          .map((c, i) => ({ id: c.id === tempId ? real.id : c.id, orden: i }))
          .filter(({ id }) => id > 0)
        if (newOrder.length > 0) await circuitosApi.reordenarCircuitos(newOrder)
        const resolved = { ...real, circuito: nombre, es_alimentador: true } as Circuito
        setTableros(prev => replaceCirc(prev, tempId, resolved))
        pendingCircuitos.current.set(tempId, Promise.resolve(resolved))
        return resolved
      })
    pendingCircuitos.current.set(tempId, promise)
  }

  function actualizarFormacion(
    circuitoId: number,
    data: FormacionPatch,
    cables: { fase: Cable; neutro: Cable | null; tierra: Cable | null },
  ) {
    setTableros(prev => mapCirc(prev, circuitoId, c => ({
      ...c,
      formacion: {
        id:              c.formacion?.id ?? 0,
        cable_id:        data.cable_id,
        cond_por_fase:   data.cond_por_fase,
        Nfases:          data.Nfases,
        Nneutro:         data.Nneutro,
        cable_neutro_id: data.cable_neutro_id,
        cable_tierra_id: data.cable_tierra_id,
        disposicion:     data.disposicion ?? null,
        cable:        cables.fase,
        cable_neutro: cables.neutro,
        cable_tierra: cables.tierra,
      },
    })))
    const fire = (realId: number) =>
      circuitosApi.updateFormacion(realId, data)
        .then(real => setTableros(prev => mapCirc(prev, realId, () => real as Circuito)))
        .catch(console.error)
    firePending(circuitoId, pendingCircuitos, fire)
  }

  return {
    renombrarCircuito, agregarCircuito, duplicarCircuito, eliminarCircuito,
    reordenarCircuitos,
    actualizarDescripcion, actualizarFP, actualizarLargo, actualizarPotencia,
    actualizarTipoTension, actualizarFase, actualizarTipo, actualizarEsAlimentador,
    agregarAlimentador, actualizarFormacion,
  }
}
