'use client'
import { useState, useEffect } from 'react'
import '@/styles/circuitos-panel.css'

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
      <div className="tablero-tabs">
        {tableros.map(t => (
          <button
            key={t.id}
            className={`tablero-tab${tableroId === t.id ? ' activo' : ''}`}
            onClick={() => setTableroId(t.id)}
          >
            {t.tag}
          </button>
        ))}
      </div>
      <div className="circ-panel-circuitos">
        {circuitos.length === 0
          ? <span className="circ-panel-hint">Este tablero no tiene circuitos</span>
          : circuitos.map(c => {
              const asignado = asignados.some(a => a.id === c.id)
              return (
                <button
                  key={c.id}
                  className={`circ-panel-btn${asignado ? ' asignado' : ''}${!segmentoSeleccionado ? ' sin-seleccion' : ''}`}
                  onClick={() => onAsignar(c.id)}
                  disabled={!segmentoSeleccionado || asignado}
                  title={
                    !segmentoSeleccionado ? 'Seleccioná un tramo primero'
                    : asignado ? 'Ya asignado'
                    : 'Asignar al tramo seleccionado'
                  }
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
