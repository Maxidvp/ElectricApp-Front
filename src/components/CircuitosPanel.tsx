'use client'
import { useState, useEffect } from 'react'

type Tablero = {
  id: number
  tag: string
  circuitos: { id: number; circuito: string }[]
}

type Props = {
  tableros: Tablero[]
  asignados: { id: number }[]
  segmentoSeleccionado: boolean
  onAsignar: (circId: number) => void
}

export default function CircuitosPanel({ tableros, asignados, segmentoSeleccionado, onAsignar }: Props) {
  const [tableroId, setTableroId] = useState<number | null>(null)

  useEffect(() => {
    if (tableros.length > 0 && tableroId === null) setTableroId(tableros[0].id)
  }, [tableros, tableroId])

  const circuitos = tableros.find(t => t.id === tableroId)?.circuitos ?? []

  return (
    <div>
      <div className="flex gap-1.5 px-3 pt-3 pb-2 flex-wrap">
        {tableros.map(t => (
          <button
            key={t.id}
            onClick={() => setTableroId(t.id)}
            className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
              tableroId === t.id
                ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
                : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
            }`}
          >
            {t.tag}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.25 px-3 pb-2.5 min-h-11 items-center">
        {circuitos.length === 0
          ? <span className="text-xs text-surface-tonal-a40">Este tablero no tiene circuitos</span>
          : circuitos.map(c => {
              const asignado = asignados.some(a => a.id === c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => onAsignar(c.id)}
                  disabled={!segmentoSeleccionado || asignado}
                  title={
                    !segmentoSeleccionado ? 'Seleccioná un tramo primero'
                    : asignado ? 'Ya asignado'
                    : 'Asignar al tramo seleccionado'
                  }
                  className={`px-3 py-1 rounded-[14px] border text-xs cursor-pointer transition-[background,border-color,opacity] duration-120 ${
                    asignado
                      ? 'bg-success-a0 border-success-a10 text-success-a20 cursor-default'
                      : !segmentoSeleccionado
                      ? 'bg-transparent border-surface-tonal-a30 text-font-a10 opacity-35'
                      : 'bg-transparent border-surface-tonal-a30 text-font-a10 hover:bg-info-a0 hover:border-info-a10'
                  }`}
                >
                  {c.circuito}
                </button>
              )
            })
        }
      </div>
    </div>
  )
}
