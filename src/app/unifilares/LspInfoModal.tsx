'use client'

interface Props {
  onCerrar: () => void
}

export default function LspInfoModal({ onCerrar }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={onCerrar}>
      <div
        className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] px-6 py-5 flex flex-col gap-4 min-w-[380px] max-w-[520px]"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[14px] font-semibold text-font-a0">Cómo usar el archivo .lsp</p>

        <ol className="text-[13px] text-font-a20 flex flex-col gap-2.5 list-decimal pl-4">
          <li>
            En AutoCAD, ejecutá el comando <code className="text-info-a10">APPLOAD</code>, buscá el
            archivo <code className="text-info-a10">.lsp</code> descargado y hacé clic en <b>Cargar</b>.
          </li>
          <li>
            En la línea de comando, escribí el nombre del comando que indica el archivo
            (por ejemplo <code className="text-info-a10">UNIFILAR_TP-GENERAL</code>) y presioná Enter.
          </li>
          <li>
            El dibujo aparece en milímetros, con el mismo origen que tenga el dibujo activo — puede
            hacer falta un <code className="text-info-a10">ZOOM Extents</code> para verlo completo.
          </li>
          <li>
            Los símbolos se insertan como bloques. El script trae la definición de cada uno y
            la crea solo si el dibujo no tiene ya un bloque con ese nombre: en un dibujo vacío
            funciona sin preparar nada, y si ya tenés tu biblioteca cargada se usan tus bloques.
          </li>
        </ol>

        <div className="flex justify-end">
          <button
            onClick={onCerrar}
            className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 hover:opacity-90"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
