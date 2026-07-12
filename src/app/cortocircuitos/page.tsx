'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { InlineMath } from 'react-katex'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useProyectos } from '@/context/ProyectosContext'
import { useCables, type CableItem } from '@/context/CablesContext'
import { calcSminCable, seccionEnMm2 } from '@/utils/electricidad'
import { calcularProyecto, type EntradaProyecto } from '@/utils/cortocircuito'

// ── Tipos ─────────────────────────────────────────────────────────

type CortocircRow = {
  id:           number
  circuito:     string
  familiaId:    number | null
  cableId:      number | null
  nCondAuto:    number | null
  nCondInput:   string
  S_real_mm2:   number | null
  Z1_mOhm:      number | null
  kappa:        number | null
  Ik_kA:        number | null
  ip_kA:        number | null
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
    // Se usa la Icc máxima del tablero (peor caso para dimensionar el cable) como
    // fuente equivalente aguas arriba de cada circuito. La mínima no se usa acá,
    // sirve para coordinar protecciones, no para verificar sección.
    const Icc_panel_A = tablero.corriente_cc_max != null ? tablero.corriente_cc_max * 1000 : null
    // Nivel de tensión de la barra: tri > bi > mono, igual criterio que el resto de la app.
    const nivelBarra = tablero.tension_tri ?? tablero.tension_bi ?? tablero.tension_mono ?? null

    return sorted.map(c => {
      // El usuario puede seleccionar un cable diferente al de la formación para
      // simular distintos escenarios sin modificar el circuito original.
      const overrideId     = cableInputs[c.id] ? Number(cableInputs[c.id]) : null
      const effectiveCable = (overrideId ? cableCache[overrideId] : null) ?? c.formacion?.cable ?? null
      const familia        = (effectiveCable as any)?.familia ?? null

      const nCondAuto     = effectiveCable?.Nfases ?? null
      const nCondOverride = nCondInputs[c.id] ? Number(nCondInputs[c.id]) : null
      const nCondEff      = (nCondOverride && nCondOverride > 0 ? nCondOverride : null) ?? nCondAuto ?? 1

      const S_real = effectiveCable ? seccionEnMm2(effectiveCable.seccion_f, effectiveCable.calibre_tipo) : null
      const mat = familia?.material    ?? null
      const ais = familia?.aislamiento ?? null
      const material: 'COBRE' | 'ALUMINIO' = (mat ?? '').toLowerCase().includes('alu') ? 'ALUMINIO' : 'COBRE'

      // Motor de cálculo IEC 60909-0 (Front/src/utils/cortocircuito): la barra del
      // tablero se modela como una red equivalente con la Icc ya conocida, y el
      // propio circuito como el único conductor entre la barra y el punto de falla
      // al final del cable. Se piden dos puntos de falla (0.02 s y 0.2 s) para
      // obtener Ith en las dos zonas de protección con un solo cálculo del mismo Z1.
      let Z1_mOhm: number | null = null, kappa: number | null = null
      let Ik_kA: number | null = null, ip_kA: number | null = null
      let Ith_002_A: number | null = null, Ith_02_A: number | null = null

      if (Icc_panel_A && nivelBarra && S_real && c.Largo) {
        try {
          const entrada: EntradaProyecto = {
            proyecto: { nombre: 'cortocircuitos', frecuencia_hz: 50 },
            red_alimentacion: { id: 'BARRA', nodo: 'BARRA', tension_nominal: nivelBarra, corriente_cc: Icc_panel_A },
            transformadores: [],
            generadores: [],
            motores: [],
            conductores: [{
              id: String(c.id), longitud: c.Largo, seccion: S_real,
              n_conductores_por_fase: nCondEff, material,
              nodo_a: 'BARRA', nodo_b: 'FIN',
            }],
            puntos_falla: [
              { id: 'F002', nodo: 'FIN', tension_nominal: nivelBarra, tipos_falla: ['TRIFASICA'], escenario: 'MAXIMO', duracion_falla: 0.02 },
              { id: 'F02', nodo: 'FIN', tension_nominal: nivelBarra, tipos_falla: ['TRIFASICA'], escenario: 'MAXIMO', duracion_falla: 0.2 },
            ],
          }
          const [r002, r02] = calcularProyecto(entrada)
          Z1_mOhm = Math.hypot(r002.Z1.re, r002.Z1.im) * 1000
          kappa = r002.kappa
          Ik_kA = r002.corrientes.Ik_inicial_A / 1000
          ip_kA = r002.corrientes.ip_A / 1000
          Ith_002_A = r002.corrientes.Ith_A
          Ith_02_A = r02.corrientes.Ith_A
        } catch {
          // Datos insuficientes o inconsistentes para este circuito puntual (ej. cable
          // sin sección resuelta todavía) — se deja en blanco, no rompe el resto de la tabla.
        }
      }

      const S_min_002 = Ith_002_A ? calcSminCable(Ith_002_A, 0.02, mat, ais) : null
      const S_min_02  = Ith_02_A  ? calcSminCable(Ith_02_A, 0.2,  mat, ais) : null

      const cable_ok_002 = S_min_002 != null && S_real != null ? S_real >= S_min_002 : null
      const cable_ok_02  = S_min_02  != null && S_real != null ? S_real >= S_min_02  : null

      return {
        id: c.id, circuito: c.circuito,
        familiaId: c.formacion?.cable?.familia_id ?? null,
        cableId:   c.formacion?.cable?.id         ?? null,
        nCondAuto,
        nCondInput: nCondInputs[c.id] ?? '',
        S_real_mm2: S_real != null && !isNaN(S_real) ? S_real : null,
        Z1_mOhm, kappa, Ik_kA, ip_kA,
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
    columnHelper.accessor('Z1_mOhm', {
      header: 'Z1 (mΩ)', size: 90,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('kappa', {
      header: 'κ', size: 60,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('Ik_kA', {
      header: 'I"k (kA)', size: 90,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('ip_kA', {
      header: 'ip (kA)', size: 90,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
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
              {tablero.corriente_cc_max != null && (
                <span className="text-[12px] text-surface-tonal-a40">
                  Icc max = {tablero.corriente_cc_max} kA
                  {tablero.corriente_cc_min != null && <> · Icc min = {tablero.corriente_cc_min} kA</>}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3.5 text-[11px] text-surface-tonal-a40">
              <span className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A8FD4', display: 'inline-block' }} /> Editable</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clr-surface-tonal-a40)', display: 'inline-block' }} /> Calculado</span>
              <span className="flex items-center gap-1.5"><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6aab6a', display: 'inline-block' }} /> Resultado</span>
            </div>
          </div>

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
          </div>
          </div>

          {rows.length === 0 && (
            <p style={{ padding: 16, textAlign: 'center', color: 'var(--clr-surface-tonal-a40)', fontSize: 13 }}>
              Sin circuitos en este tablero.
            </p>
          )}

          <div className="px-3.5 py-3.5 border-t border-[var(--dt-border-color)] text-[11px] text-surface-tonal-a40 flex flex-col gap-3.5">
            <p>
              <b className="text-font-a20">Cómo se calcula:</b> para cada circuito se plantea una falla trifásica franca
              en el extremo del cable (el punto más alejado, donde la corriente de falla es más chica pero el cable
              está menos protegido). Se usa el método de la fuente de tensión equivalente de la <b>IEC 60909-0</b>: la
              barra del tablero se modela como una fuente con la Icc máxima ya conocida, y el cable del circuito es el
              único tramo de impedancia entre esa barra y la falla.
            </p>

            <div className="flex flex-col gap-2">
              <div>
                <span className="text-font-a20 font-medium">Z1 (mΩ)</span> — impedancia total entre la barra y el
                extremo del cable: <InlineMath math="Z_1 = Z_{barra} + Z_{cable}" />.{' '}
                <b>De dónde sale:</b> <InlineMath math="Z_{barra}" /> se deriva de la Icc máxima que cargaste a mano en
                el tablero (no se calcula, es un dato de entrada tuyo). <InlineMath math="Z_{cable}" /> sale de la
                resistencia (sección, material y longitud del cable, a 20 °C — la temperatura más fría posible, que da
                la Icc más alta y por eso es el peor caso) y de la reactancia (un valor típico de 0,08 Ω/km para cable
                BT multipolar, si el cable no tiene ese dato cargado).
              </div>

              <div>
                <span className="text-font-a20 font-medium">κ (kappa)</span> — factor de cresta: qué tan asimétrico es
                el primer pico de la corriente de falla respecto a su valor simétrico. Depende de la relación R/X de
                Z1 (cuanto más resistivo el camino, menos asimetría): <InlineMath math="\kappa = 1{,}15\left(1{,}02 + 0{,}98\, e^{-3R/X}\right)" />.
                Solo se usa como paso intermedio para calcular <b>ip</b>.
              </div>

              <div>
                <span className="text-font-a20 font-medium">I&quot;k (kA)</span> — corriente de cortocircuito inicial
                simétrica, el resultado principal: <InlineMath math="I''_{k} = \dfrac{c \cdot U_n}{\sqrt{3}\,|Z_1|}" />.{' '}
                <InlineMath math="U_n" /> es la tensión de línea del tablero; <InlineMath math="c" /> es el factor de
                tensión de la norma (1,05 para baja tensión en el escenario de corriente máxima, cubre el margen de
                +6% que puede tener la red real sobre su tensión nominal).
              </div>

              <div>
                <span className="text-font-a20 font-medium">ip (kA)</span> — valor de cresta (pico) de la corriente de
                falla en el primer semiciclo: <InlineMath math="i_p = \kappa \sqrt{2}\, I''_k" />. Sirve para verificar
                que barras, soportes y equipos aguanten el esfuerzo electrodinámico del golpe inicial, que es mayor
                que el valor simétrico.
              </div>

              <div>
                <span className="text-font-a20 font-medium">S mín (mm²) / ✓</span> — sección mínima que necesita el
                cable para no dañarse por calentamiento durante la falla, y si la sección real elegida la cumple:{' '}
                <InlineMath math="S_{min} = I_{th} \cdot \sqrt{t} / k" />. Se usa <InlineMath math="I_{th}" /> (corriente
                térmica equivalente, <InlineMath math="I_{th} = I''_k \sqrt{m+n}" />) en vez de I&quot;k directo, porque
                tiene en cuenta el calentamiento extra que aporta la componente de corriente continua durante el
                transitorio. <InlineMath math="k" /> es una constante del material/aislación del cable (Cu/XLPE = 143 ·
                Cu/PVC = 115 · Al/XLPE = 87 · Al/PVC = 74).
              </div>

              <div>
                Se calcula dos veces (columnas 0,02 s y 0,2 s) porque la protección del circuito tiene dos zonas de
                disparo con tiempos distintos: <b>0,02 s</b> es la zona magnética (disparo instantáneo ante fallas
                severas) y <b>0,2 s</b> la zona térmica (disparo temporizado, fallas menos severas que igual hay que
                despejar). El cable tiene que soportar ambos casos.
              </div>
            </div>

            <p>
              <b className="text-font-a20">Qué no calcula todavía:</b> la Icc máxima/mínima del tablero es un dato que
              cargás a mano — el motor no reconstruye la red aguas arriba (fuente de alimentación, transformadores,
              otros tableros en cadena) para derivarla sola. Eso es la próxima pieza a conectar.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
