'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getFamiliasCables } from '@/services/familiasCables'
import { getCablesPorFamilia } from '@/services/cables'
import { useProyectos } from '@/context/ProyectosContext'

type FamiliaCable = { id: number; nombre: string; tipo: string }
export type CableItem = {
  id: number; nombre: string; seccion_f: string; calibre_tipo: string; diametro: number | null
  familia_id: number; Nfases: number; Nneutro: number; Ntierra: number; Iadm: number
}

type CablesContextType = {
  familias:          FamiliaCable[]   // todas las familias (para la página de cables)
  familiasFiltradas: FamiliaCable[]   // solo las del proyecto activo (para FormacionModal)
  getCablesDeFamilia: (familiaId: number) => Promise<CableItem[]>
}

// ── Caché singleton a nivel de módulo ────────────────────────────
const _cache:   Partial<Record<number, CableItem[]>>           = {}
const _pending: Partial<Record<number, Promise<CableItem[]>>>  = {}

function _fetchFamilia(familiaId: number): Promise<CableItem[]> {
  if (_cache[familiaId])   return Promise.resolve(_cache[familiaId])
  if (_pending[familiaId]) return _pending[familiaId]
  const promise = getCablesPorFamilia(familiaId).then(cables => {
    _cache[familiaId] = cables
    delete _pending[familiaId]
    return cables
  })
  _pending[familiaId] = promise
  return promise
}

export function prefetchCablesFamilias(ids: number[]) {
  ids.forEach(id => _fetchFamilia(id))
}

// ── Contexto ──────────────────────────────────────────────────────
const CablesContext = createContext<CablesContextType | null>(null)

function CablesProviderInner({ children, familias }: { children: React.ReactNode; familias: FamiliaCable[] }) {
  const { proyectoActivo } = useProyectos()

  const familiasFiltradas: FamiliaCable[] = proyectoActivo?.familia_ids?.length
    ? familias.filter(f => proyectoActivo.familia_ids.includes(f.id))
    : familias

  const getCablesDeFamilia = useCallback((familiaId: number): Promise<CableItem[]> => {
    return _fetchFamilia(familiaId)
  }, [])

  return (
    <CablesContext.Provider value={{ familias, familiasFiltradas, getCablesDeFamilia }}>
      {children}
    </CablesContext.Provider>
  )
}

export function CablesProvider({ children }: { children: React.ReactNode }) {
  const [familias, setFamilias] = useState<FamiliaCable[]>([])

  useEffect(() => {
    getFamiliasCables().then(setFamilias)
  }, [])

  return <CablesProviderInner familias={familias}>{children}</CablesProviderInner>
}

export function useCables() {
  const ctx = useContext(CablesContext)
  if (!ctx) throw new Error('useCables debe usarse dentro de CablesProvider')
  return ctx
}
