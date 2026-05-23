'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import * as api from '@/services/proyectos'
import type { Proyecto } from '@/services/proyectos'

export type { Proyecto }

type ProyectosContextType = {
  proyectos: Proyecto[]
  loading: boolean
  error: string | null
  proyectoActivo: Proyecto | null
  setProyectoActivo: (p: Proyecto | null) => void
  recargar: () => void
  crearProyecto: (data: { nombre: string; descripcion?: string | null }) => Promise<Proyecto>
  actualizarProyecto: (id: number, data: { nombre: string; descripcion?: string | null }) => Promise<void>
  eliminarProyecto: (id: number) => Promise<void>
}

const ProyectosContext = createContext<ProyectosContextType | null>(null)

export function ProyectosProvider({ children }: { children: React.ReactNode }) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading]    = useState(true)
  const [error, setError]        = useState<string | null>(null)
  const [proyectoActivo, setProyectoActivo] = useState<Proyecto | null>(null)

  const cargar = () => {
    setLoading(true)
    api.getProyectos()
      .then(data => setProyectos(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  async function crearProyecto(data: { nombre: string; descripcion?: string | null }) {
    const nuevo = await api.createProyecto(data)
    setProyectos(prev => [...prev, nuevo])
    return nuevo
  }

  async function actualizarProyecto(id: number, data: { nombre: string; descripcion?: string | null }) {
    const updated = await api.updateProyecto(id, data)
    setProyectos(prev => prev.map(p => p.id === id ? updated : p))
    if (proyectoActivo?.id === id) setProyectoActivo(updated)
  }

  async function eliminarProyecto(id: number) {
    await api.deleteProyecto(id)
    setProyectos(prev => prev.filter(p => p.id !== id))
    if (proyectoActivo?.id === id) setProyectoActivo(null)
  }

  return (
    <ProyectosContext.Provider value={{
      proyectos, loading, error,
      proyectoActivo, setProyectoActivo,
      recargar: cargar,
      crearProyecto, actualizarProyecto, eliminarProyecto,
    }}>
      {children}
    </ProyectosContext.Provider>
  )
}

export function useProyectos() {
  const ctx = useContext(ProyectosContext)
  if (!ctx) throw new Error('useProyectos debe usarse dentro de ProyectosProvider')
  return ctx
}
