'use client'
import { useState } from 'react'

type TableroOpt = { id: number; tag: string; nombre: string | null }

type Props = {
  tableros: TableroOpt[]
  onCargaEquivalente: () => void
  onVincular: (tableroDestinoId: number) => void
  onCancelar: () => void
}

export default function AlimentadorModal({ tableros, onCargaEquivalente, onVincular, onCancelar }: Props) {
  const [seleccionado, setSeleccionado] = useState<number | null>(null)

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
                  onClick={() => setSeleccionado(t.id)}
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
            onClick={() => seleccionado != null && onVincular(seleccionado)}
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
