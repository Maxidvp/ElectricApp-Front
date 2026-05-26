'use client'
import { useState, useMemo, useCallback } from 'react'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useProyectos } from '@/context/ProyectosContext'

// ── Types ─────────────────────────────────────────────────────────

type CaidaInput = {
  tension: string   // V — EFN para monofásico 2 hilos, EFF para trifásico y bifásico
  fp:      string   // cos θ (0–1)
  in_:     string   // A — corriente nominal
  cf:      string   // conductores por fase (override; si vacío usa el de la formación)
  l:       string   // km — longitud del conductor
  r:       string   // Ω/km — resistencia a 90°C
  x:       string   // Ω/km — reactancia
}

type CaidaRow = {
  id:       number
  circuito: string
  formacion: string
  nfases:   number
  cfAuto:   number | null   // cond_por_fase de la formación
  fpAuto:   number | null   // FP del circuito
  largoAuto: number | null  // Largo del circuito en km (Largo[m] / 1000)
  input:    CaidaInput
  ev:       number | null
  epct:     number | null
}

const DEFAULT_INPUT: CaidaInput = {
  tension: '', fp: '', in_: '', cf: '', l: '', r: '', x: '',
}

// ── Calculation ───────────────────────────────────────────────────
// Monofásico 2 hilos:  e[V] = 2   × (In/CF) × L × (R·cosθ + X·sinθ),  %e = e[V]/EFN × 100
// Trifásico:           e[V] = √3  × (In/CF) × L × (R·cosθ + X·sinθ),  %e = e[V]/EFF × 100
// Bifásico 3 hilos:    e[V] = 2   × (In/CF) × L × (R·cosθ + X·sinθ),  %e = e[V]/EFF × 100

function calcDrops(
  input: CaidaInput,
  nfases: number,
  cfAuto: number | null,
  fpAuto: number,
  largoAuto: number | null,
) {
  const fp  = parseFloat(input.fp)  || fpAuto
  const in_ = parseFloat(input.in_)
  const cf  = parseFloat(input.cf)  || cfAuto || NaN
  const l   = parseFloat(input.l)   || largoAuto || NaN
  const r   = parseFloat(input.r)
  const x   = parseFloat(input.x)
  if ([fp, in_, cf, l, r, x].some(isNaN) || cf <= 0) return { ev: null, epct: null }
  const cosφ   = Math.min(1, Math.max(0, fp))
  const sinφ   = Math.sqrt(Math.max(0, 1 - cosφ * cosφ))
  const factor = nfases >= 3 ? Math.sqrt(3) : 2
  const ev     = factor * (in_ / cf) * l * (r * cosφ + x * sinφ)
  const tension = parseFloat(input.tension)
  const epct   = !isNaN(tension) && tension > 0 ? (ev / tension) * 100 : null
  return { ev, epct }
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
      onClick={() => { setDraft(value); setEditing(true) }}
      style={{
        display: 'block', width: '100%', textAlign: 'right',
        cursor: 'text', minHeight: 20, fontSize: 12,
        color: value ? 'var(--clr-font-a0)' : 'var(--clr-surface-tonal-a40)',
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

  const [tableroId, setTableroId] = useState<number | null>(null)
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
      const nfases    = (c.formacion as any)?.Nfases ?? 3
      const cfAuto    = (c.formacion as any)?.cond_por_fase ?? null
      const fpAuto    = (c as any).FP ?? 0.8
      const largoAuto = (c as any).Largo ?? null
      const { ev, epct } = calcDrops(input, nfases, cfAuto, fpAuto, largoAuto)
      return { id: c.id, circuito: c.circuito, formacion: c.formacion?.nombre ?? '—', nfases, cfAuto, fpAuto, largoAuto, input, ev, epct }
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
      cell: info => <NumCell value={info.row.original.input.tension} onChange={v => setField(info.row.original.id, 'tension', v)} />,
    }),
    columnHelper.display({
      id: 'fp', header: 'F.P.', size: 70,
      cell: info => {
        const { id, input, fpAuto } = info.row.original
        return <NumCell value={input.fp} onChange={v => setField(id, 'fp', v)} hint={String(fpAuto)} />
      },
    }),
    columnHelper.display({
      id: 'in_', header: 'In (A)', size: 80,
      cell: info => <NumCell value={info.row.original.input.in_} onChange={v => setField(info.row.original.id, 'in_', v)} />,
    }),
    columnHelper.display({
      id: 'cf', header: 'CF', size: 60,
      cell: info => {
        const { id, input, cfAuto } = info.row.original
        return <NumCell value={input.cf} onChange={v => setField(id, 'cf', v)} hint={cfAuto !== null ? String(cfAuto) : undefined} />
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
      <div className="tablero-tabs">
        {tableros.map(t => (
          <button
            key={t.id}
            className={`tablero-tab${idEfectivo === t.id ? ' activo' : ''}`}
            onClick={() => setTableroId(t.id)}
          >
            {t.nombre || t.tag}
          </button>
        ))}
      </div>

      {!tablero ? (
        <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin tablero activo.</p>
      ) : (
        <div className="datatable-container">
          <div style={{
            padding: '10px 14px 8px',
            borderBottom: '1px solid var(--dt-border-color)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--clr-font-a0)' }}>
              {tablero.tag}
            </span>
            {tablero.nombre && (
              <span style={{ fontSize: 13, color: 'var(--clr-surface-tonal-a40)', marginLeft: 10 }}>
                {tablero.nombre}
              </span>
            )}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      style={{
                        width: header.getSize(), position: 'relative',
                        padding: '8px 10px', textAlign: 'right',
                        fontSize: 11, fontWeight: 600, color: 'var(--clr-font-a0)',
                        borderBottom: '1px solid var(--dt-border-color)',
                        userSelect: 'none', whiteSpace: 'nowrap',
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          style={{
                            position: 'absolute', right: 0, top: 0,
                            height: '100%', width: 4, cursor: 'col-resize', userSelect: 'none',
                          }}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 1 ? 'var(--dt-even-row-color)' : undefined }}>
                  {row.getVisibleCells().map((cell, ci) => (
                    <td
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(), padding: '4px 10px',
                        textAlign: ci < 2 ? 'left' : 'right',
                        borderBottom: '1px solid var(--dt-border-color)',
                        verticalAlign: 'middle',
                      }}
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
