'use client'
import { useState } from 'react'
import { flexRender, type Table } from '@tanstack/react-table'
import type { Tablero } from '@/context/types'

// Piezas compartidas por las páginas de cálculo por tablero (Ampacidad, Caídas,
// Cortocircuitos): selector de tablero, encabezado con leyenda, tabla con columnas
// redimensionables coloreadas por tipo y celda numérica de solo lectura. Antes cada
// página tenía su propia copia.

// Tipo de columna → color. `editable` (azul), `auto`/calculado (gris), `result` (verde).
export type ColMeta = { colType: 'label' | 'editable' | 'auto' | 'result' }

export const COLOR_EDITABLE = '#4A8FD4'
export const COLOR_RESULTADO = '#6aab6a'

// Selector de tablero en forma de pastillas.
export function TableroPills({ tableros, idActivo, onSelect }: {
  tableros: Tablero[]; idActivo: number | null; onSelect: (id: number) => void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {tableros.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
            idActivo === t.id
              ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
              : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
          }`}
        >
          {t.nombre || t.tag}
        </button>
      ))}
    </div>
  )
}

function Punto({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
}

// Encabezado de la tabla: tag y nombre del tablero, contenido extra opcional (ej. la
// Icc de barra) y la leyenda de colores de columna.
export function EncabezadoTablero({ tablero, etiquetaAuto = 'Calculado', children }: {
  tablero: Tablero; etiquetaAuto?: string; children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--dt-border-color)]">
      <div className="flex items-center gap-2.5">
        <span className="text-[14px] font-semibold text-font-a0">{tablero.tag}</span>
        {tablero.nombre && <span className="text-[13px] text-surface-tonal-a40">{tablero.nombre}</span>}
        {children}
      </div>
      <div className="flex items-center gap-3.5 text-[11px] text-surface-tonal-a40">
        <span className="flex items-center gap-1.5"><Punto color={COLOR_EDITABLE} /> Editable</span>
        <span className="flex items-center gap-1.5"><Punto color="var(--clr-surface-tonal-a40)" /> {etiquetaAuto}</span>
        <span className="flex items-center gap-1.5"><Punto color={COLOR_RESULTADO} /> Resultado</span>
      </div>
    </div>
  )
}

// Tabla tanstack con columnas redimensionables y fondo según `meta.colType`.
export function TablaCalculo<T>({ table, vacio = 'Sin circuitos en este tablero.' }: { table: Table<T>; vacio?: string }) {
  const filas = table.getRowModel().rows
  return (
    <>
      <div className="flex justify-center">
        <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
          <table
            className="datatable"
            style={{ width: table.getTotalSize(), tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}
          >
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => {
                    const colType = (header.column.columnDef.meta as ColMeta | undefined)?.colType
                    return (
                      <th key={header.id} style={{
                        width: header.getSize(), position: 'relative', textAlign: 'center',
                        color: colType === 'result' ? COLOR_RESULTADO : undefined,
                      }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanResize() && (
                          <div onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} className="resizer" />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {filas.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => {
                    const colType = (cell.column.columnDef.meta as ColMeta | undefined)?.colType
                    return (
                      <td key={cell.id} style={{
                        width: cell.column.getSize(),
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        background: colType === 'editable' ? `color-mix(in srgb, ${COLOR_EDITABLE} 4%, transparent)`
                                  : colType === 'result'   ? `color-mix(in srgb, ${COLOR_RESULTADO} 6%, transparent)`
                                  : undefined,
                      }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {filas.length === 0 && (
        <p style={{ padding: 16, textAlign: 'center', color: 'var(--clr-surface-tonal-a40)', fontSize: 13 }}>{vacio}</p>
      )}
    </>
  )
}

// Celda numérica de solo lectura ("—" si no hay valor).
export function AutoCell({ value, decimals = 2, unit }: { value: number | null; decimals?: number; unit?: string }) {
  if (value === null) return (
    <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'center' }}>—</span>
  )
  return (
    <span style={{ fontSize: 12, display: 'block', textAlign: 'center', color: 'var(--clr-font-a20)' }}>
      {value.toFixed(decimals)}{unit ? <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.6 }}>{unit}</span> : null}
    </span>
  )
}

// Anchos de columna recordados en localStorage, para pasarle a useReactTable.
export function useColSizing(clave: string) {
  const [colSizing, setColSizing] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(clave) ?? '{}') } catch { return {} }
  })
  const onColumnSizingChange = (upd: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    const next = typeof upd === 'function' ? upd(colSizing) : upd
    setColSizing(next)
    try { localStorage.setItem(clave, JSON.stringify(next)) } catch {}
  }
  return { colSizing, onColumnSizingChange }
}
