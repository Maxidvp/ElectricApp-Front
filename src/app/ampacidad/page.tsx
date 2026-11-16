'use client'
import { useState, useMemo } from 'react'
import { InlineMath } from 'react-katex'
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { TablaCalculo, EncabezadoTablero, TableroPills, AutoCell, useColSizing, type ColMeta } from '@/components/TablaCalculo'
import { useProyectos } from '@/context/ProyectosContext'
import { calcFH } from '@/utils/electricidad'
import { resolverCargaCircuito, tensionesDe } from '@/utils/cargas'
import { evaluarAmpacidad, type AmpacidadCircuito, type Coordinacion } from '@/utils/ampacidad'
import { proteccionLabel } from '@/utils/protecciones'
import { useTableroSeleccionado } from '@/hooks/useTableroSeleccionado'

// ── Tipos ─────────────────────────────────────────────────────────

type AmpacidadRow = AmpacidadCircuito & {
  id:          number
  circuito:    string
  descripcion: string | null
  potencia:    number | null
  fp:          number | null
  corriente:   number | null
  proteccion:  string | null   // etiqueta de la protección asignada
}

const METODOS = [
  { value: '',             label: '— Sin especificar —'     },
  { value: 'bandeja_perf', label: 'Bandeja perforada'       },
  { value: 'bandeja_esc',  label: 'Escalera porta cond.'    },
  { value: 'conduit_emb',  label: 'Conduit embutido'        },
  { value: 'conduit_sup',  label: 'Conduit superficial'     },
  { value: 'enterrado',    label: 'Ducto enterrado'         },
  { value: 'aire_libre',   label: 'Al aire libre'           },
]

const columnHelper = createColumnHelper<AmpacidadRow>()

const ICONO_COORD: Record<Coordinacion['estado'], { simbolo: string; color: string }> = {
  ok:                  { simbolo: '✓', color: '#6aab6a' },
  dispara_en_servicio: { simbolo: '✗', color: 'var(--clr-danger-a10)' },
  cable_desprotegido:  { simbolo: '✗', color: 'var(--clr-danger-a10)' },
  sin_datos:           { simbolo: '?', color: '#d4a24a' },
  no_aplica:           { simbolo: '–', color: 'var(--clr-surface-tonal-a40)' },
}

// ── Celdas ────────────────────────────────────────────────────────

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

// value = override manual (o null = usar el sugerido). hint = valor auto-calculado,
// mostrado como placeholder hasta que el usuario lo sobrescribe a mano.
function NumCell({ value, onChange, hint, title }: { value: number | null; onChange: (v: number | null) => void; hint?: string; title?: string }) {
  const [editing, setEditing] = useState(false)
  const draftInicial = value !== null ? String(value) : ''
  const [draft, setDraft] = useState(draftInicial)

  const commit = () => {
    setEditing(false)
    const n = parseFloat(draft)
    onChange(draft.trim() === '' || isNaN(n) ? null : n)
  }

  if (editing) return (
    <input
      type="text" inputMode="decimal" autoFocus value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter')  commit()
        if (e.key === 'Escape') { setDraft(draftInicial); setEditing(false) }
      }}
      style={{
        width: '100%', textAlign: 'center', padding: '0 4px', height: 26,
        background: 'var(--clr-surface-tonal-a0)', color: 'var(--clr-font-a0)',
        border: '1px solid var(--clr-info-a10)', borderRadius: 3, fontSize: 12, outline: 'none',
      }}
    />
  )

  const display = value !== null ? String(value) : hint
  return (
    <span
      title={title}
      onClick={() => { setDraft(value !== null ? String(value) : (hint ?? '')); setEditing(true) }}
      style={{
        display: 'block', width: '100%', textAlign: 'center',
        cursor: 'text', minHeight: 20, fontSize: 12,
        color: value !== null ? 'var(--clr-font-a0)' : 'var(--clr-surface-tonal-a40)',
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
        width: '100%', height: 26, padding: '0 4px', fontSize: 11, textAlign: 'center',
        background: 'var(--clr-surface-a10)',
        color: value ? 'var(--clr-font-a0)' : 'var(--clr-surface-tonal-a40)',
        border: '1px solid var(--clr-surface-tonal-a20)', borderRadius: 3, outline: 'none', cursor: 'pointer',
      }}
    >
      {METODOS.map(m => (
        <option key={m.value} value={m.value} style={{ background: 'var(--clr-surface-a10)', color: 'var(--clr-font-a0)' }}>{m.label}</option>
      ))}
    </select>
  )
}

// ── Página ────────────────────────────────────────────────────────

