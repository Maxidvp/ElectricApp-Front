import { apiFetch } from './apiFetch'
import type { Local } from '@/context/types'

// Locales del proyecto (Planilla de Locales). Llegan con la carga inicial del proyecto
// (GET /proyectos/:id); acá solo están las escrituras.

async function json(res: Response, mensaje: string) {
  if (!res.ok) {
    const error = await res.json().catch(() => null)
    throw new Error(error?.error || mensaje)
  }
  return res.json()
}

export async function crearLocal(proyecto_id: number, datos: Partial<Local> = {}): Promise<Local> {
  return json(await apiFetch('/locales', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...datos, proyecto_id }),
  }), 'Error al crear el local')
}

export async function actualizarLocal(id: number, datos: Partial<Local>): Promise<Local> {
  return json(await apiFetch(`/locales/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
  }), 'Error al actualizar el local')
}

export async function eliminarLocal(id: number) {
  return json(await apiFetch(`/locales/${id}`, { method: 'DELETE' }), 'Error al eliminar el local')
}
