'use client'

type Props = {
  mensaje: string
  onConfirmar: () => void
  onCancelar: () => void
}

export default function ConfirmModal({ mensaje, onConfirmar, onCancelar }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={onCancelar}>
      <div
        className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] px-6 py-5 flex flex-col gap-4 min-w-[280px] max-w-[90vw]"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[13px] text-font-a0">{mensaje}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancelar}
            className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-danger-a0 bg-danger-a0 text-white hover:opacity-90"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
