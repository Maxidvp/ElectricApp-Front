'use client'
import { useState, useMemo, useCallback } from 'react'
import { InlineMath } from 'react-katex'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useProyectos } from '@/context/ProyectosContext'
import { calcCorriente } from '@/utils/electricidad'

// ── Tipos ─────────────────────────────────────────────────────────

type AmpacidadInput = {
  metodo: string
  fc:     string
  ft:     string
}

const DEFAULT_INPUT: AmpacidadInput = { metodo: '', fc: '', ft: '' }

type AmpacidadRow = {
  id:          number
  circuito:    string
  descripcion: string | null
  potencia:    number | null
  fp:          number | null
  corriente:   number | null
  iadm:        number | null
  input:       AmpacidadInput
  fh:          number
  fc:          number | null
  ft:          number | null
  iadm_corr:   number | null
  cumple:      boolean | null
}

type ColMeta = { colType: 'label' | 'editable' | 'auto' | 'result' }

const METODOS = [
  { value: '',             label: '— Sin especificar —'     },
  { value: 'bandeja_perf', label: 'Bandeja perforada'       },
  { value: 'bandeja_esc',  label: 'Escalera porta cond.'    },
  { value: 'conduit_emb',  label: 'Conduit embutido'        },
  { value: 'conduit_sup',  label: 'Conduit superficial'     },
  { value: 'enterrado',    label: 'Ducto enterrado'         },
  { value: 'aire_libre',   label: 'Al aire libre'           },
]

// ── Cálculo FH ────────────────────────────────────────────────────

function calcFH(altitud: number): number {
  return 1.02 - 0.00002 * altitud
}

const columnHelper = createColumnHelper<AmpacidadRow>()

// ── Celdas ────────────────────────────────────────────────────────

function AutoCell({ value, decimals = 2, unit }: { value: number | null; decimals?: number; unit?: string }) {
  if (value === null) return (
    <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'right' }}>—</span>
  )
  return (
    <span style={{ fontSize: 12, display: 'block', textAlign: 'right', color: 'var(--clr-font-a20)' }}>
      {value.toFixed(decimals)}{unit ? <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.6 }}>{unit}</span> : null}
    </span>
  )
}

function CheckCell({ ok, corriente, iadm_corr }: { ok: boolean | null; corriente: number | null; iadm_corr: number | null }) {
  if (ok === null) return (
    <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'center' }}>—</span>
  )
  return (
    <span
      title={ok ? `Cumple: Iadm ${iadm_corr?.toFixed(1)} A ≥ I ${corriente?.toFixed(1)} A` : `No cumple: Iadm ${iadm_corr?.toFixed(1)} A < I ${corriente?.toFixed(1)} A`}
      style={{ fontSize: 13, fontWeight: 700, display: 'block', textAlign: 'center', cursor: 'help', color: ok ? '#6aab6a' : 'var(--clr-danger-a10)' }}
    >
      {ok ? '✓' : '✗'}
    </span>
  )
}

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
        color: value ? 'var(--clr-font-a0)' : 'var(--clr-surface-tonal-a40)',
      }}
    >
      {display || '—'}
    </span>
  )
}

function MetodoCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onClick={e => e.stopPropagation()}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', height: 26, padding: '0 4px', fontSize: 11,
        background: 'color-mix(in srgb, #4A8FD4 4%, transparent)',
        color: value ? 'var(--clr-font-a0)' : 'var(--clr-surface-tonal-a40)',
        border: '1px solid transparent', borderRadius: 3, outline: 'none', cursor: 'pointer',
      }}
    >
      {METODOS.map(m => (
        <option key={m.value} value={m.value}>{m.label}</option>
      ))}
    </select>
  )
}

// ── Página ────────────────────────────────────────────────────────

