'use client'
import { useState, useMemo } from 'react'
import { InlineMath } from 'react-katex'
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useProyectos } from '@/context/ProyectosContext'
import FormacionModal from '@/components/FormacionModal'
import { formacionData } from '@/app/cargas/utils'
import type { FormacionData } from '@/app/cargas/types'
import { calcSminCable, seccionEnMm2, calcReactancia, generarFormacion } from '@/utils/electricidad'
import { calcularProyecto, impedanciaRed, impedanciaConductor, type EntradaProyecto, type Conductor } from '@/utils/cortocircuito'
import { getLastTableroId, setLastTableroId } from '@/utils/cookies'

// ── Tipos ─────────────────────────────────────────────────────────

type CortocircRow = {
  id:           number
  circuito:     string
  formacion:      string
  formacionData:  FormacionData | null
  S_real_mm2:   number | null
  R_cable_mOhm: number | null
  X_cable_mOhm: number | null
  Z1_mOhm:      number | null
  kappa:        number | null
  Ik_kA:        number | null
  ip_kA:        number | null
  S_min_002:    number | null
  S_min_02:     number | null
  cable_ok_002: boolean | null
  cable_ok_02:  boolean | null
}

type ColMeta = { colType: 'label' | 'editable' | 'auto' | 'result' }

const columnHelper = createColumnHelper<CortocircRow>()

// ── Celdas ────────────────────────────────────────────────────────

function AutoCell({ value, decimals = 2 }: { value: number | null; decimals?: number }) {
  if (value === null) return (
    <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'center' }}>—</span>
  )
  return (
    <span style={{ fontSize: 12, display: 'block', textAlign: 'center', color: 'var(--clr-font-a20)' }}>
      {value.toFixed(decimals)}
    </span>
  )
}

function SminCell({ value, ok }: { value: number | null; ok: boolean | null }) {
  if (value === null) return (
    <span style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, display: 'block', textAlign: 'center' }}>—</span>
  )
  return (
    <span style={{ fontSize: 12, display: 'block', textAlign: 'center', color: 'var(--clr-font-a20)' }}>
      {value.toFixed(2)}{' '}
      <span style={{ fontWeight: 700, color: ok ? '#6aab6a' : 'var(--clr-danger-a10)' }}>{ok ? '✓' : '✗'}</span>
    </span>
  )
}

// ── Página ────────────────────────────────────────────────────────