export default function Ampacidad() {
  const {
    tableros, getTablero, loading, error, segmentos,
    actualizarMetodoInstalacion, actualizarFcManual, actualizarFtManual,
  } = useProyectos()


  const [altitud, setAltitud] = useState<string>(() => {
    try { return localStorage.getItem('ea_ampacidad_altitud') ?? '0' } catch { return '0' }
  })
  const [tempAmbiente, setTempAmbiente] = useState<string>(() => {
    try { return localStorage.getItem('ea_ampacidad_temp_ambiente') ?? '35' } catch { return '35' }
  })

  const { colSizing, onColumnSizingChange } = useColSizing('ea_col_ampacidad')

  // Verificación de ampacidad: circuitos de potencia — no aplica a tableros
  // CONTROL/DATOS. Los tableros sin categoria (legado) se consideran POTENCIA.
  const tablerosPotencia = tableros.filter(t => t.categoria !== 'CONTROL' && t.categoria !== 'DATOS')

  const { tablero, idEfectivo, seleccionarTablero } = useTableroSeleccionado(tablerosPotencia)

  const altitudNum = parseFloat(altitud) || 0
  const fh = calcFH(altitudNum)
  const tempAmbienteNum = parseFloat(tempAmbiente)
  const sitio = useMemo(
    () => ({ altitud: altitudNum, tempAmbiente: isNaN(tempAmbienteNum) ? null : tempAmbienteNum }),
    [altitudNum, tempAmbienteNum],
  )

  const cambiarTablero = (id: number) => {
    seleccionarTablero(id)
  }

  const rows = useMemo((): AmpacidadRow[] => {
    if (!tablero) return []

    const tensiones = tensionesDe(tablero)
    const sorted = [...tablero.circuitos]
      .filter(c => c.parent_id === null)
      .sort((a, b) => a.orden - b.orden)

    return sorted.map((c, idx) => {
      // Carga efectiva: misma resolución que la página de Cargas (acometida = suma
      // de los circuitos de arriba; ALIMENTADOR = demanda de su tablero destino).
      const { potencia, fp, corriente } = resolverCargaCircuito(c, sorted.slice(0, idx), tensiones, tableros)

      // Toda la verificación (Iadm por método, factores, Iz, coordinación) está en
      // utils/ampacidad.ts, compartida con el panel de Verificación y la Memoria.
      const amp = evaluarAmpacidad(c, corriente, segmentos, sitio)

      return {
        id: c.id,
        circuito:    c.circuito,
        descripcion: c.descripcion ?? null,
        potencia, fp, corriente,
        ...amp,
        proteccion: c.proteccion ? proteccionLabel(c.proteccion) : null,
      }
    })
  }, [tablero, tableros, segmentos, sitio])

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
        const { id, metodo } = info.row.original
        return <MetodoCell value={metodo} onChange={v => actualizarMetodoInstalacion(id, v || null)} />
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
        const { id, fcManual, fcAuto, nAgrupados } = info.row.original
        const title = nAgrupados !== null
          ? `${nAgrupados} circuito(s) agrupado(s) en la canalización más cargada`
          : 'Circuito sin ruteo asignado — no se puede sugerir FC'
        return (
          <NumCell
            value={fcManual} hint={fcAuto !== null ? fcAuto.toFixed(2) : '1'}
            title={title}
            onChange={v => actualizarFcManual(id, v)}
          />
        )
      },
    }),
    columnHelper.display({
      id: 'ft', header: 'FT', size: 70,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, ftManual, ftAuto } = info.row.original
        return (
          <NumCell
            value={ftManual} hint={ftAuto !== null ? ftAuto.toFixed(2) : '1'}
            onChange={v => actualizarFtManual(id, v)}
          />
        )
      },
    }),
    columnHelper.accessor('iadm', {
      header: 'Iadm cable (A)', size: 110,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => {
        const aviso = info.row.original.iadmAviso
        if (!aviso) return <AutoCell value={info.getValue()} decimals={1} />
        return (
          <span title={aviso} style={{ cursor: 'help', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
            <AutoCell value={info.getValue()} decimals={1} />
            <span style={{ color: 'var(--clr-warning-a10)', fontSize: 11 }}>⚠</span>
          </span>
        )
      },
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
    columnHelper.display({
      id: 'coord', header: 'Protección (Ib ≤ In ≤ Iz)', size: 190,
      meta: { colType: 'result' } as ColMeta,
      cell: info => {
        const { coord, proteccion } = info.row.original
        if (!proteccion) return <span title={coord.detalle} style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12 }}>Sin protección</span>
        const { simbolo, color } = ICONO_COORD[coord.estado]
        const valor = coord.ajuste ? `${coord.ajuste[0].toFixed(1)}–${coord.ajuste[1].toFixed(1)} A`
                    : coord.In != null ? `${coord.In} A` : '—'
        return (
          <span title={`${proteccion} — ${coord.detalle}`} style={{ fontSize: 12, cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--clr-font-a20)' }}>{valor}</span>
            <span style={{ fontWeight: 700, color }}>{simbolo}</span>
          </span>
        )
      },
    }),
  ], [actualizarMetodoInstalacion, actualizarFcManual, actualizarFtManual])

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

      {/* Selector de tablero + parámetros de sitio */}
      <div className="flex items-center justify-between gap-3 px-3 pt-3 pb-2 flex-wrap">
        <TableroPills tableros={tablerosPotencia} idActivo={idEfectivo} onSelect={cambiarTablero} />

        {/* Altitud → FH, Temperatura ambiente → FT */}
        <div className="flex items-center gap-3 text-[12px] text-font-a20 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
            <label className="text-surface-tonal-a40">Temp. ambiente</label>
            <input
              type="number" min="-20" max="80" step="1"
              value={tempAmbiente}
              onChange={e => {
                setTempAmbiente(e.target.value)
                try { localStorage.setItem('ea_ampacidad_temp_ambiente', e.target.value) } catch {}
              }}
              style={{
                width: 60, height: 26, padding: '0 6px', fontSize: 12,
                background: 'var(--clr-surface-tonal-a0)', color: 'var(--clr-font-a0)',
                border: '1px solid var(--clr-surface-tonal-a30)', borderRadius: 5, outline: 'none',
              }}
            />
            <span className="text-surface-tonal-a40">°C</span>
          </div>
        </div>
      </div>

      {!tablero ? (
        <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin tablero activo.</p>
      ) : (
        <div className="datatable-container">

          <EncabezadoTablero tablero={tablero} />

          <TablaCalculo table={table} />

          <div className="px-3.5 py-3 border-t border-[var(--dt-border-color)] text-[11px] text-surface-tonal-a40 flex flex-col gap-1.5">
            <span>
              • <b>FH</b> — Factor por altura:{' '}
              <InlineMath math="F_H = \min(1;\ 1{,}02 - 0{,}00002 \cdot h)" />
              {' '}con <InlineMath math="h" /> en m.s.n.m. — sin reducción hasta 1000 m, y nunca mayor que 1.
              Es un criterio lineal de proyecto, no una tabla de AEA 90364: confirmar contra el dato del fabricante
              para instalaciones en altura.
            </span>
            <span>
              • <b>FC</b> — Factor por agrupamiento (IEC 60364-5-52 Tabla B.52.17/B.52.20): se sugiere solo
              cruzando el método de instalación con el N° de circuitos que comparten de verdad el mismo
              caño/bandeja (módulo de ruteo). Sin ruteo asignado no hay sugerencia — completar a mano.
              Editable: un valor propio pisa la sugerencia.
            </span>
            <span>
              • <b>FT</b> — Factor por temperatura ambiente (IEC 60364-5-52):{' '}
              <InlineMath math="F_T = \sqrt{(\theta_{max} - \theta_{amb}) / (\theta_{max} - \theta_{ref})}" />
              {' '}con <InlineMath math="\theta_{max}" /> = temperatura de servicio del cable,{' '}
              <InlineMath math="\theta_{ref}" /> = 30 °C (20 °C si es enterrado). Editable: un valor propio pisa la sugerencia.
            </span>
            <span>
              • <b>Iadm corr.</b> = Iadm cable × FH × FC × FT {'  '}
              Condición de cumplimiento: <InlineMath math="I_{adm,corr} \geq I_{diseño}" />
            </span>
            <span>
              • <b>Iadm cable</b> — dato de catálogo según la forma de instalación elegida: conduit → Iadm en
              cañería; bandeja / escalera / aire libre → Iadm al aire; ducto enterrado → Iadm enterrado. Si el
              cable no tiene cargada la de ese método (o el circuito no tiene método) se usa la Iadm genérica y
              la celda lo marca con <span style={{ color: 'var(--clr-warning-a10)' }}>⚠</span>. Se cargan en la
              página Cables. Incluye el factor de conductores en paralelo por fase.
            </span>
            <span>
              • <b>Protección</b> — coordinación contra sobrecarga <InlineMath math="I_b \leq I_n \leq I_z" />, con{' '}
              <InlineMath math="I_b" /> = I diseño, <InlineMath math="I_n" /> = nominal de la protección asignada al
              circuito e <InlineMath math="I_z" /> = Iadm corr. Si <InlineMath math="I_n < I_b" /> la protección
              dispara en servicio normal; si <InlineMath math="I_n > I_z" /> el cable puede sobrecargarse sin que
              la protección actúe. En un guardamotor se indica el rango de regulación válido. La protección se
              asigna en la página Cortocircuitos. No se evalúa aparte la condición{' '}
              <InlineMath math="I_2 \leq 1{,}45\, I_z" /> (el catálogo no guarda <InlineMath math="I_2" />).
            </span>
          </div>

        </div>
      )}
    </div>
  )
}
