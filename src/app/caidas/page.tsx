'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { InlineMath } from 'react-katex'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useProyectos } from '@/context/ProyectosContext'
import { useCables, type CableItem } from '@/context/CablesContext'
import { generarFormacion, calcDrops as calcDropsUtil, calcCorriente, calcReactancia, calcResistencia, type CaidaInput } from '@/utils/electricidad'

// ── Types ─────────────────────────────────────────────────────────

type CaidaRow = {
  id:            number
  circuito:      string
  formacion:     string
  familiaId:     number | null
  cableId:       number | null
  nfases:        number
  cfAuto:        number | null
  fpAuto:        number | null
  largoAuto:     number | null
  tensionAuto:   number | null
  corrienteAuto: number | null
  rAuto:         number | null
  xAuto:         number | null
  input:         CaidaInput
  ev:            number | null
  epct:          number | null
}

type ColMeta = { colType: 'label' | 'editable' | 'auto' | 'result' }

const DEFAULT_INPUT: CaidaInput = {
  tension: '', fp: '', in_: '', cf: '', l: '', r: '', x: '', cable_id: '',
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

// ── Auto-filled read-only cell ────────────────────────────────────

function AutoCell({ value, decimals = 2 }: { value: number | null; decimals?: number }) {
  if (value === null) return (
    <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'right' }}>—</span>
  )
  return (
    <span style={{ fontSize: 12, display: 'block', textAlign: 'right', color: 'var(--clr-font-a20)' }}>
      {value.toFixed(decimals)}
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

// ── Cable selector ────────────────────────────────────────────────

function CableSelect({ familiaId, value, defaultId, onChange }: {
  familiaId: number
  value: string      // override seleccionado por el usuario (puede ser '')
  defaultId: string  // id del cable de la formación (pre-selección)
  onChange: (cable: CableItem | null) => void
}) {
  const { getCablesDeFamilia } = useCables()
  const [cables, setCables] = useState<CableItem[]>([])

  useEffect(() => {
    getCablesDeFamilia(familiaId).then(setCables)
  }, [familiaId, getCablesDeFamilia])

  const displayValue = value || defaultId

  return (
    <select
      value={displayValue}
      onClick={e => e.stopPropagation()}
      onChange={e => {
        const v = e.target.value
        // si el usuario vuelve a elegir el cable original, limpiamos el override
        const cable = cables.find(c => String(c.id) === v) ?? null
        onChange(v === defaultId ? null : cable)
      }}
      style={{
        width: '100%', height: 26, padding: '0 4px', fontSize: 12,
        background: 'var(--clr-surface-a10)', color: 'var(--clr-font-a0)',
        border: '1px solid transparent', borderRadius: 3, outline: 'none', cursor: 'pointer',
      }}
    >
      {cables.map(c => (
        <option key={c.id} value={String(c.id)}>{c.nombre}</option>
      ))}
    </select>
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
  const [inputs,     setInputs]     = useState<Record<number, CaidaInput>>({})
  const [cableCache, setCableCache] = useState<Record<number, CableItem>>({})

  const idEfectivo = tableroId ?? tableros[0]?.id ?? null
  const tablero    = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  const setField = useCallback((id: number, field: keyof CaidaInput, val: string) => {
    setInputs(prev => ({
      ...prev,
      [id]: { ...DEFAULT_INPUT, ...prev[id], [field]: val },
    }))
  }, [])

  const selectCable = useCallback((circuitId: number, cable: CableItem | null) => {
    const cid = cable ? String(cable.id) : ''
    if (cable) setCableCache(prev => ({ ...prev, [cable.id]: cable }))
    setInputs(prev => ({ ...prev, [circuitId]: { ...DEFAULT_INPUT, ...prev[circuitId], cable_id: cid } }))
  }, [])

  const rows = useMemo((): CaidaRow[] => {
    if (!tablero) return []
    const sorted = [...tablero.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
    return sorted.map(c => {
      const input = inputs[c.id] ?? DEFAULT_INPUT
      const overrideId = input.cable_id ? Number(input.cable_id) : null
      const effectiveCable = (overrideId ? cableCache[overrideId] : null) ?? c.formacion?.cable ?? null

      const nfases    = c.formacion?.Nfases ?? 3
      const cfAuto    = effectiveCable?.Nfases ?? null
      const fpAuto    = c.FP ?? null
      const largoAuto = c.Largo ?? null
      const tipo      = c.tipo_tension
      const tensionAuto = tipo === 'mono' ? (tablero as any).tension_mono
                        : tipo === 'bi'   ? (tablero as any).tension_bi
                        : tipo === 'tri'  ? (tablero as any).tension_tri
                        : null
      const corrienteAuto = calcCorriente(c.potencia ?? null, tipo, tensionAuto, fpAuto)
      const mat  = effectiveCable ? (effectiveCable as any).familia?.material   ?? null : null
      const temp = effectiveCable ? (effectiveCable as any).familia?.temperatura ?? null : null
      const rAuto = effectiveCable ? calcResistencia(
        effectiveCable.seccion_f,
        effectiveCable.calibre_tipo,
        mat,
        temp,
      ) : null
      const xAuto = effectiveCable ? calcReactancia(
        effectiveCable.diametro,
        effectiveCable.seccion_f,
        effectiveCable.calibre_tipo,
        c.formacion?.disposicion ?? null,
        effectiveCable.Nfases,
      ) : null
      const formacion = c.formacion ? generarFormacion(c.formacion) : '—'
      const { ev, epct } = calcDropsUtil(input, nfases, cfAuto, fpAuto, largoAuto, tensionAuto, xAuto, corrienteAuto, rAuto)
      return {
        id: c.id, circuito: c.circuito, formacion,
        familiaId: c.formacion?.cable?.familia_id ?? null,
        cableId:   c.formacion?.cable?.id         ?? null,
        nfases, cfAuto, fpAuto, largoAuto, tensionAuto, corrienteAuto, rAuto, xAuto, input, ev, epct,
      }
    })
  }, [tablero, inputs, cableCache])

  const columns = useMemo(() => [
    // ── Identificador ────────────────────────────────────────────
    columnHelper.accessor('circuito', {
      header: 'Circuito', size: 120,
      meta: { colType: 'label' } as ColMeta,
      cell: info => <span style={{ fontSize: 12, fontWeight: 500 }}>{info.getValue()}</span>,
    }),
    // ── Autocompletados ──────────────────────────────────────────
    columnHelper.display({
      id: 'tension', header: 'E (V)', size: 90,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.row.original.tensionAuto} decimals={0} />,
    }),
    columnHelper.display({
      id: 'in_', header: 'In (A)', size: 80,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.row.original.corrienteAuto} decimals={2} />,
    }),
    columnHelper.display({
      id: 'r', header: 'R (Ω/km)', size: 90,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.row.original.rAuto} decimals={4} />,
    }),
    columnHelper.display({
      id: 'x', header: 'X (Ω/km)', size: 90,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.row.original.xAuto} decimals={4} />,
    }),
    // ── Editables ────────────────────────────────────────────────
    columnHelper.display({
      id: 'cable', header: 'Cable', size: 160,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, familiaId, cableId, input } = info.row.original
        if (!familiaId || !cableId) return (
          <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12 }}>— Cable —</span>
        )
        return (
          <CableSelect
            familiaId={familiaId}
            value={input.cable_id}
            defaultId={String(cableId)}
            onChange={cable => selectCable(id, cable)}
          />
        )
      },
    }),
    columnHelper.display({
      id: 'fp', header: 'F.P.', size: 70,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, input, fpAuto } = info.row.original
        return <NumCell value={input.fp} onChange={v => setField(id, 'fp', v)} hint={fpAuto !== null ? String(fpAuto) : undefined} />
      },
    }),
    columnHelper.display({
      id: 'cf', header: 'N° cond.', size: 80,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, input, cfAuto } = info.row.original
        return <NumCell value={input.cf} onChange={v => setField(id, 'cf', v)} hint={cfAuto !== null ? String(cfAuto) : undefined} />
      },
    }),
    columnHelper.display({
      id: 'l', header: 'L (m)', size: 80,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, input, largoAuto } = info.row.original
        return <NumCell value={input.l} onChange={v => setField(id, 'l', v)} hint={largoAuto !== null ? String(largoAuto) : undefined} />
      },
    }),
    // ── Resultados ────────────────────────────────────────────────
    columnHelper.accessor('ev', {
      header: 'e (V)', size: 80,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <ComputedCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('epct', {
      header: 'e (%)', size: 80,
      meta: { colType: 'result' } as ColMeta,
      cell: info => {
        const v = info.getValue()
        return <ComputedCell value={v} decimals={2} warn={v !== null && v > 3} />
      },
    }),
  ], [setField, selectCable])

  const [colSizing, setColSizing] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('ea_col_caida') ?? '{}') } catch { return {} }
  })

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    enableColumnResizing: true,
    state: { columnSizing: colSizing },
    onColumnSizingChange: upd => {
      const next = typeof upd === 'function' ? upd(colSizing) : upd
      setColSizing(next)
      localStorage.setItem('ea_col_caida', JSON.stringify(next))
    },
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
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--dt-border-color)]">
            <div className="flex items-center gap-2.5">
              <span className="text-[14px] font-semibold text-font-a0">{tablero.tag}</span>
              {tablero.nombre && <span className="text-[13px] text-surface-tonal-a40">{tablero.nombre}</span>}
            </div>
            <div className="flex items-center gap-3.5 text-[11px] text-surface-tonal-a40">
              <span className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A8FD4', display: 'inline-block' }} /> Editable</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clr-surface-tonal-a40)', display: 'inline-block' }} /> Autocompletado</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6aab6a', display: 'inline-block' }} /> Resultado</span>
            </div>
          </div>
          <table
            className="datatable"
            style={{ width: table.getTotalSize(), tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}
          >
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => {
                    return (
                      <th key={header.id} style={{ width: header.getSize(), position: 'relative', textAlign: 'center' }}>
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
              {table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const colType = (cell.column.columnDef.meta as ColMeta | undefined)?.colType
                    return (
                      <td key={cell.id} style={{
                        width: cell.column.getSize(),
                        textAlign: colType === 'label' || colType === 'editable' ? 'left' : 'right',
                        verticalAlign: 'middle',
                        background: colType === 'editable' ? 'color-mix(in srgb, #4A8FD4 4%, transparent)'
                                  : colType === 'result'   ? 'color-mix(in srgb, #6aab6a 6%, transparent)'
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
          {rows.length === 0 && (
            <p style={{ padding: 16, textAlign: 'center', color: 'var(--clr-surface-tonal-a40)', fontSize: 13 }}>
              Sin circuitos en este tablero.
            </p>
          )}

          <div className="px-3.5 py-3 border-t border-[var(--dt-border-color)] text-[11px] text-surface-tonal-a40 flex flex-col gap-1.5">
            <span>• <b>Caída trifásica</b> — <InlineMath math="V_{FF}" /> tensión de línea:{' '}
              <InlineMath math="e = \sqrt{3} \cdot \dfrac{I_N}{n_c} \cdot L \cdot (R\cos\varphi + X\sin\varphi)" />
              {',  '}<InlineMath math="\%e = \dfrac{e}{V_{FF}} \cdot 100" />
            </span>
            <span>• <b>Caída monofásica / bifásica</b> — <InlineMath math="V" /> tensión de referencia:{' '}
              <InlineMath math="e = 2 \cdot \dfrac{I_N}{n_c} \cdot L \cdot (R\cos\varphi + X\sin\varphi)" />
            </span>
            <span>• L en m · R, X en Ω/km · I en A · <InlineMath math="n_c" /> = conductores por fase. Límite recomendado: 3 % régimen permanente.</span>
          </div>
        </div>
      )}
    </div>
  )
}