export default function Cortocircuitos() {
  const { tableros, getTablero, loading, error, actualizarFormacion, proyectoActivo } = useProyectos()

  const [tableroId, setTableroId] = useState<number | null>(getLastTableroId)

  const [modalAbierto,          setModalAbierto]          = useState(false)
  const [circuitoEditando,      setCircuitoEditando]      = useState<number | null>(null)
  const [formacionSeleccionada, setFormacionSeleccionada] = useState<FormacionData | null>(null)

  const formato = (proyectoActivo?.formato_formacion as any) ?? 'ingles'

  // Cálculo de cortocircuito: circuitos de potencia — no aplica a tableros
  // CONTROL/DATOS. Los tableros sin categoria (legado) se consideran POTENCIA.
  const tablerosPotencia = tableros.filter(t => t.categoria !== 'CONTROL' && t.categoria !== 'DATOS')

  const idEfectivo = tableroId != null && tablerosPotencia.some(t => t.id === tableroId)
    ? tableroId
    : tablerosPotencia[0]?.id ?? null
  const tablero    = idEfectivo !== null ? getTablero(idEfectivo) : undefined

  const cambiarTablero = (id: number) => {
    setLastTableroId(id)
    setTableroId(id)
  }

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
      const effectiveCable = c.formacion?.cable ?? null
      const familia        = (effectiveCable as any)?.familia ?? null

      // n_conductores_por_fase = conductores en paralelo por fase (Formacion.cond_por_fase),
      // no el Nfases propio del cable (que en un cable multipolar cuenta núcleos internos).
      const nCondEff = c.formacion?.cond_por_fase ?? 1

      const S_real = effectiveCable ? seccionEnMm2(effectiveCable.seccion_f, effectiveCable.calibre_tipo) : null
      const mat = familia?.material    ?? null
      const ais = familia?.aislamiento ?? null
      const material: 'COBRE' | 'ALUMINIO' = (mat ?? '').toLowerCase().includes('alu') ? 'ALUMINIO' : 'COBRE'

      // Reactancia propia de la formación (según disposición unipolar/multipolar y
      // geometría real del cable) en vez del default genérico del motor de CC.
      // calcReactancia devuelve Ω/km, el motor espera Ω/m.
      const xUnitario = effectiveCable
        ? calcReactancia(effectiveCable.diametro, effectiveCable.seccion_f, effectiveCable.calibre_tipo, c.formacion?.disposicion ?? null, effectiveCable.Nfases)
        : null
      const reactanciaUnitaria = xUnitario != null ? xUnitario / 1000 : undefined

      // Motor de cálculo IEC 60909-0 (Front/src/utils/cortocircuito): la barra del
      // tablero se modela como una red equivalente con la Icc ya conocida, y el
      // propio circuito como el único conductor entre la barra y el punto de falla
      // al final del cable. Se piden dos puntos de falla (0.02 s y 0.2 s) para
      // obtener Ith en las dos zonas de protección con un solo cálculo del mismo Z1.
      let Z1_mOhm: number | null = null, kappa: number | null = null
      let Ik_kA: number | null = null, ip_kA: number | null = null
      let Ith_002_A: number | null = null, Ith_02_A: number | null = null
      let R_cable_mOhm: number | null = null, X_cable_mOhm: number | null = null

      if (S_real && c.Largo) {
        const conductor: Conductor = {
          id: String(c.id), longitud: c.Largo, seccion: S_real,
          n_conductores_por_fase: nCondEff, material,
          reactancia_unitaria: reactanciaUnitaria,
          nodo_a: 'BARRA', nodo_b: 'FIN',
        }
        // R/X propios del cable — mismo cálculo que usa el motor internamente para
        // Z1 (§5.3), expuestos por separado para que se vea de dónde sale Z1.
        try {
          const zCable = impedanciaConductor(conductor, 'MAXIMO')
          R_cable_mOhm = zCable.Z1.re * 1000
          X_cable_mOhm = zCable.Z1.im * 1000
        } catch {
          // ídem: datos insuficientes para este circuito puntual, no rompe la tabla.
        }

        if (Icc_panel_A && nivelBarra) {
          try {
            const entrada: EntradaProyecto = {
              proyecto: { nombre: 'cortocircuitos', frecuencia_hz: 50 },
              red_alimentacion: { id: 'BARRA', nodo: 'BARRA', tension_nominal: nivelBarra, corriente_cc: Icc_panel_A },
              transformadores: [],
              generadores: [],
              motores: [],
              conductores: [conductor],
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
      }

      const S_min_002 = Ith_002_A ? calcSminCable(Ith_002_A, 0.02, mat, ais) : null
      const S_min_02  = Ith_02_A  ? calcSminCable(Ith_02_A, 0.2,  mat, ais) : null

      const cable_ok_002 = S_min_002 != null && S_real != null ? S_real >= S_min_002 : null
      const cable_ok_02  = S_min_02  != null && S_real != null ? S_real >= S_min_02  : null

      return {
        id: c.id, circuito: c.circuito,
        formacion: c.formacion ? generarFormacion(c.formacion, formato) : '—',
        formacionData: formacionData(c as any),
        S_real_mm2: S_real != null && !isNaN(S_real) ? S_real : null,
        R_cable_mOhm, X_cable_mOhm,
        Z1_mOhm, kappa, Ik_kA, ip_kA,
        S_min_002, S_min_02,
        cable_ok_002, cable_ok_02,
      }
    })
  }, [tablero, formato])

  // Datos del sistema aguas arriba del tablero — la Icc de entrada y su R/X
  // equivalente (Z_barra en la fórmula Z1 = Z_barra + Z_cable), para que se vea
  // de dónde sale la parte de Z1 que no depende del cable de cada circuito.
  const redInfo = useMemo(() => {
    if (!tablero || tablero.corriente_cc_max == null) return null
    const nivelBarra = tablero.tension_tri ?? tablero.tension_bi ?? tablero.tension_mono ?? null
    if (!nivelBarra) return null
    try {
      const r = impedanciaRed(
        { id: 'BARRA', nodo: 'BARRA', tension_nominal: nivelBarra, corriente_cc: tablero.corriente_cc_max * 1000 },
        'MAXIMO', nivelBarra,
      )
      return { R_mOhm: r.Z1.re * 1000, X_mOhm: r.Z1.im * 1000 }
    } catch {
      return null
    }
  }, [tablero])

  const [colSizing, setColSizing] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('ea_col_cortocircuitos') ?? '{}') } catch { return {} }
  })

  const columns = useMemo(() => [
    columnHelper.accessor('circuito', {
      header: 'Circuito', size: 130,
      meta: { colType: 'label' } as ColMeta,
      cell: info => <span style={{ fontSize: 12, fontWeight: 500 }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('formacion', {
      header: 'Formación', size: 180,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const fd = info.row.original.formacionData
        const openModal = (e: React.MouseEvent) => {
          e.stopPropagation()
          setCircuitoEditando(info.row.original.id)
          setFormacionSeleccionada(fd ?? {
            familia_id: '', cable_fase_id: '', cond_por_fase: '1',
            Nfases: '3', familia_neutro_id: '', cable_neutro_id: '', Nneutro: '1',
            familia_tierra_id: '', cable_tierra_id: '', disposicion: '',
          })
          setModalAbierto(true)
        }
        if (!fd) return <span onClick={openModal} style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, cursor: 'pointer' }}>Sin formación</span>
        return <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={openModal}>{info.getValue()}</span>
      },
    }),
    columnHelper.accessor('S_real_mm2', {
      header: 'S real (mm²)', size: 100,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={1} />,
    }),
    columnHelper.accessor('R_cable_mOhm', {
      header: 'R cable (mΩ)', size: 100,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('X_cable_mOhm', {
      header: 'X cable (mΩ)', size: 100,
      meta: { colType: 'auto' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
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
      header: 'S mín 0.02 s (mm²)', size: 130,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <SminCell value={info.getValue()} ok={info.row.original.cable_ok_002} />,
    }),
    columnHelper.accessor('S_min_02', {
      header: 'S mín 0.2 s (mm²)', size: 130,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <SminCell value={info.getValue()} ok={info.row.original.cable_ok_02} />,
    }),
  ], [setCircuitoEditando, setFormacionSeleccionada, setModalAbierto])

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
        {tablerosPotencia.map(t => (
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
                  {redInfo && <> · R red = {redInfo.R_mOhm.toFixed(2)} mΩ · X red = {redInfo.X_mOhm.toFixed(2)} mΩ</>}
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
                        textAlign: 'center',
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
                la Icc más alta y por eso es el peor caso) y de la reactancia, calculada según la geometría real de la
                formación (disposición trébol/plana para unipolares, o geometría interna para multipolares — misma
                fórmula que en la página de Caídas). Si el cable no tiene diámetro cargado, se usa un valor típico de
                0,08 Ω/km para cable BT multipolar.
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
                <span className="text-font-a20 font-medium">m y n</span> — los dos factores de corrección de{' '}
                <InlineMath math="I_{th}" />. <InlineMath math="m" /> es el efecto de la componente continua (DC,
                la parte unidireccional que decae con el tiempo): depende de κ, la frecuencia de red y la
                duración de la falla, <InlineMath math="m = \dfrac{e^{4 f\, T_k \ln(\kappa - 1)} - 1}{2 f\, T_k \ln(\kappa - 1)}" />
                {' '}(<InlineMath math="f" /> = frecuencia de red, <InlineMath math="T_k" /> = duración de la
                falla). <InlineMath math="n" /> es el efecto de la componente alterna (AC, la parte
                periódica) — solo decae cerca de un generador; lejos de generador vale 1. Esta implementación no
                tiene tabuladas las curvas de la norma para el caso cercano a generador, así que siempre usa{' '}
                <InlineMath math="n=1" /> (aproximación conservadora, no subestima Ith).
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

      {modalAbierto && formacionSeleccionada && (
        <FormacionModal
          formacionInicial={formacionSeleccionada}
          tipoTension={undefined}
          onGuardar={(data, cables) => {
            if (!circuitoEditando) return
            actualizarFormacion(circuitoEditando, {
              cable_id:        Number(data.cable_fase_id),
              cond_por_fase:   Number(data.cond_por_fase),
              Nfases:          Number(data.Nfases),
              Nneutro:         Number(data.Nneutro),
              cable_neutro_id: data.cable_neutro_id ? Number(data.cable_neutro_id) : null,
              cable_tierra_id: data.cable_tierra_id ? Number(data.cable_tierra_id) : null,
              disposicion:     data.disposicion || null,
            }, cables)
            setModalAbierto(false)
          }}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  )
}
