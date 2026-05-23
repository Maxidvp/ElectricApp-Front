const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export type ProyectoTablero = { id: number; tag: string; nombre: string | null }
export type ProyectoConjunto = { id: number; nombre: string }

export type Proyecto = {
  id: number
  nombre: string
  descripcion: string | null
  tableros: ProyectoTablero[]
  conjuntos: ProyectoConjunto[]
}

export async function getProyectos(): Promise<Proyecto[]> {
  const res = await fetch(`${API_URL}/proyectos`)
  if (!res.ok) throw new Error('Error al traer los proyectos')
  return res.json()
}

export async function createProyecto(data: { nombre: string; descripcion?: string | null }): Promise<Proyecto> {
  const res = await fetch(`${API_URL}/proyectos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al crear el proyecto')
  return res.json()
}

export async function updateProyecto(id: number, data: { nombre: string; descripcion?: string | null }): Promise<Proyecto> {
  const res = await fetch(`${API_URL}/proyectos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Error al actualizar el proyecto')
  return res.json()
}

export async function deleteProyecto(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/proyectos/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Error al eliminar el proyecto')
}
