import { apiFetch } from './apiFetch'

export async function getCircuito(id: number) {
  const res = await apiFetch(`/circuitos/${id}`)
  if (!res.ok) throw new Error('Error al traer el circuito')
  return res.json()
}

export async function deleteCircuito(id: number) {
  const res = await apiFetch(`/circuitos/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Error al eliminar el circuito')
  return res.json()
}

export async function updateFPCircuito(id: number, fp: number | null) {
  const res = await apiFetch(`/circuitos/${id}/fp`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ FP: fp }),
  })
  if (!res.ok) throw new Error('Error al actualizar el FP')
  return res.json()
}

export async function updateLargoCircuito(id: number, largo: number | null) {
  const res = await apiFetch(`/circuitos/${id}/largo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Largo: largo }),
  })
  if (!res.ok) throw new Error('Error al actualizar el largo')
  return res.json()
}

export async function updateDescripcionCircuito(id: number, descripcion: string | null) {
  const res = await apiFetch(`/circuitos/${id}/descripcion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descripcion }),
  })
  if (!res.ok) throw new Error('Error al actualizar la descripción')
  return res.json()
}

export async function updateEsAcometidaCircuito(id: number, es_acometida: boolean) {
  const res = await apiFetch(`/circuitos/${id}/es_acometida`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ es_acometida }),
  })
  if (!res.ok) throw new Error('Error al actualizar es_acometida')
  return res.json()
}

export async function updateFaseCircuito(id: number, fase: string | null) {
  const res = await apiFetch(`/circuitos/${id}/fase`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fase }),
  })
  if (!res.ok) throw new Error('Error al actualizar la fase')
  return res.json()
}

export async function updateTipoTensionCircuito(id: number, tipo_tension: string | null) {
  const res = await apiFetch(`/circuitos/${id}/tipo_tension`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo_tension }),
  })
  if (!res.ok) throw new Error('Error al actualizar el tipo de tensión')
  return res.json()
}

export async function updatePotenciaCircuito(id: number, potencia: number | null) {
  const res = await apiFetch(`/circuitos/${id}/potencia`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ potencia }),
  })
  if (!res.ok) throw new Error('Error al actualizar la potencia')
  return res.json()
}

export async function updateMetodoInstalacionCircuito(id: number, metodo_instalacion: string | null) {
  const res = await apiFetch(`/circuitos/${id}/metodo-instalacion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metodo_instalacion }),
  })
  if (!res.ok) throw new Error('Error al actualizar el método de instalación')
  return res.json()
}

export async function updateFcManualCircuito(id: number, fc_manual: number | null) {
  const res = await apiFetch(`/circuitos/${id}/fc-manual`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fc_manual }),
  })
  if (!res.ok) throw new Error('Error al actualizar el FC')
  return res.json()
}

export async function updateFtManualCircuito(id: number, ft_manual: number | null) {
  const res = await apiFetch(`/circuitos/${id}/ft-manual`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ft_manual }),
  })
  if (!res.ok) throw new Error('Error al actualizar el FT')
  return res.json()
}

export async function updateSelectividadCircuito(id: number, data: { selectividad_Is: number | null; selectividad_total: boolean }) {
  const res = await apiFetch(`/circuitos/${id}/selectividad`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar el límite de selectividad')
  return res.json()
}

// Datos de la Planilla de Análisis de Cargas: Fs, cantidad de bocas/tomas, potencia unitaria.
export async function updateCargaCircuito(id: number, data: { factor_simultaneidad?: number | null; cantidad_puntos?: number | null; potencia_unitaria?: number | null }) {
  const res = await apiFetch(`/circuitos/${id}/carga`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => null)
    throw new Error(error?.error || 'Error al actualizar los datos de carga')
  }
  return res.json()
}

export async function updateNombreCircuito(id: number, circuito: string) {
  const res = await apiFetch(`/circuitos/${id}/nombre`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circuito })
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Error al actualizar el circuito')
  }
  return res.json()
}

export async function crearCircuitoVacio(tableroId: number) {
  const res = await apiFetch(`/circuitos/vacio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tablero_id: tableroId })
  })
  if (!res.ok) throw new Error('Error al crear el circuito')
  return res.json()
}

export async function duplicarCircuito(circuitoId: number) {
  const res = await apiFetch(`/circuitos/duplicar/${circuitoId}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Error al duplicar el circuito')
  return res.json()
}

export async function updateTipoCircuito(id: number, tipo: string | null) {
  const res = await apiFetch(`/circuitos/${id}/tipo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo }),
  })
  if (!res.ok) throw new Error('Error al actualizar tipo')
  return res.json()
}

export async function updateTableroDestinoCircuito(id: number, tablero_destino_id: number | null, acometida_destino_id: number | null = null) {
  const res = await apiFetch(`/circuitos/${id}/tablero-destino`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tablero_destino_id, acometida_destino_id }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => null)
    throw new Error(error?.error || 'Error al vincular el tablero destino')
  }
  return res.json()
}

export type FormacionPatch = {
  cable_id: number
  cond_por_fase: number
  Nfases: number
  Nneutro: number
  cable_neutro_id: number | null
  cable_tierra_id: number | null
  disposicion: string | null
}

export async function actualizarFasesBulk(items: { id: number; fase: string | null }[]) {
  const res = await apiFetch(`/circuitos/fase-bulk`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  })
  if (!res.ok) throw new Error('Error al actualizar fases')
  return res.json()
}

export async function renombrarCircuitosBulk(items: { id: number; circuito: string }[]) {
  const res = await apiFetch(`/circuitos/renombrar-bulk`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  })
  if (!res.ok) throw new Error('Error al renombrar circuitos')
  return res.json()
}

export async function reordenarCircuitos(ordenes: { id: number; orden: number }[]) {
  const res = await apiFetch(`/circuitos/reordenar`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ordenes),
  })
  if (!res.ok) throw new Error('Error al reordenar circuitos')
}

export async function crearCircuitoAuxiliar(parentId: number, role: 'retorno' | 'combinacion' | 'ramal') {
  const res = await apiFetch(`/circuitos/${parentId}/auxiliar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) throw new Error('Error al crear circuito auxiliar')
  return res.json()
}

export async function updateProteccionCircuito(id: number, proteccion_id: number | null) {
  const res = await apiFetch(`/circuitos/${id}/proteccion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proteccion_id }),
  })
  if (!res.ok) throw new Error('Error al actualizar la protección')
  return res.json()
}

export async function updateGrupoDiferencialCircuito(id: number, grupo_diferencial_id: number | null) {
  const res = await apiFetch(`/circuitos/${id}/grupo-diferencial`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grupo_diferencial_id }),
  })
  if (!res.ok) throw new Error('Error al actualizar el grupo diferencial')
  return res.json()
}

export async function updateFormacion(circuitoId: number, data: FormacionPatch) {
  const res = await apiFetch(`/circuitos/${circuitoId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Error al actualizar la formación')
  return res.json()
}
// Deshace un borrado (el back hace borrado lógico: ver Back/src/lib/borradoLogico.ts).
export async function restaurarCircuito(id: number) {
  const res = await apiFetch(`/circuitos/${id}/restaurar`, { method: 'POST' })
  if (!res.ok) throw new Error('No se pudo restaurar')
  return res.json()
}
