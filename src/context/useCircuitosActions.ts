import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import * as circuitosApi from '@/services/circuitos'
import type { FormacionPatch } from '@/services/circuitos'
import type { Tablero, Circuito, Cable } from './types'
import { nextTempId, mapCirc, addCirc, replaceCirc, mergeWithTemp } from './helpers'

type SetTableros = Dispatch<SetStateAction<Tablero[]>>
type PendingMap  = MutableRefObject<Map<number, Promise<Circuito>>>

// Dispara un PATCH inmediato o lo encola tras confirmar el ID real si el circuito aún es temporal.
// Problema que resuelve: el usuario puede editar un campo (FP, largo, etc.) en la misma
// interacción en que el circuito todavía no fue confirmado por el backend (id < 0).
// En ese caso encadenamos el PATCH a la promesa del POST original, de modo que cuando
// el backend confirme el ID real, el PATCH se dispare automáticamente con ese ID.
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

  // Inserta el circuito optimistamente en la posición deseada, luego confirma el ID real
  // con el back y emite un reordenarCircuitos para persistir el nuevo orden.
  // capturedOrder se captura dentro del setTableros (que corre sincrónicamente) para que
  // el .then() tenga el orden definitivo incluso si otro setTableros lo modificó antes.
  function agregarCircuito(tableroId: number, insertIndex?: number) {
    if (!tableros.find(t => t.id === tableroId)) return
    const tempId = nextTempId()
    let capturedOrder: { id: number; orden: number }[] = []

    setTableros(prev => {
      const t = prev.find(t => t.id === tableroId)
      if (!t) return prev
      const s = [...t.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
      const i = insertIndex ?? s.length
      const tag = `${t.tag}-C${t.circuitos.length + 1}`
      s.splice(i, 0, {
        id: tempId, orden: i, circuito: tag, descripcion: null, tipo: null,
        tablero_id: tableroId, formacion_id: null, formacion: null,
        FP: null, Largo: null, tipo_tension: null, fase: null, es_acometida: false, potencia: null,
        role: null, parent_id: null, tablero_destino_id: null, tablero_destino: null,
      })
      const reordered = s.map((c, j) => ({ ...c, orden: j }))
      capturedOrder = reordered.map((c, j) => ({ id: c.id, orden: j }))
      return prev.map(t => t.id === tableroId ? { ...t, circuitos: reordered } : t)
    })

    const promise = circuitosApi.crearCircuitoVacio(tableroId)
      .then(async real => {
        // Reemplazar el tempId por el id real en la lista de órdenes antes de enviarlo al back.
        // Los ids negativos se filtran porque el back no los reconocería.
        const newOrder = capturedOrder
          .map(item => ({ id: item.id === tempId ? real.id : item.id, orden: item.orden }))
          .filter(item => item.id > 0)
        if (newOrder.length > 0) await circuitosApi.reordenarCircuitos(newOrder)
        const realCircuito = { ...(real as Circuito), orden: capturedOrder.find(x => x.id === tempId)?.orden ?? 0 }
        setTableros(prev => {
          const currentTemp = prev.flatMap(t => t.circuitos).find(c => c.id === tempId)
          return replaceCirc(prev, tempId, mergeWithTemp(realCircuito, currentTemp))
        })
        pendingCircuitos.current.set(tempId, Promise.resolve(realCircuito))
        return realCircuito
      })
      .catch(err => {
        console.error(err)
        setTableros(prev => prev.map(t => ({ ...t, circuitos: t.circuitos.filter(c => c.id !== tempId) })))
        throw err
      })
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
    // Un duplicado nunca hereda el vínculo ALIMENTADOR del original (el back tampoco lo copia).
    const temp: Circuito = {
      ...original, id: tempId, circuito: tag, orden: tablero.circuitos.length,
      tablero_destino_id: null, tablero_destino: null,
    }
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
    setTableros(prev => prev.map(t => ({
      ...t,
      circuitos: t.circuitos.filter(c => c.id !== circuitoId && c.parent_id !== circuitoId),
    })))
    circuitosApi.deleteCircuito(circuitoId).catch(err => { console.error(err); recargar() })
  }

  function reordenarSubcircuitos(orderedHijoIds: number[]) {
    setTableros(prev => prev.map(t => ({
      ...t,
      circuitos: t.circuitos.map(c => {
        const idx = orderedHijoIds.indexOf(c.id)
        return idx !== -1 ? { ...c, orden: idx } : c
      }),
    })))
    const realIds = orderedHijoIds.filter(id => id > 0)
    if (realIds.length > 0)
      circuitosApi.reordenarCircuitos(realIds.map((id, i) => ({ id, orden: i }))).catch(console.error)
  }

  async function crearCircuitoAuxiliar(parentId: number, role: 'retorno' | 'combinacion'): Promise<Circuito> {
    const real: Circuito = await circuitosApi.crearCircuitoAuxiliar(parentId, role)
    setTableros(prev => prev.map(t =>
      t.id === real.tablero_id ? { ...t, circuitos: [...t.circuitos, real] } : t
    ))
    return real
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
    const esAcometida = tipo === 'ACOMETIDA'
    setTableros(prev => mapCirc(prev, id, c => ({
      ...c, tipo, es_acometida: esAcometida,
      // Si deja de ser ALIMENTADOR se pierde el vínculo con el tablero destino.
      ...(tipo !== 'ALIMENTADOR' ? { tablero_destino_id: null, tablero_destino: null } : {}),
    })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateTipoCircuito(rid, tipo).catch(console.error))
  }

  function actualizarEsAcometida(id: number, val: boolean) {
    setTableros(prev => mapCirc(prev, id, c => ({ ...c, es_acometida: val })))
    firePending(id, pendingCircuitos, rid => circuitosApi.updateEsAcometidaCircuito(rid, val).catch(console.error))
  }

  // Vincula (o desvincula, con tableroDestinoId null) un circuito ALIMENTADOR a otro tablero.
  // La validación de ciclos/duplicados vive en el back, por eso ante un error se recarga
  // el proyecto en vez de confiar en el estado optimista (podría haber quedado inconsistente).
  function vincularTableroAlimentador(id: number, tableroDestinoId: number | null) {
    const destino = tableroDestinoId != null
      ? tableros.find(t => t.id === tableroDestinoId)
      : null
    setTableros(prev => mapCirc(prev, id, c => ({
      ...c,
      // El back fuerza tipo=ALIMENTADOR en la misma escritura cuando se vincula a un destino.
      ...(destino ? { tipo: 'ALIMENTADOR', es_acometida: false } : {}),
      tablero_destino_id: tableroDestinoId,
      tablero_destino: destino ? { id: destino.id, tag: destino.tag, nombre: destino.nombre } : null,
    })))
    firePending(id, pendingCircuitos, rid =>
      circuitosApi.updateTableroDestinoCircuito(rid, tableroDestinoId).catch(err => { console.error(err); recargar() })
    )
  }

  function agregarAcometida(tableroId: number, nombre: string, insertIndex: number) {
    const tempId = nextTempId()
    const temp: Circuito = {
      id: tempId, orden: insertIndex, circuito: nombre, descripcion: null, tipo: 'ACOMETIDA',
      tablero_id: tableroId, formacion_id: null, formacion: null,
      FP: null, Largo: null, tipo_tension: null, fase: null, es_acometida: true, potencia: null,
      role: null, parent_id: null, tablero_destino_id: null, tablero_destino: null,
    }
    let capturedOrderAlim: { id: number; orden: number }[] = []
    setTableros(prev => {
      const t = prev.find(t => t.id === tableroId)
      if (!t) return prev
      const s = [...t.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
      s.splice(insertIndex, 0, temp)
      const reordered = s.map((c, i) => ({ ...c, orden: i }))
      capturedOrderAlim = reordered.map((c, i) => ({ id: c.id, orden: i }))
      return prev.map(t => t.id === tableroId ? { ...t, circuitos: reordered } : t)
    })

    const promise = circuitosApi.crearCircuitoVacio(tableroId)
      .then(async real => {
        await circuitosApi.updateEsAcometidaCircuito(real.id, true)
        await circuitosApi.updateNombreCircuito(real.id, nombre)
        const newOrder = capturedOrderAlim
          .map(item => ({ id: item.id === tempId ? real.id : item.id, orden: item.orden }))
          .filter(item => item.id > 0)
        if (newOrder.length > 0) await circuitosApi.reordenarCircuitos(newOrder)
        const resolved = { ...real, circuito: nombre, es_acometida: true } as Circuito
        setTableros(prev => replaceCirc(prev, tempId, resolved))
        pendingCircuitos.current.set(tempId, Promise.resolve(resolved))
        return resolved
      })
      .catch(err => {
        console.error(err)
        setTableros(prev => prev.map(t => ({ ...t, circuitos: t.circuitos.filter(c => c.id !== tempId) })))
        throw err
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
    actualizarTipoTension, actualizarFase, actualizarTipo, actualizarEsAcometida,
    vincularTableroAlimentador,
    agregarAcometida, actualizarFormacion, crearCircuitoAuxiliar, reordenarSubcircuitos,
  }
}
