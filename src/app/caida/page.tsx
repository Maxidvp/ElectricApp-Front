'use client'
import { useState, useMemo, useCallback } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useProyectos } from '@/context/ProyectosContext'
import { generarFormacion, calcDrops as calcDropsUtil, calcCorriente, type CaidaInput } from '@/utils/electricidad'

// ── Types ─────────────────────────────────────────────────────────

type CaidaRow = {
  id:            number
  circuito:      string
  formacion:     string
  nfases:        number
  cfAuto:        number | null
  fpAuto:        number | null
  largoAuto:     number | null
  tensionAuto:   number | null
  corrienteAuto: number | null
  input:         CaidaInput
  ev:            number | null
  epct:          number | null
}

const DEFAULT_INPUT: CaidaInput = {
  tension: '', fp: '', in_: '', cf: '', l: '', r: '', x: '',
}

// ── Editable number cell ──────────────────────────────────────────

function NumCell({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)

  const commit = () => { setEditing(false); onChange(draft) }

  if (editing) return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter')  commit()
        if (e.key === 'Escape') { setDraft(value); setEditing(false) }
      }}
      style={{
        width: '100%', textAlign: 'right', padding: '0 4px', height: 26,
        background: 'var(--clr-surface-tonal-a0)', color: 'var(--clr-font-a0)',
        border: '1px solid var(--clr-info-a10)', borderRadius: 3, fontSize: 12, outline: 'none',
      }}
    />
  )

  const display = value || hint
  return (
    <span
      onClick={() => { setDraft(value || hint || ''); setEditing(true) }}
      style={{
        display: 'block', width: '100%', textAlign: 'right',
        cursor: 'text', minHeight: 20, fontSize: 12,
        color: display ? 'var(--clr-font-a0)' : 'var(--clr-surface-tonal-a40)',
      }}
    >
      {display || '—'}
    </span>
  )
}

// ── Readonly computed cell ────────────────────────────────────────

function ComputedCell({ value, decimals = 2, warn }: { value: number | null; decimals?: number; warn?: boolean }) {
  if (value === null) return <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12 }}>—</span>
  return (
    <span style={{ fontSize: 12, fontWeight: 500, color: warn ? 'var(--clr-danger-a10)' : 'var(--clr-font-a0)' }}>
      {value.toFixed(decimals)}
    </span>
  )
}

// ── Column definition ─────────────────────────────────────────────

const columnHelper = createColumnHelper<CaidaRow>()

// ── Page ──────────────────────────────────────────────────────────

