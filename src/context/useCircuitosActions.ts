import type { Dispatch, SetStateAction, MutableRefObject } from 'react'
import * as circuitosApi from '@/services/circuitos'
import type { FormacionPatch } from '@/services/circuitos'
import type { Tablero, Circuito, Cable, Proteccion, GrupoDiferencial } from './types'
import { nextTempId, mapCirc, addCirc, replaceCirc, mergeWithTemp, DESCRIPCION_CREANDO } from './helpers'
import { useToast } from './ToastContext'

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
  const { showError } = useToast()

  // Edición optimista de campos de un circuito: aplica `patch` al estado ya mismo y
  // dispara el guardado (encolado si el circuito todavía es temporal).
  //   - Si el back responde bien y `mergear` está activo, se mergea su respuesta
  //     (trae objetos anidados completos: formación, protección…).
  //   - Si el back falla, se VUELVE ATRÁS: antes solo se mostraba un toast y la tabla
  //     quedaba mostrando un valor que nunca se guardó. Solo se restauran los campos
  //     que siguen teniendo el valor optimista — si el usuario ya los volvió a editar,
  //     esa edición más nueva no se pisa.
  //   - `alFallar: 'recargar'` es para escrituras cuya validación vive en el back y
  //     pueden dejar más de un campo inconsistente: se recarga el proyecto entero.
  function editarCampos(
    id: number,
    patch: Partial<Circuito>,
    guardar: (realId: number) => Promise<unknown>,
    opciones: { mergear?: boolean; alFallar?: 'revertir' | 'recargar' } = {},
  ) {
    const claves = Object.keys(patch) as (keyof Circuito)[]
    let previo: Partial<Circuito> = {}
    setTableros(prev => mapCirc(prev, id, c => {
      previo = Object.fromEntries(claves.map(k => [k, c[k]]))
      return { ...c, ...patch }
    }))

    firePending(id, pendingCircuitos, realId => {
      // El circuito puede haber pasado de id temporal a real entre la edición y la respuesta.
      const esEste = (c: Circuito) => c.id === realId || c.id === id
      const mapear = (fn: (c: Circuito) => Circuito) =>
        setTableros(prev => prev.map(t => ({ ...t, circuitos: t.circuitos.map(c => esEste(c) ? fn(c) : c) })))

      guardar(realId)
        .then(real => { if (opciones.mergear) mapear(c => ({ ...c, ...(real as Circuito) })) })
        .catch(err => {
          console.error(err)
          if (opciones.alFallar === 'recargar') { recargar(); return }
          mapear(c => {
            const restaurado = { ...c } as Record<string, unknown>
            for (const k of claves) if (c[k] === patch[k]) restaurado[k] = previo[k]
            return restaurado as Circuito
          })
          showError('No se pudo guardar el cambio: se restauró el valor anterior.')
        })
    })
  }

  function renombrarCircuito(id: number, nombre: string) {
    editarCampos(id, { circuito: nombre }, rid => circuitosApi.updateNombreCircuito(rid, nombre))
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
      const s = [...t.circuitos].sort((a, b) => a.orden - b.orden)
      const i = insertIndex ?? s.length
      const tag = `${t.tag}-C${t.circuitos.length + 1}`
      s.splice(i, 0, {
        id: tempId, orden: i, circuito: tag, descripcion: DESCRIPCION_CREANDO, tipo: null,
        tablero_id: tableroId, formacion_id: null, formacion: null,
        proteccion_id: null, proteccion: null,
        grupo_diferencial_id: null, grupo_diferencial: null,
        FP: null, Largo: null, tipo_tension: null, fase: null, es_acometida: false, potencia: null,
        metodo_instalacion: null, fc_manual: null, ft_manual: null,
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
      circuitosApi.reordenarCircuitos(realIds.map((id, i) => ({ id, orden: i }))).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  async function crearCircuitoAuxiliar(parentId: number, role: 'retorno' | 'combinacion' | 'ramal'): Promise<Circuito> {
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
    circuitosApi.reordenarCircuitos(realIds.map((id, i) => ({ id, orden: i }))).catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  function actualizarDescripcion(id: number, descripcion: string | null) {
    editarCampos(id, { descripcion }, rid => circuitosApi.updateDescripcionCircuito(rid, descripcion))
  }

  function actualizarFP(id: number, fp: number | null) {
    editarCampos(id, { FP: fp }, rid => circuitosApi.updateFPCircuito(rid, fp))
  }

  function actualizarLargo(id: number, largo: number | null) {
    editarCampos(id, { Largo: largo }, rid => circuitosApi.updateLargoCircuito(rid, largo))
  }

  function actualizarPotencia(id: number, potencia: number | null) {
    editarCampos(id, { potencia }, rid => circuitosApi.updatePotenciaCircuito(rid, potencia))
  }

  function actualizarTipoTension(id: number, tipo: string | null) {
    editarCampos(id, { tipo_tension: tipo }, rid => circuitosApi.updateTipoTensionCircuito(rid, tipo))
  }

  function actualizarFase(id: number, fase: string | null) {
    editarCampos(id, { fase }, rid => circuitosApi.updateFaseCircuito(rid, fase))
  }

  function actualizarTipo(id: number, tipo: string | null) {
    editarCampos(id, {
      tipo, es_acometida: tipo === 'ACOMETIDA',
      // Si deja de ser ALIMENTADOR se pierde el vínculo con el tablero destino.
      ...(tipo !== 'ALIMENTADOR' ? { tablero_destino_id: null, tablero_destino: null } : {}),
    }, rid => circuitosApi.updateTipoCircuito(rid, tipo))
  }

  function actualizarEsAcometida(id: number, val: boolean) {
    editarCampos(id, { es_acometida: val }, rid => circuitosApi.updateEsAcometidaCircuito(rid, val))
  }

  function actualizarMetodoInstalacion(id: number, metodo: string | null) {
    editarCampos(id, { metodo_instalacion: metodo }, rid => circuitosApi.updateMetodoInstalacionCircuito(rid, metodo))
  }

  function actualizarFcManual(id: number, fc: number | null) {
    editarCampos(id, { fc_manual: fc }, rid => circuitosApi.updateFcManualCircuito(rid, fc))
  }

  function actualizarFtManual(id: number, ft: number | null) {
    editarCampos(id, { ft_manual: ft }, rid => circuitosApi.updateFtManualCircuito(rid, ft))
  }

  // Límite de selectividad manual (dato de fabricante): un valor en A, "total", o nada
  // (vuelve al calculado).
  function actualizarSelectividad(id: number, Is: number | null, total: boolean) {
    const patch = { selectividad_Is: total ? null : Is, selectividad_total: total }
    editarCampos(id, patch, rid => circuitosApi.updateSelectividadCircuito(rid, patch))
  }

  // Vincula (o desvincula, con tableroDestinoId null) un circuito ALIMENTADOR a otro tablero.
  // La validación de ciclos/duplicados vive en el back, por eso ante un error se recarga
  // el proyecto en vez de confiar en el estado optimista (podría haber quedado inconsistente).
  function vincularTableroAlimentador(id: number, tableroDestinoId: number | null) {
    const destino = tableroDestinoId != null ? tableros.find(t => t.id === tableroDestinoId) : null
    editarCampos(id, {
      // El back fuerza tipo=ALIMENTADOR en la misma escritura cuando se vincula a un destino.
      ...(destino ? { tipo: 'ALIMENTADOR', es_acometida: false } : {}),
      tablero_destino_id: tableroDestinoId,
      tablero_destino: destino ? { id: destino.id, tag: destino.tag, nombre: destino.nombre } : null,
    }, rid => circuitosApi.updateTableroDestinoCircuito(rid, tableroDestinoId), { alFallar: 'recargar' })
  }

  function agregarAcometida(tableroId: number, nombre: string, insertIndex: number) {
    const tempId = nextTempId()
    const temp: Circuito = {
      id: tempId, orden: insertIndex, circuito: nombre, descripcion: null, tipo: 'ACOMETIDA',
      tablero_id: tableroId, formacion_id: null, formacion: null,
      proteccion_id: null, proteccion: null,
      grupo_diferencial_id: null, grupo_diferencial: null,
      FP: null, Largo: null, tipo_tension: null, fase: null, es_acometida: true, potencia: null,
      metodo_instalacion: null, fc_manual: null, ft_manual: null,
      role: null, parent_id: null, tablero_destino_id: null, tablero_destino: null,
    }
    let capturedOrderAlim: { id: number; orden: number }[] = []
    setTableros(prev => {
      const t = prev.find(t => t.id === tableroId)
      if (!t) return prev
      const s = [...t.circuitos].sort((a, b) => a.orden - b.orden)
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

  // Estas tres mergean la respuesta del back (`mergear`): trae el objeto anidado
  // completo y los ids definitivos. El estado optimista ya muestra el objeto completo
  // que devolvió el modal, así que la UI no espera al PATCH para actualizarse.
  function actualizarFormacion(
    circuitoId: number,
    data: FormacionPatch,
    cables: { fase: Cable; neutro: Cable | null; tierra: Cable | null },
  ) {
    const actual = tableros.flatMap(t => t.circuitos).find(c => c.id === circuitoId)
    editarCampos(circuitoId, {
      formacion: {
        id:              actual?.formacion?.id ?? 0,
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
    }, rid => circuitosApi.updateFormacion(rid, data), { mergear: true })
  }

  function actualizarProteccion(circuitoId: number, proteccion: Proteccion | null) {
    editarCampos(circuitoId, { proteccion_id: proteccion?.id ?? null, proteccion },
      rid => circuitosApi.updateProteccionCircuito(rid, proteccion?.id ?? null), { mergear: true })
  }

  function asignarGrupoDiferencial(circuitoId: number, grupo: GrupoDiferencial | null) {
    editarCampos(circuitoId, { grupo_diferencial_id: grupo?.id ?? null, grupo_diferencial: grupo },
      rid => circuitosApi.updateGrupoDiferencialCircuito(rid, grupo?.id ?? null), { mergear: true })
  }

  return {
    renombrarCircuito, agregarCircuito, duplicarCircuito, eliminarCircuito,
    reordenarCircuitos,
    actualizarDescripcion, actualizarFP, actualizarLargo, actualizarPotencia,
    actualizarTipoTension, actualizarFase, actualizarTipo, actualizarEsAcometida,
    actualizarMetodoInstalacion, actualizarFcManual, actualizarFtManual, actualizarSelectividad,
    vincularTableroAlimentador,
    agregarAcometida, actualizarFormacion, actualizarProteccion, asignarGrupoDiferencial, crearCircuitoAuxiliar, reordenarSubcircuitos,
  }
}
