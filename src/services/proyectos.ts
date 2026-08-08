import { apiFetch } from './apiFetch'

export type ProyectoTablero = { id: number; tag: string; nombre: string | null }
export type ProyectoConjunto = { id: number; nombre: string }

export type ProyectoFamilia = { id: number; nombre: string; material: string; aislamiento: string; tipo: string }

export type FormatoFormacion  = 'ingles' | 'extendida' | 'copaipa' | 'resumida'
export type NomenclaturaFases = 'RST' | 'L1L2L3' | 'ABC' | 'UVW'

export type ProyectoUsuario = { id: number; email: string; nombre: string | null }

export type Proyecto = {
  id: number
  nombre: string
  descripcion: string | null
  familia_ids: number[]
  familias: ProyectoFamilia[]
  tableros: ProyectoTablero[]
  conjuntos: ProyectoConjunto[]
  formato_formacion:  FormatoFormacion
  nomenclatura_fases: NomenclaturaFases
  usuario_id: number
  usuario: ProyectoUsuario
  participantes: { usuario: ProyectoUsuario }[]
}

export async function getProyectos(): Promise<Proyecto[]> {
  const res = await apiFetch(`/proyectos`)
  if (!res.ok) throw new Error('Error al traer los proyectos')
  return res.json()
}

export async function createProyecto(data: { nombre: string; descripcion?: string | null }): Promise<Proyecto> {
  const res = await apiFetch(`/proyectos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear el proyecto')
  return res.json()
}

export async function updateProyecto(id: number, data: { nombre: string; descripcion?: string | null; formato_formacion?: string; nomenclatura_fases?: string }): Promise<Proyecto> {
  const res = await apiFetch(`/proyectos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar el proyecto')
  return res.json()
}

export async function deleteProyecto(id: number): Promise<void> {
  const res = await apiFetch(`/proyectos/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar el proyecto')
}

export async function agregarFamiliaProyecto(proyectoId: number, familiaId: number): Promise<void> {
  const res = await apiFetch(`/proyectos/${proyectoId}/familias/${familiaId}`, { method: 'POST' })
  if (!res.ok) throw new Error('Error al agregar familia')
}

export async function quitarFamiliaProyecto(proyectoId: number, familiaId: number): Promise<void> {
  const res = await apiFetch(`/proyectos/${proyectoId}/familias/${familiaId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al quitar familia')
}

export async function agregarParticipante(proyectoId: number, email: string): Promise<Proyecto> {
  const res = await apiFetch(`/proyectos/${proyectoId}/participantes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al agregar participante')
  return res.json()
}

export async function quitarParticipante(proyectoId: number, usuarioId: number): Promise<Proyecto> {
  const res = await apiFetch(`/proyectos/${proyectoId}/participantes/${usuarioId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al quitar participante')
  return res.json()
}
