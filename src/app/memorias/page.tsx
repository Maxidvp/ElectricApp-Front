'use client'
import Link from 'next/link'
import { useMemoria } from '@/components/memoria/Hoja'
import { DOCUMENTOS } from '@/components/memoria/documentos'

// Índice de los documentos que se pueden emitir del proyecto. Cada uno se abre como
// vista previa imprimible en /memorias/<id>.
export default function Memorias() {
  const { proyectoActivo, evaluado } = useMemoria()
  if (!proyectoActivo) return <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin proyecto activo.</p>
  const { resumen } = evaluado

  return (
    <div className="subcontainer px-4 py-4 flex flex-col gap-4 min-h-dvh">
      <div>
        <h1 className="text-[16px] font-semibold text-font-a0 m-0">Memorias y planillas</h1>
        <p className="text-[12px] text-surface-tonal-a40 mt-0.5">
          {proyectoActivo.nombre} · {evaluado.tableros.length} tablero(s) de potencia · {resumen.circuitos} circuito(s).
          Los documentos muestran el estado actual del proyecto.
        </p>
      </div>

      {(resumen.error > 0 || resumen.falta > 0) && (
        <p className="text-[12px] rounded-md border border-surface-tonal-a20 px-3 py-2 w-fit" style={{ color: 'var(--clr-warning-a10)' }}>
          ⚠ El proyecto tiene {resumen.error} verificación(es) que no cumplen y {resumen.falta} dato(s) faltante(s): van a
          figurar en los documentos.{' '}
          <Link href="/verificacion" className="underline" style={{ color: 'inherit' }}>Revisar en Verificación</Link>
        </p>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {DOCUMENTOS.map(d => (
          <Link
            key={d.id} href={`/memorias/${d.id}`}
            className="datatable-container no-underline flex flex-col gap-2 p-4 hover:border-info-a10 transition-colors"
          >
            <span className="text-[14px] font-semibold text-font-a0">{d.titulo}</span>
            <span className="text-[12px] text-font-a20 leading-relaxed">{d.descripcion}</span>
            <span className="text-[11px] text-surface-tonal-a40 leading-relaxed">{d.contenido.join(' · ')}</span>
            <span className="text-[12px] mt-auto pt-1" style={{ color: 'var(--clr-info-a10)' }}>Abrir vista previa →</span>
          </Link>
        ))}
      </div>

      <p className="text-[11px] text-surface-tonal-a40 leading-relaxed">
        Cada documento se abre como una hoja lista para imprimir o guardar como PDF. Para conservar una emisión tal como
        salió, guardá un checkpoint del proyecto antes de seguir modificándolo.
      </p>
    </div>
  )
}
