'use client'
import { useState } from 'react'

// `acometidas`: las del tablero, en orden. La última es la principal (alimenta todo).
type TableroOpt = { id: number; tag: string; nombre: string | null; acometidas?: { id: number; circuito: string }[] }

type Props = {
  tableros: TableroOpt[]
  onCargaEquivalente: () => void
  // acometidaDestinoId null = toda la carga del tablero (acometida principal)
  onVincular: (tableroDestinoId: number, acometidaDestinoId: number | null) => void
  onCancelar: () => void
}

export default function AlimentadorModal({ tableros, onCargaEquivalente, onVincular, onCancelar }: Props) {
  const [seleccionado, setSeleccionado] = useState<number | null>(null)
  const [acometida, setAcometida] = useState<number | null>(null)
  // Solo tiene sentido elegir cuando el destino tiene más de una acometida.
  const acometidas = tableros.find(t => t.id === seleccionado)?.acometidas ?? []
  const principal = acometidas[acometidas.length - 1]
  const pill = (activo: boolean) => `px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
    activo ? 'bg-info-a0 border-info-a10 opacity-100 font-medium' : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'}`

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={onCancelar}>
      <div
        className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] px-6 py-5 flex flex-col gap-4 min-w-[320px] max-w-[90vw]"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[13px] text-font-a0">Este circuito es un ALIMENTADOR. ¿Cómo querés definirlo?</p>

        <button
          onClick={onCargaEquivalente}
          className="h-[34px] px-3 rounded-[7px] text-[13px] text-left cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a0 hover:bg-surface-tonal-a10"
        >
          Carga equivalente — cargar los valores a mano
        </button>

        {tableros.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-surface-tonal-a40">O vincular a un tablero existente del proyecto:</p>
            <div className="flex gap-1.5 flex-wrap max-w-[420px]">
              {tableros.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSeleccionado(t.id); setAcometida(null) }}
                  className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
                    seleccionado === t.id
                      ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
                      : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
                  }`}
                >
                  {t.nombre || t.tag}
                </button>
              ))}
            </div>
            {acometidas.length > 1 && (
              <>
                <p className="text-[12px] text-surface-tonal-a40 mt-1">
                  Ese tablero tiene más de una acometida. ¿A cuál llega este alimentador? Toma las cargas que esa acometida tiene arriba.
                </p>
                <div className="flex gap-1.5 flex-wrap max-w-[420px]">
                  {acometidas.map(a => {
                    const esPrincipal = a.id === principal.id
                    return (
                      <button key={a.id} onClick={() => setAcometida(esPrincipal ? null : a.id)} className={pill(esPrincipal ? acometida === null : acometida === a.id)}>
                        {a.circuito}{esPrincipal ? ' (principal: todo el tablero)' : ''}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancelar}
            className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0"
          >
            Cancelar
          </button>
          <button
            onClick={() => seleccionado != null && onVincular(seleccionado, acometida)}
            disabled={seleccionado === null}
            className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-info-a10 bg-info-a0 text-white hover:opacity-90 disabled:opacity-40"
          >
            Vincular
          </button>
        </div>
      </div>
    </div>
  )
}
