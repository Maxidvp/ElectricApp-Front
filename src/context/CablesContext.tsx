'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getFamiliasCables } from '@/services/familiasCables'
import { getCablesPorFamilia } from '@/services/cables'

type FamiliaCable = { id: number; nombre: string }
export type CableItem = { id: number; nombre: string; seccion_f: string; calibre_tipo: string; diametro: number | null; familia_id: number; Nfases: number }

type CablesContextType = {
  familias: FamiliaCable[]
  getCablesDeFamilia: (familiaId: number) => Promise<CableItem[]>
}

const CablesContext = createContext<CablesContextType | null>(null)

export function CablesProvider({ children }: { children: React.ReactNode }) {
  const [familias, setFamilias] = useState<FamiliaCable[]>([])
  const cache = useRef<Record<number, CableItem[]>>({})

  useEffect(() => {
    getFamiliasCables().then(setFamilias)
  }, [])

  const getCablesDeFamilia = useCallback(async (familiaId: number): Promise<CableItem[]> => {
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
