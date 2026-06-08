'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { InlineMath } from 'react-katex'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useProyectos } from '@/context/ProyectosContext'
import { useCables, type CableItem } from '@/context/CablesContext'
import { calcResistencia, calcIccExtremo, calcSminCable, seccionEnMm2 } from '@/utils/electricidad'

// ── Tipos ─────────────────────────────────────────────────────────

type CortocircRow = {
  id:           number
  circuito:     string
  familiaId:    number | null
  cableId:      number | null
  nCondAuto:    number | null
  nCondInput:   string
  S_real_mm2:   number | null
  Icc_extremo:  number | null
  S_min_002:    number | null
  S_min_02:     number | null
  cable_ok_002: boolean | null
  cable_ok_02:  boolean | null
  input:        { cable_id: string }
}

type ColMeta = { colType: 'label' | 'editable' | 'auto' | 'result' }

const columnHelper = createColumnHelper<CortocircRow>()

// ── Celdas ────────────────────────────────────────────────────────

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

function CheckCell({ ok }: { ok: boolean | null }) {
  if (ok === null) return (
    <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'center' }}>—</span>
  )
  return (
    <span style={{ fontSize: 13, fontWeight: 700, display: 'block', textAlign: 'center', color: ok ? '#6aab6a' : 'var(--clr-danger-a10)' }}>
      {ok ? '✓' : '✗'}
    </span>
  )
}

// ── Celda numérica editable ───────────────────────────────────────

