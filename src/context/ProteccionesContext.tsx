'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getFamiliasProtecciones } from '@/services/familiasProtecciones'
import { getProteccionesPorFamilia } from '@/services/protecciones'
import type { FamiliaProteccion, Proteccion } from './types'

type ProteccionesContextType = {
  familias: FamiliaProteccion[]
  loading: boolean
  recargarFamilias: () => void
  getProteccionesDeFamilia: (familiaId: number) => Promise<Proteccion[]>
}

// ── Caché singleton a nivel de módulo (mismo patrón que CablesContext) ─────
const _cache:   Partial<Record<number, Proteccion[]>>          = {}
const _pending: Partial<Record<number, Promise<Proteccion[]>>> = {}

function _fetchFamilia(familiaId: number): Promise<Proteccion[]> {
  if (_cache[familiaId])   return Promise.resolve(_cache[familiaId])
  if (_pending[familiaId]) return _pending[familiaId]
  const promise = getProteccionesPorFamilia(familiaId).then(protecciones => {
    _cache[familiaId] = protecciones
    delete _pending[familiaId]
    return protecciones
  })
  _pending[familiaId] = promise
  return promise
}

// Se llama después de crear/editar/borrar una variante desde /protecciones, para que
// ProteccionModal (en otras rutas) no siga sirviendo datos viejos de la caché del módulo.
export function invalidarCacheProtecciones(familiaId: number) {
  delete _cache[familiaId]
}

const ProteccionesContext = createContext<ProteccionesContextType | null>(null)

export function ProteccionesProvider({ children }: { children: React.ReactNode }) {
  const [familias, setFamilias] = useState<FamiliaProteccion[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(() => {
    setLoading(true)
    getFamiliasProtecciones().then(setFamilias).finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const getProteccionesDeFamilia = useCallback((familiaId: number): Promise<Proteccion[]> => {
    return _fetchFamilia(familiaId)
  }, [])

  return (
    <ProteccionesContext.Provider value={{ familias, loading, recargarFamilias: cargar, getProteccionesDeFamilia }}>
      {children}
    </ProteccionesContext.Provider>
  )
}

export function useProtecciones() {
  const ctx = useContext(ProteccionesContext)
  if (!ctx) throw new Error('useProtecciones debe usarse dentro de ProteccionesProvider')
  return ctx
}
