'use client'
import { useState } from 'react'

type Props = {
  valor: string
  onGuardar: (v: string) => void
  align?: 'left' | 'center' | 'right'
}

export default function CeldaEditable({ valor, onGuardar, align = 'center' }: Props) {
  const [editando, setEditando] = useState(false)
  const [texto,    setTexto]    = useState(valor)

  const guardar = () => {
    setEditando(false)
    if (texto !== valor) onGuardar(texto)
  }

  const alignCx = align === 'right' ? 'text-right pr-1' : align === 'center' ? 'text-center' : 'text-left'

  if (editando) {
    return (
      <input
        autoFocus
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={guardar}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter')  guardar()
          if (e.key === 'Escape') { setTexto(valor); setEditando(false) }
        }}
        className={`w-full h-6 px-1.5 text-xs border border-info-a10 rounded-sm bg-surface-a10 text-font-a0 outline-none ${alignCx}`}
      />
    )
  }

  return (
    <span
      onClick={() => { setTexto(valor); setEditando(true) }}
      className={`cursor-text block w-full min-h-4 ${alignCx} ${!valor ? 'text-surface-tonal-a40' : ''}`}
    >
      {valor || '—'}
    </span>
  )
}