function NumCell({ value, onChange, hint }: { value: string; onChange: (v: string) => void; hint?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)

  const commit = () => { setEditing(false); onChange(draft) }

  if (editing) return (
    <input
      type="text" inputMode="decimal" autoFocus value={draft}
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

// ── Selector de cable ─────────────────────────────────────────────

function CableSelect({ familiaId, value, defaultId, onChange }: {
  familiaId: number
  value:     string
  defaultId: string
  onChange:  (cable: CableItem | null) => void
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

// ── Página ────────────────────────────────────────────────────────

export default function Cortocircuitos() {
  const { tableros, getTablero, loading, error } = useProyectos()

  const [tableroId, setTableroId] = useState<number | null>(() => {
    try {
      const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
      return m ? Number(m[1]) : null
    } catch { return null }
  })

  const [cableCache,    setCableCache]    = useState<Record<number, CableItem>>({})
  const [cableInputs,   setCableInputs]   = useState<Record<number, string>>({})
  const [nCondInputs,   setNCondInputs]   = useState<Record<number, string>>({})

  const idEfectivo = tableroId ?? tableros[0]?.id ?? null
  const tablero    = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  const cambiarTablero = (id: number) => {
    document.cookie = `last_tablero_id=${id};path=/;max-age=31536000`
    setTableroId(id)
  }

  const selectCable = useCallback((circId: number, cable: CableItem | null) => {
    const cid = cable ? String(cable.id) : ''
    if (cable) setCableCache(prev => ({ ...prev, [cable.id]: cable }))
    setCableInputs(prev => ({ ...prev, [circId]: cid }))
  }, [])

  const setNCondInput = useCallback((circId: number, val: string) => {
    setNCondInputs(prev => ({ ...prev, [circId]: val }))
  }, [])

  const rows = useMemo((): CortocircRow[] => {
    if (!tablero) return []
    const sorted = [...tablero.circuitos].sort((a, b) => (a as any).orden - (b as any).orden)
    const Icc_panel_A = tablero.corriente_cc != null ? tablero.corriente_cc * 1000 : null

    return sorted.map(c => {
      const overrideId     = cableInputs[c.id] ? Number(cableInputs[c.id]) : null
      const effectiveCable = (overrideId ? cableCache[overrideId] : null) ?? c.formacion?.cable ?? null
      const familia        = (effectiveCable as any)?.familia ?? null

      const nCondAuto     = effectiveCable?.Nfases ?? null
      const nCondOverride = nCondInputs[c.id] ? Number(nCondInputs[c.id]) : null
      const nCondEff      = (nCondOverride && nCondOverride > 0 ? nCondOverride : null) ?? nCondAuto ?? 1

      const S_real = effectiveCable ? seccionEnMm2(effectiveCable.seccion_f, effectiveCable.calibre_tipo) : null

      const R_km_single = effectiveCable ? calcResistencia(
        effectiveCable.seccion_f,
        effectiveCable.calibre_tipo,
        familia?.material,
        familia?.temperatura,
      ) : null
      const R_km = R_km_single !== null ? R_km_single / nCondEff : null

      const tipo = c.tipo_tension
      const U0 = tipo === 'mono' ? tablero.tension_mono
               : tipo === 'bi'   ? tablero.tension_bi
               : tipo === 'tri'  ? (tablero.tension_tri != null ? tablero.tension_tri / Math.sqrt(3) : null)
               : null

      const Icc_extremo = R_km && U0 && c.Largo
        ? calcIccExtremo(U0, R_km, c.Largo)
        : null

      const mat = familia?.material    ?? null
      const ais = familia?.aislamiento ?? null

      const S_min_002 = Icc_panel_A ? calcSminCable(Icc_panel_A, 0.02, mat, ais) : null
      const S_min_02  = Icc_panel_A ? calcSminCable(Icc_panel_A, 0.2,  mat, ais) : null

      const cable_ok_002 = S_min_002 != null && S_real != null ? S_real >= S_min_002 : null
      const cable_ok_02  = S_min_02  != null && S_real != null ? S_real >= S_min_02  : null

      return {
        id: c.id, circuito: c.circuito,
        familiaId: c.formacion?.cable?.familia_id ?? null,
        cableId:   c.formacion?.cable?.id         ?? null,
        nCondAuto,
        nCondInput: nCondInputs[c.id] ?? '',
        S_real_mm2: S_real != null && !isNaN(S_real) ? S_real : null,
        Icc_extremo,
        S_min_002, S_min_02,
        cable_ok_002, cable_ok_02,
        input: { cable_id: cableInputs[c.id] ?? '' },
      }
    })
  }, [tablero, cableInputs, cableCache, nCondInputs])

  const [colSizing, setColSizing] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('ea_col_cortocircuitos') ?? '{}') } catch { return {} }
  })

  const columns = useMemo(() => [
    columnHelper.accessor('circuito', {
      header: 'Circuito', size: 130,
      meta: { colType: 'label' } as ColMeta,
      cell: info => <span style={{ fontSize: 12, fontWeight: 500 }}>{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'nCond', header: 'N° cond.', size: 80,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, nCondAuto, nCondInput } = info.row.original
        return <NumCell value={nCondInput} onChange={v => setNCondInput(id, v)} hint={nCondAuto !== null ? String(nCondAuto) : undefined} />
      },
    }),
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
    columnHelper.accessor('S_real_mm2', {
      header: 'S real (mm²)', size: 100,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={1} />,
    }),
    columnHelper.accessor('Icc_extremo', {
      header: 'Icc extremo (A)', size: 130,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={0} />,
    }),
    columnHelper.accessor('S_min_002', {
      header: 'S mín 0.02 s (mm²)', size: 140,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('cable_ok_002', {
      header: '✓ 0.02 s', size: 80,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <CheckCell ok={info.getValue()} />,
    }),
    columnHelper.accessor('S_min_02', {
      header: 'S mín 0.2 s (mm²)', size: 140,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('cable_ok_02', {
      header: '✓ 0.2 s', size: 80,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <CheckCell ok={info.getValue()} />,
    }),
  ], [selectCable, setNCondInput])

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
      localStorage.setItem('ea_col_cortocircuitos', JSON.stringify(next))
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
            onClick={() => cambiarTablero(t.id)}
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
              {tablero.corriente_cc != null && (
                <span className="text-[12px] text-surface-tonal-a40">Icc = {tablero.corriente_cc} kA</span>
              )}
            </div>
            <div className="flex items-center gap-3.5 text-[11px] text-surface-tonal-a40">
              <span className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A8FD4', display: 'inline-block' }} /> Editable</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clr-surface-tonal-a40)', display: 'inline-block' }} /> Calculado</span>
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
                  {hg.headers.map(header => {
                    const colType = (header.column.columnDef.meta as ColMeta | undefined)?.colType
                    return (
                      <th key={header.id} style={{
                        width: header.getSize(), position: 'relative', textAlign: 'center',
                        color: colType === 'result' ? '#6aab6a' : undefined,
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
              {table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => {
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
            <span>• <b>Icc extremo</b> — falla fase-neutro al final del circuito (IEC 60364):{' '}
              <InlineMath math="I_{cc} = \dfrac{0{,}8 \cdot U_0}{2 \cdot R \cdot L}" />
            </span>
            <span>• <b>Sección mínima adiabática</b> (IEC 60364):{' '}
              <InlineMath math="\left(\dfrac{I_{CC}}{A}\right)^{\!2} t_{CC} = 0{,}0297 \cdot \log\!\left(\dfrac{T_2 + 234}{T_1 + 234}\right)" />
              {' '}— equivalente a{' '}<InlineMath math="S_{min} = I_{cc} \cdot \sqrt{t} / k" />
            </span>
            <span>• T₁ = 90 °C (op. XLPE) · T₂ = 250 °C (cc XLPE) · t = 0,02 s zona magnética; t = 0,2 s zona térmica.</span>
            <span>• k: Cu/XLPE = 143 · Cu/PVC = 115 · Al/XLPE = 87 · Al/PVC = 74.</span>
          </div>
        </div>
      )}
    </div>
  )
}