export default function CaidaTension() {
  const { tableros, getTablero, loading, error } = useProyectos()

  const [tableroId, setTableroId] = useState<number | null>(() => {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
    return m ? Number(m[1]) : null
  })
  const [inputs,    setInputs]    = useState<Record<number, CaidaInput>>({})

  const idEfectivo = tableroId ?? tableros[0]?.id ?? null
  const tablero    = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  const setField = useCallback((id: number, field: keyof CaidaInput, val: string) => {
    setInputs(prev => ({
      ...prev,
      [id]: { ...DEFAULT_INPUT, ...prev[id], [field]: val },
    }))
  }, [])

  const rows = useMemo((): CaidaRow[] => {
    if (!tablero) return []
    const sorted = [...tablero.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
    return sorted.map(c => {
      const input     = inputs[c.id] ?? DEFAULT_INPUT
      const nfases    = c.formacion?.Nfases ?? 3
      const cfAuto    = c.formacion?.cable?.Nfases ?? null
      const fpAuto    = c.FP ?? null
      const largoAuto = c.Largo ?? null
      const tipo      = c.tipo_tension
      const tensionAuto = tipo === 'mono' ? (tablero as any).tension_mono
                        : tipo === 'bi'   ? (tablero as any).tension_bi
                        : tipo === 'tri'  ? (tablero as any).tension_tri
                        : null
      const corrienteAuto = calcCorriente(c.potencia ?? null, tipo, tensionAuto, fpAuto)
      const formacion = c.formacion ? generarFormacion(c.formacion) : '—'
      const { ev, epct } = calcDropsUtil(input, nfases, cfAuto, fpAuto, largoAuto, tensionAuto)
      return { id: c.id, circuito: c.circuito, formacion, nfases, cfAuto, fpAuto, largoAuto, tensionAuto, corrienteAuto, input, ev, epct }
    })
  }, [tablero, inputs])

  const columns = useMemo(() => [
    columnHelper.accessor('circuito', {
      header: 'Circuito',
      size: 120,
      cell: info => <span style={{ fontSize: 12, fontWeight: 500 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('formacion', {
      header: 'Formación',
      size: 160,
      cell: info => <span style={{ fontSize: 12 }}>{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'tension', header: 'E (V)', size: 90,
      cell: info => {
        const { tensionAuto } = info.row.original
        if (tensionAuto === null) return <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'right' }}>—</span>
        return <span style={{ fontSize: 12, display: 'block', textAlign: 'right' }}>{tensionAuto}</span>
      },
    }),
    columnHelper.display({
      id: 'fp', header: 'F.P.', size: 70,
      cell: info => {
        const { id, input, fpAuto } = info.row.original
        return <NumCell value={input.fp} onChange={v => setField(id, 'fp', v)} hint={fpAuto !== null ? String(fpAuto) : undefined} />
      },
    }),
    columnHelper.display({
      id: 'in_', header: 'In (A)', size: 80,
      cell: info => {
        const { id, input, corrienteAuto } = info.row.original
        return <NumCell value={input.in_} onChange={v => setField(id, 'in_', v)} hint={corrienteAuto !== null ? corrienteAuto.toFixed(2) : undefined} />
      },
    }),
    columnHelper.display({
      id: 'cf', header: 'N° conductores', size: 100,
      cell: info => {
        const { cfAuto } = info.row.original
        if (cfAuto === null) return <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'right' }}>—</span>
        return <span style={{ fontSize: 12, display: 'block', textAlign: 'right' }}>{cfAuto}</span>
      },
    }),
    columnHelper.display({
      id: 'l', header: 'L (m)', size: 80,
      cell: info => {
        const { id, input, largoAuto } = info.row.original
        return <NumCell value={input.l} onChange={v => setField(id, 'l', v)} hint={largoAuto !== null ? String(largoAuto) : undefined} />
      },
    }),
    columnHelper.display({
      id: 'r', header: 'R (Ω/km)', size: 90,
      cell: info => <NumCell value={info.row.original.input.r} onChange={v => setField(info.row.original.id, 'r', v)} />,
    }),
    columnHelper.display({
      id: 'x', header: 'X (Ω/km)', size: 90,
      cell: info => <NumCell value={info.row.original.input.x} onChange={v => setField(info.row.original.id, 'x', v)} />,
    }),
    columnHelper.accessor('ev', {
      header: 'e (V)',
      size: 80,
      cell: info => <ComputedCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('epct', {
      header: 'e (%)',
      size: 80,
      cell: info => {
        const v = info.getValue()
        return <ComputedCell value={v} decimals={2} warn={v !== null && v > 3} />
      },
    }),
  ], [setField])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    enableColumnResizing: true,
  })

  if (loading && !tablero) return <p style={{ padding: 24 }}>Cargando...</p>
  if (error) return <p style={{ padding: 24, color: 'red' }}>Error: {error}</p>

  return (
    <div className="subcontainer">
      <div className="flex gap-1.5 px-3 pt-3 pb-2 flex-wrap">
        {tableros.map(t => (
          <button
            key={t.id}
            onClick={() => { document.cookie = `last_tablero_id=${t.id};path=/;max-age=31536000`; setTableroId(t.id) }}
            className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
              idEfectivo === t.id
                ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
                : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
            }`}
          >
            {t.nombre || t.tag}
          </button>
        ))}
      </div>

      {!tablero ? (
        <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin tablero activo.</p>
      ) : (
        <div className="datatable-container">
          <div className="flex items-center justify-center gap-2.5 px-3.5 py-2.5 border-b border-[var(--dt-border-color)]">
            <span className="text-[14px] font-semibold text-font-a0">{tablero.tag}</span>
            {tablero.nombre && (
              <span className="text-[13px] text-surface-tonal-a40">{tablero.nombre}</span>
            )}
          </div>
          <table
            className="datatable"
            style={{ width: table.getTotalSize(), tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}
          >
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map((header, hi) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), position: 'relative', textAlign: hi < 2 ? 'left' : 'right' }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="resizer"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell, ci) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize(), textAlign: ci < 2 ? 'left' : 'right', verticalAlign: 'middle' }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p style={{ padding: 16, textAlign: 'center', color: 'var(--clr-surface-tonal-a40)', fontSize: 13 }}>
              Sin circuitos en este tablero.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
