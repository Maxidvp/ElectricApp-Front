'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { InlineMath } from 'react-katex'
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { TablaCalculo, EncabezadoTablero, TableroPills, AutoCell, useColSizing, type ColMeta } from '@/components/TablaCalculo'
import { useProyectos } from '@/context/ProyectosContext'
import { useCables, type CableItem } from '@/context/CablesContext'
import { generarFormacion, type CaidaInput, type FormatoFormacion } from '@/utils/electricidad'
import { evaluarCaida, LIMITE_CAIDA_PCT } from '@/utils/caida'
import { resolverCargaCircuito, tensionesDe } from '@/utils/cargas'
import { useTableroSeleccionado } from '@/hooks/useTableroSeleccionado'

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
        width: '100%', textAlign: 'center', padding: '0 4px', height: 26,
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
        display: 'block', width: '100%', textAlign: 'center',
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
        width: '100%', height: 26, padding: '0 4px', fontSize: 12, textAlign: 'center',
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
  const { tableros, getTablero, loading, error, proyectoActivo } = useProyectos()
  const formato: FormatoFormacion = (proyectoActivo?.formato_formacion as FormatoFormacion) ?? 'ingles'

  const [inputs,     setInputs]     = useState<Record<number, CaidaInput>>({})
  const [cableCache, setCableCache] = useState<Record<number, CableItem>>({})

  // Cálculo de caída de tensión: circuitos de potencia — no aplica a tableros
  // CONTROL/DATOS. Los tableros sin categoria (legado) se consideran POTENCIA.
  const tablerosPotencia = tableros.filter(t => t.categoria !== 'CONTROL' && t.categoria !== 'DATOS')

  const { tablero, idEfectivo, seleccionarTablero } = useTableroSeleccionado(tablerosPotencia)

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
    const sorted = [...tablero.circuitos].sort((a, b) => a.orden - b.orden)
    const tensiones = tensionesDe(tablero)
    // Una acometida suma solo los circuitos principales que tiene encima (los
    // auxiliares —retorno/combinación/ramal— no son carga propia), igual que Cargas.
    const principales = sorted.filter(c => c.parent_id === null)
    return sorted.map(c => {
      const input = inputs[c.id] ?? DEFAULT_INPUT
      const overrideId = input.cable_id ? Number(input.cable_id) : null
      const effectiveCable = (overrideId ? cableCache[overrideId] : null) ?? c.formacion?.cable ?? null

      // Carga efectiva: misma resolución que Cargas — sin esto la acometida y los
      // ALIMENTADORES (potencia null en la DB) quedaban sin corriente y sin caída.
      const idx = principales.indexOf(c)
      const carga = resolverCargaCircuito(c, idx >= 0 ? principales.slice(0, idx) : [], tensiones, tableros)
      const fpAuto        = carga.fp
      const tensionAuto   = carga.tension
      const corrienteAuto = carga.corriente
      // R, X y la caída: utils/caida.ts (compartido con Verificación y Memoria).
      const { nfases, cfAuto, largoAuto, rAuto, xAuto, ev, epct } = evaluarCaida(c, carga, effectiveCable, input)
      const formacion = c.formacion ? generarFormacion(c.formacion, formato) : '—'
      return {
        id: c.id, circuito: c.circuito, formacion,
        familiaId: c.formacion?.cable?.familia_id ?? null,
        cableId:   c.formacion?.cable?.id         ?? null,
        nfases, cfAuto, fpAuto, largoAuto, tensionAuto, corrienteAuto, rAuto, xAuto, input, ev, epct,
      }
    })
  }, [tablero, tableros, inputs, cableCache, formato])

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
        return <NumCell value={input.fp} onChange={v => setField(id, 'fp', v)} hint={fpAuto !== null ? String(Number(fpAuto.toFixed(3))) : undefined} />
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
        return <ComputedCell value={v} decimals={2} warn={v !== null && v > LIMITE_CAIDA_PCT} />
      },
    }),
  ], [setField, selectCable])

  const { colSizing, onColumnSizingChange } = useColSizing('ea_col_caida')

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
    enableColumnResizing: true,
    state: { columnSizing: colSizing },
    onColumnSizingChange,
  })

  if (loading && !tablero) return <p style={{ padding: 24 }}>Cargando...</p>
  if (error) return <p style={{ padding: 24, color: 'red' }}>Error: {error}</p>

  return (
    <div className="subcontainer">
      <div className="px-3 pt-3 pb-2"><TableroPills tableros={tablerosPotencia} idActivo={idEfectivo} onSelect={seleccionarTablero} /></div>

      {!tablero ? (
        <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin tablero activo.</p>
      ) : (
        <div className="datatable-container">
          <EncabezadoTablero tablero={tablero} etiquetaAuto="Autocompletado" />
          <TablaCalculo table={table} />

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
