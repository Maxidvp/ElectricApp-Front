'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getFamiliasCables } from '@/services/familiasCables'
import { getCablesPorFamilia } from '@/services/cables'

type FamiliaCable = { id: number; nombre: string }
type Cable = { id: number; nombre: string }

type CablesContextType = {
  familias: FamiliaCable[]
  getCablesDeFamilia: (familiaId: number) => Promise<Cable[]>
}

const CablesContext = createContext<CablesContextType | null>(null)

export function CablesProvider({ children }: { children: React.ReactNode }) {
  const [familias, setFamilias] = useState<FamiliaCable[]>([])
  const cache = useRef<Record<number, Cable[]>>({})

  useEffect(() => {
    getFamiliasCables().then(setFamilias)
  }, [])

  const getCablesDeFamilia = useCallback(async (familiaId: number): Promise<Cable[]> => {
    if (cache.current[familiaId]) return cache.current[familiaId]
    const cables = await getCablesPorFamilia(familiaId)
    cache.current[familiaId] = cables
    return cables
  }, [])

  return (
    <CablesContext.Provider value={{ familias, getCablesDeFamilia }}>
      {children}
    </CablesContext.Provider>
  )
}

export function useCables() {
  const ctx = useContext(CablesContext)
  if (!ctx) throw new Error('useCables debe usarse dentro de CablesProvider')
  return ctx
}
