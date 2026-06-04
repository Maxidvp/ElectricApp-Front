'use client'
import { useState } from 'react'

type Props = {
  valor: string
  onGuardar: (v: string) => void
}

export default function CeldaEditable({ valor, onGuardar }: Props) {
  const [editando, setEditando] = useState(false)
  const [texto,    setTexto]    = useState(valor)

  const guardar = () => {
    setEditando(false)
    if (texto !== valor) onGuardar(texto)
  }

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
        className="w-full h-7 px-1.5 text-xs border border-info-a10 rounded-sm bg-surface-a10 text-font-a0 outline-none"
      />
    )
  }

  return (
    <span
      onClick={() => { setTexto(valor); setEditando(true) }}
      className={`cursor-text block w-full min-h-5 ${!valor ? 'text-surface-tonal-a40' : ''}`}
    >
      {valor || '—'}
    </span>
  )
}
