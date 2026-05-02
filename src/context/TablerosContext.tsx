'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { getTableros } from '@/services/tableros'

type Cable = {
  id: number
  nombre: string
  seccion_f: string
  diametro: number | null
  calibre_tipo: string
  familia_id: number
}

type Formacion = {
  id: number
  nombre: string
  cable_id: number
  cond_por_fase: number
  Nfases: number
  Nneutro: number
  cable_neutro_id: number | null
  cable_tierra_id: number | null
  cable: Cable
  cable_neutro: Cable | null
  cable_tierra: Cable | null
}

type Circuito = {
  id: number
  circuito: string
  tablero_id: number
  formacion_id: number
  formacion: Formacion
}

type Tablero = {
  id: number
  tag: string
  sistema_tension: string
  nombre: string | null
  ubicacion: string | null
  tipo: string | null
  tension_fase: number | null
  tension_neutro: number | null
  frecuencia: number | null
  corriente_nom: number | null
  corriente_cc: number | null
  potencia_inst: number | null
  potencia_dem: number | null
  fabricante: string | null
  modelo: string | null
  norma: string | null
  grado_proteccion: string | null
  alimentado_por: string | null
  circuitos: Circuito[]
}

type TablerosContextType = {
  tableros: Tablero[]
  loading: boolean
  error: string | null
  recargar: () => void
  getTablero: (id: number) => Tablero | undefined
  getCircuito: (id: number) => Circuito | undefined
}

const TablerosContext = createContext<TablerosContextType | null>(null)

export function TablerosProvider({ children }: { children: React.ReactNode }) {
  const [tableros, setTableros] = useState<Tablero[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = () => {
    setLoading(true)
    getTableros()
      .then(setTableros)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
  }, [])

  const getTablero = (id: number) => tableros.find((t) => t.id === id)

  const getCircuito = (id: number) => {
    for (const tablero of tableros) {
      const circuito = tablero.circuitos.find((c) => c.id === id)
      if (circuito) return circuito
    }
    return undefined
  }

  return (
    <TablerosContext.Provider value={{
      tableros, loading, error,
      recargar: cargar,
      getTablero,
      getCircuito,
    }}>
      {children}
    </TablerosContext.Provider>
  )
}

export function useTableros() {
  const ctx = useContext(TablerosContext)
  if (!ctx) throw new Error('useTableros debe usarse dentro de TablerosProvider')
  return ctx
}