export default function Ampacidad() {
  const { tableros, getTablero, loading, error } = useProyectos()

  const [tableroId, setTableroId] = useState<number | null>(() => {
    try {
      const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
      return m ? Number(m[1]) : null
    } catch { return null }
  })

  const [altitud, setAltitud] = useState<string>(() => {
    try { return localStorage.getItem('ea_ampacidad_altitud') ?? '0' } catch { return '0' }
  })

  const [inputs, setInputs] = useState<Record<number, AmpacidadInput>>({})
  const [colSizing, setColSizing] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('ea_col_ampacidad') ?? '{}') } catch { return {} }
  })

  const idEfectivo = tableroId ?? tableros[0]?.id ?? null
  const tablero    = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  const altitudNum = parseFloat(altitud) || 0
  const fh = calcFH(altitudNum)

  const cambiarTablero = (id: number) => {
    document.cookie = `last_tablero_id=${id};path=/;max-age=31536000`
    setTableroId(id)
  }

  const setField = useCallback((circId: number, field: keyof AmpacidadInput, val: string) => {
    setInputs(prev => ({ ...prev, [circId]: { ...DEFAULT_INPUT, ...prev[circId], [field]: val } }))
  }, [])

  const rows = useMemo((): AmpacidadRow[] => {
    if (!tablero) return []

    const tipoTablero = tablero.tension_tri != null ? 'tri'
                      : tablero.tension_bi  != null ? 'bi'
                      : tablero.tension_mono != null ? 'mono'
                      : null

    const sorted = [...tablero.circuitos]
      .filter(c => (c as any).parent_id === null)
      .sort((a, b) => (a as any).orden - (b as any).orden)

    return sorted.map((c, idx) => {
      const input = { ...DEFAULT_INPUT, ...inputs[c.id] }
      const fcNum = parseFloat(input.fc) || null
      const ftNum = parseFloat(input.ft) || null

      let potencia: number | null
      let fp: number | null
      let corriente: number | null
      let tipoEfectivo: string | null

      if ((c as any).es_alimentador) {
        const above  = sorted.slice(0, idx).filter(x => !(x as any).es_alimentador)
        potencia     = above.reduce((s, x) => s + ((x as any).potencia ?? 0), 0) || null
        const conFP  = above.filter(x => (x as any).FP != null && ((x as any).potencia ?? 0) > 0)
        const sumPot = conFP.reduce((s, x) => s + (x as any).potencia!, 0)
        fp           = sumPot > 0 ? conFP.reduce((s, x) => s + (x as any).FP! * (x as any).potencia!, 0) / sumPot : null
        tipoEfectivo = tipoTablero
      } else {
        potencia     = (c as any).potencia ?? null
        fp           = (c as any).FP ?? null
        tipoEfectivo = (c as any).tipo_tension ?? (tipoTablero ? tipoTablero : null)
      }

      const tension_v = tipoEfectivo === 'tri' ? tablero.tension_tri
                      : tipoEfectivo === 'bi'  ? tablero.tension_bi
                      : tablero.tension_mono

      corriente = calcCorriente(potencia, tipoEfectivo, tension_v, fp)

      // Iadm del cable × conductores en paralelo por fase
      const formacion = (c as any).formacion
      const iadm_cable = formacion?.cable?.Iadm ?? null
      const cond_por_fase = formacion?.cond_por_fase ?? 1
      const iadm = iadm_cable !== null ? iadm_cable * cond_por_fase : null

      const iadm_corr = iadm !== null && fcNum !== null && ftNum !== null
        ? iadm * fh * fcNum * ftNum
        : iadm !== null && fcNum === null && ftNum === null
        ? iadm * fh
        : iadm !== null && fcNum !== null
        ? iadm * fh * fcNum
        : iadm !== null && ftNum !== null
        ? iadm * fh * ftNum
        : null

      const cumple = iadm_corr !== null && corriente !== null ? iadm_corr >= corriente : null

      return {
        id: c.id,
        circuito:    (c as any).circuito,
        descripcion: (c as any).descripcion ?? null,
        potencia, fp, corriente, iadm, input, fh,
        fc: fcNum,
        ft: ftNum,
        iadm_corr,
        cumple,
      }
    })
  }, [tablero, inputs, fh])

  const columns = useMemo(() => [
    columnHelper.accessor('circuito', {
      header: 'Circuito', size: 120,
      meta: { colType: 'label' } as ColMeta,
      cell: info => <span style={{ fontSize: 12, fontWeight: 500 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('descripcion', {
      header: 'Descripción', size: 180,
      meta: { colType: 'label' } as ColMeta,
      cell: info => <span style={{ fontSize: 12, color: 'var(--clr-font-a20)' }}>{info.getValue() ?? '—'}</span>,
    }),
    columnHelper.accessor('potencia', {
      header: 'Pot. (kW)', size: 80,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={1} />,
    }),
    columnHelper.accessor('fp', {
      header: 'FP', size: 60,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('corriente', {
      header: 'I diseño (A)', size: 90,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={1} />,
    }),
    columnHelper.display({
      id: 'metodo', header: 'Método instalación', size: 170,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, input } = info.row.original
        return <MetodoCell value={input.metodo} onChange={v => setField(id, 'metodo', v)} />
      },
    }),
    columnHelper.accessor('fh', {
      header: 'FH', size: 60,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={3} />,
    }),
    columnHelper.display({
      id: 'fc', header: 'FC', size: 70,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, input } = info.row.original
        return <NumCell value={input.fc} onChange={v => setField(id, 'fc', v)} hint="1" />
      },
    }),
    columnHelper.display({
      id: 'ft', header: 'FT', size: 70,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, input } = info.row.original
        return <NumCell value={input.ft} onChange={v => setField(id, 'ft', v)} hint="1" />
      },
    }),
    columnHelper.accessor('iadm', {
      header: 'Iadm cable (A)', size: 110,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={1} />,
    }),
    columnHelper.accessor('iadm_corr', {
      header: 'Iadm corr. (A)', size: 110,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={1} />,
    }),
    columnHelper.display({
      id: 'cumple', header: '✓', size: 50,
      meta: { colType: 'result' } as ColMeta,
      cell: info => {
        const { cumple, corriente, iadm_corr } = info.row.original
        return <CheckCell ok={cumple} corriente={corriente} iadm_corr={iadm_corr} />
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
    state: { columnSizing: colSizing },
    onColumnSizingChange: upd => {
      const next = typeof upd === 'function' ? upd(colSizing) : upd
      setColSizing(next)
      localStorage.setItem('ea_col_ampacidad', JSON.stringify(next))
    },
  })

  if (loading && !tablero) return <p style={{ padding: 24 }}>Cargando...</p>
  if (error) return <p style={{ padding: 24, color: 'red' }}>Error: {error}</p>

  return (
    <div className="subcontainer">

      {/* Selector de tablero + parámetro altitud */}
      <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
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

        {/* Altitud → FH */}
        <div className="flex items-center gap-2 text-[12px] text-font-a20 shrink-0">
          <label className="text-surface-tonal-a40">Altitud</label>
          <input
            type="number" min="0" max="6000" step="100"
            value={altitud}
            onChange={e => {
              setAltitud(e.target.value)
              try { localStorage.setItem('ea_ampacidad_altitud', e.target.value) } catch {}
            }}
            style={{
              width: 72, height: 26, padding: '0 6px', fontSize: 12,
              background: 'var(--clr-surface-tonal-a0)', color: 'var(--clr-font-a0)',
              border: '1px solid var(--clr-surface-tonal-a30)', borderRadius: 5, outline: 'none',
            }}
          />
          <span className="text-surface-tonal-a40">m.s.n.m.</span>
          <span className="text-surface-tonal-a30 mx-1">→</span>
          <span className="font-mono">FH = {fh.toFixed(3)}</span>
        </div>
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
            <span>
              • <b>FH</b> — Factor por altura (IEC 62271-200):{' '}
              <InlineMath math="F_H = 1{,}02 - 0{,}00002 \cdot h" />
              {' '}con <InlineMath math="h" /> en m.s.n.m.
            </span>
            <span>• <b>FC</b> — Factor por canalización (IEC 60364-5-52 / AEA 90364-7-771): depende del tipo de canalización y configuración. Ingresar según tabla aplicable.</span>
            <span>• <b>FT</b> — Factor por temperatura ambiente (IEC 60364-5-52): depende de la temperatura ambiente y el tipo de aislamiento del cable. Ingresar según tabla aplicable.</span>
            <span>
              • <b>Iadm corr.</b> = Iadm cable × FH × FC × FT {'  '}
              Condición de cumplimiento: <InlineMath math="I_{adm,corr} \geq I_{diseño}" />
            </span>
            <span>• <b>Iadm cable</b> incluye el factor de conductores en paralelo por fase (cond_por_fase).</span>
          </div>

        </div>
      )}
    </div>
  )
}
