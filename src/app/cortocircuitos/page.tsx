'use client'
import { useState, useMemo } from 'react'
import { InlineMath } from 'react-katex'
import { createColumnHelper, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { TablaCalculo, EncabezadoTablero, TableroPills, AutoCell, useColSizing, type ColMeta } from '@/components/TablaCalculo'
import { useProyectos } from '@/context/ProyectosContext'
import FormacionModal from '@/components/FormacionModal'
import ProteccionModal from '@/components/ProteccionModal'
import { formacionData } from '@/app/cargas/utils'
import type { FormacionData } from '@/app/cargas/types'
import { generarFormacion } from '@/utils/electricidad'
import { impedanciaRed } from '@/utils/cortocircuito'
import { verificarCircuitoCC, type BarraCC, type TipoFallaMin } from '@/utils/verificacionCortocircuito'
import { calcularIccTablero, esCircuitoEsencial } from '@/utils/calcularIccTablero'
import { selectividadCircuito, type Selectividad, type EstadoSelectividad } from '@/utils/selectividad'
import CeldaEditable from '@/components/CeldaEditable'
import { varianteLabel } from '@/utils/protecciones'
import { useTableroSeleccionado } from '@/hooks/useTableroSeleccionado'
import type { Proteccion } from '@/context/types'

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
  Ik_kA_max:    number | null
  Ik_kA_min:    number | null
  tipoFallaMin: TipoFallaMin | null
  ip_kA:        number | null
  S_min_002:    number | null
  S_min_02:     number | null
  cable_ok_002: boolean | null
  cable_ok_02:  boolean | null
  proteccionId:    number | null
  proteccionData:  Proteccion | null
  proteccionLabel: string
  Icu_kA:  number | null
  Im_A:    number | null
  Icu_ok:  boolean | null
  Im_ok:   boolean | null
  selectividad: Selectividad
  selManual: string   // lo cargado a mano: un valor en A, 'total' o ''
}

const columnHelper = createColumnHelper<CortocircRow>()

// ── Celdas ────────────────────────────────────────────────────────

// Estado combinado de la verificación de la protección — 'sin_datos' cubre tanto el
// caso de faltar Icc/curva para poder evaluar como el caso en que solo una de las dos
// verificaciones (Icu/Im) tiene datos: no alcanza para dar por buena la protección,
// pero tampoco hay un ✗ concreto que mostrar.
type EstadoProteccion = 'ok' | 'fail' | 'sin_datos'

function estadoProteccion(Icu_ok: boolean | null, Im_ok: boolean | null): EstadoProteccion {
  if (Icu_ok === false || Im_ok === false) return 'fail'
  if (Icu_ok === true && Im_ok === true) return 'ok'
  return 'sin_datos'
}

const ESTADO_ICONO: Record<EstadoProteccion, { simbolo: string; color: string }> = {
  ok:        { simbolo: '✓', color: '#6aab6a' },
  fail:      { simbolo: '✗', color: 'var(--clr-danger-a10)' },
  sin_datos: { simbolo: '?', color: '#d4a24a' },
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

const SELECTIVIDAD: Record<EstadoSelectividad, { texto: string; color: string }> = {
  total:        { texto: 'Total',         color: '#6aab6a' },
  parcial:      { texto: 'Parcial',       color: 'var(--clr-warning-a10)' },
  no_selectiva: { texto: 'No selectiva',  color: 'var(--clr-danger-a10)' },
  sin_datos:    { texto: '?',             color: '#d4a24a' },
  no_aplica:    { texto: '—',             color: 'var(--clr-surface-tonal-a40)' },
}

function SelectividadCell({ s }: { s: Selectividad }) {
  const { texto, color } = SELECTIVIDAD[s.estado]
  return (
    <span title={s.detalle} style={{ fontSize: 12, display: 'block', textAlign: 'center', color, fontWeight: s.estado === 'no_aplica' ? 400 : 600 }}>
      {texto}
      {s.estado === 'parcial' && s.Is_A != null && <span style={{ fontWeight: 400 }}> · {Math.round(s.Is_A)} A</span>}
      {s.origen === 'manual' && <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.75 }}> (fab.)</span>}
    </span>
  )
}

// ── Página ────────────────────────────────────────────────────────

export default function Cortocircuitos() {
  const { tableros, getTablero, loading, error, actualizarFormacion, actualizarProteccion, actualizarSelectividad, proyectoActivo } = useProyectos()


  const [modalAbierto,          setModalAbierto]          = useState(false)
  const [circuitoEditando,      setCircuitoEditando]      = useState<number | null>(null)
  const [formacionSeleccionada, setFormacionSeleccionada] = useState<FormacionData | null>(null)

  const [modalProteccionAbierto,     setModalProteccionAbierto]     = useState(false)
  const [circuitoProteccionEditando, setCircuitoProteccionEditando] = useState<number | null>(null)
  const [proteccionSeleccionada,     setProteccionSeleccionada]     = useState<Proteccion | null>(null)

  const formato = (proyectoActivo?.formato_formacion as any) ?? 'ingles'

  // Cálculo de cortocircuito: circuitos de potencia — no aplica a tableros
  // CONTROL/DATOS. Los tableros sin categoria (legado) se consideran POTENCIA.
  const tablerosPotencia = tableros.filter(t => t.categoria !== 'CONTROL' && t.categoria !== 'DATOS')

  const { tablero, idEfectivo, seleccionarTablero } = useTableroSeleccionado(tablerosPotencia)

  const cambiarTablero = (id: number) => {
    seleccionarTablero(id)
  }

  // Icc de barra derivada de la red aguas arriba (fuente propia del tablero, o el
  // tablero que lo alimenta vía un circuito ALIMENTADOR, recursivamente) — ver
  // utils/calcularIccTablero.ts. No hay Icc cargada a mano en el tablero
  // (se quitó el campo legado): si no hay fuente ni alimentador, da null y se muestra "—".
  const iccTablero = useMemo(
    () => tablero ? calcularIccTablero(tablero, tableros) : { Icc_max_kA: null, Icc_min_kA: null, avisos: [] },
    [tablero, tableros],
  )

  const rows = useMemo((): CortocircRow[] => {
    if (!tablero) return []
    const sorted = [...tablero.circuitos].sort((a, b) => a.orden - b.orden)
    // Nivel de tensión de la barra: tri > bi > mono, igual criterio que el resto de la app.
    const Un = tablero.tension_tri ?? tablero.tension_bi ?? tablero.tension_mono ?? null
    const barra: BarraCC = {
      Icc_max_A: iccTablero.Icc_max_kA != null ? iccTablero.Icc_max_kA * 1000 : null,
      Icc_min_A: iccTablero.Icc_min_kA != null ? iccTablero.Icc_min_kA * 1000 : null,
      Un,
      U0: tablero.tension_mono ?? (Un != null ? Un / Math.sqrt(3) : null),
      frecuencia_hz: tablero.frecuencia === 60 ? 60 : 50,
    }

    // Todo el cálculo por circuito está en utils/verificacionCortocircuito.ts
    // (función pura, con tests): qué falla se usa para cada verificación y por qué.
    return sorted.map(c => {
      const proteccion = c.proteccion
      return {
        id: c.id, circuito: c.circuito,
        formacion: c.formacion ? generarFormacion(c.formacion, formato) : '—',
        formacionData: formacionData(c as any),
        // Un circuito no esencial no lo alimenta el respaldo: usa la Icc mínima de la alimentación principal.
        ...verificarCircuitoCC(c, esCircuitoEsencial(c, tablero) || iccTablero.Icc_min_principal_kA == null ? barra : { ...barra, Icc_min_A: iccTablero.Icc_min_principal_kA * 1000 }),
        selectividad: selectividadCircuito(c, tablero, tableros, barra.Icc_max_A),
        selManual: c.selectividad_total ? 'total' : c.selectividad_Is != null ? String(c.selectividad_Is) : '',
        proteccionId: proteccion?.id ?? null,
        proteccionData: proteccion,
        proteccionLabel: proteccion ? varianteLabel(proteccion, proteccion.familia?.tipo ?? '') : '—',
      }
    })
  }, [tablero, tableros, formato, iccTablero])

  // R/X equivalente aguas arriba de la barra (Z_barra en la fórmula Z1 = Z_barra + Z_cable),
  // re-derivado de la Icc máxima ya calculada — mismo criterio simplificado (R/X default de
  // red) que usa cada circuito para su propio Z1, así ambos números son consistentes entre sí.
  const redInfo = useMemo(() => {
    if (!tablero || iccTablero.Icc_max_kA == null) return null
    const nivelBarra = tablero.tension_tri ?? tablero.tension_bi ?? tablero.tension_mono ?? null
    if (!nivelBarra) return null
    try {
      const r = impedanciaRed(
        { id: 'BARRA', nodo: 'BARRA', tension_nominal: nivelBarra, corriente_cc: iccTablero.Icc_max_kA * 1000 },
        'MAXIMO', nivelBarra,
      )
      return { R_mOhm: r.Z1.re * 1000, X_mOhm: r.Z1.im * 1000 }
    } catch {
      return null
    }
  }, [tablero, iccTablero])

  const { colSizing, onColumnSizingChange } = useColSizing('ea_col_cortocircuitos')

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
    columnHelper.accessor('proteccionLabel', {
      header: 'Protección', size: 170,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const row = info.row.original
        const openModal = (e: React.MouseEvent) => {
          e.stopPropagation()
          setCircuitoProteccionEditando(row.id)
          setProteccionSeleccionada(row.proteccionData)
          setModalProteccionAbierto(true)
        }
        if (!row.proteccionId) return <span onClick={openModal} style={{ color: 'var(--clr-surface-tonal-a40)', fontSize: 12, cursor: 'pointer' }}>Sin protección</span>
        const { simbolo, color } = ESTADO_ICONO[estadoProteccion(row.Icu_ok, row.Im_ok)]
        const tooltip = [
          row.Icu_kA != null ? `Icu ${row.Icu_kA.toFixed(row.Icu_kA >= 100 ? 0 : 1)}kA` : 'Icu: sin datos',
          row.Im_A != null ? `Im ${row.Im_A.toFixed(row.Im_A >= 100 ? 0 : 1)}A` : 'Im: sin datos',
        ].join(' · ')
        return (
          <span
            onClick={openModal} title={tooltip}
            style={{ cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <span style={{ textDecoration: 'underline dotted' }}>{info.getValue()}</span>
            <span style={{ fontWeight: 700, color }}>{simbolo}</span>
          </span>
        )
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
    columnHelper.accessor('Ik_kA_max', {
      header: 'I"k máx (kA)', size: 100,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <AutoCell value={info.getValue()} decimals={2} />,
    }),
    columnHelper.accessor('Ik_kA_min', {
      header: 'I"k mín (kA)', size: 100,
      meta: { colType: 'result' } as ColMeta,
      cell: info => {
        const tipo = info.row.original.tipoFallaMin
        return (
          <span title={tipo === 'FASE_NEUTRO' ? 'Falla fase-neutro en el extremo' : tipo === 'BIFASICA' ? 'Falla bifásica en el extremo (circuito sin neutro)' : undefined}>
            <AutoCell value={info.getValue()} decimals={2} />
          </span>
        )
      },
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
    columnHelper.accessor(row => row.selectividad.estado, {
      id: 'selectividad', header: 'Selectividad', size: 130,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <SelectividadCell s={info.row.original.selectividad} />,
    }),
    columnHelper.accessor('selManual', {
      header: 'Is fabricante (A)', size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => (
        <CeldaEditable
          valor={info.getValue()}
          onGuardar={v => {
            const t = v.trim().toLowerCase()
            if (t === '') return actualizarSelectividad(info.row.original.id, null, false)
            if (t === 'total' || t === 't') return actualizarSelectividad(info.row.original.id, null, true)
            const num = Number(t.replace(',', '.'))
            if (num > 0) actualizarSelectividad(info.row.original.id, num, false)
          }}
        />
      ),
    }),
  ], [setCircuitoEditando, setFormacionSeleccionada, setModalAbierto, setCircuitoProteccionEditando, setProteccionSeleccionada, setModalProteccionAbierto, actualizarSelectividad])

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
      <div className="px-3 pt-3 pb-2"><TableroPills tableros={tablerosPotencia} idActivo={idEfectivo} onSelect={cambiarTablero} /></div>

      {!tablero ? (
        <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin tablero activo.</p>
      ) : (
        <div className="datatable-container">
          <EncabezadoTablero tablero={tablero}>
            <span className="text-[12px] text-surface-tonal-a40">
                Icc max = {iccTablero.Icc_max_kA != null ? `${iccTablero.Icc_max_kA.toFixed(2)} kA` : '—'}
                {' '}· Icc min = {iccTablero.Icc_min_kA != null ? `${iccTablero.Icc_min_kA.toFixed(2)} kA` : '—'}
                {redInfo && <> · R red = {redInfo.R_mOhm.toFixed(2)} mΩ · X red = {redInfo.X_mOhm.toFixed(2)} mΩ</>}
              </span>
          </EncabezadoTablero>

          {/* Lo que el cálculo de Icc de barra no pudo considerar — se muestra siempre
              junto al resultado para que nadie confíe en un número que omitió algo. */}
          {iccTablero.avisos.length > 0 && (
            <ul className="px-3.5 py-2 border-b border-[var(--dt-border-color)] text-[12px] space-y-0.5" style={{ color: 'var(--clr-warning-a10)' }}>
              {iccTablero.avisos.map(a => <li key={a}>⚠ {a}</li>)}
            </ul>
          )}

          <TablaCalculo table={table} />

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
                <span className="text-font-a20 font-medium">Icc max / Icc min (barra)</span> — la corriente de
                cortocircuito de la barra del tablero, de donde sale <InlineMath math="Z_{barra}" /> para todos los
                circuitos. Ya no es un dato que se carga a mano: se recorre la red aguas arriba de este tablero — si
                tiene una fuente de alimentación propia (red, red + transformador, o generador) se calcula desde ahí;
                si en cambio lo alimenta otro tablero a través de un circuito ALIMENTADOR, se hereda la Icc de ese
                tablero (recursivamente) sumando en serie el cable del alimentador; si no hay ninguna de las dos cosas
                cargada, no hay forma de derivarla y queda en <b>—</b>. Si un tablero tiene más de un camino posible
                (ej. red normal + generador de respaldo), se evalúa cada uno por separado y se toma el peor caso —
                el más alto para Icc max, el más bajo para Icc min — en vez de combinarlos en paralelo.
              </div>

              <div>
                <span className="text-font-a20 font-medium">Z1 (mΩ)</span> — impedancia total entre la barra y el
                extremo del cable: <InlineMath math="Z_1 = Z_{barra} + Z_{cable}" />.{' '}
                <b>De dónde sale:</b> <InlineMath math="Z_{barra}" /> se deriva de la Icc máxima de la barra (ver
                arriba). <InlineMath math="Z_{cable}" /> sale de la
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
                <span className="text-font-a20 font-medium">I&quot;k máx (kA)</span> — corriente de cortocircuito
                inicial simétrica de una falla trifásica en el extremo del cable:{' '}
                <InlineMath math="I''_{k} = \dfrac{c \cdot U_n}{\sqrt{3}\,|Z_1|}" />.{' '}
                <InlineMath math="U_n" /> es la tensión de línea del tablero; <InlineMath math="c" /> es el factor de
                tensión de la norma (1,05 para baja tensión en el escenario de corriente máxima). Usa la Icc máxima
                de la barra y el cable a 20 °C. Z1, κ, ip y S mín salen de este mismo escenario.
              </div>

              <div>
                <span className="text-font-a20 font-medium">I&quot;k mín (kA)</span> — la falla más débil que puede
                ocurrir en el extremo del cable, que es la que tiene que hacer disparar a la protección. Si el
                circuito lleva neutro es una falla <b>fase-neutro</b>:{' '}
                <InlineMath math="I''_{k1} = \dfrac{c_{min} \cdot U_0}{|Z_{barra} + Z_{fase} + Z_{neutro}|}" />, con
                cada conductor según su propia sección; si no lleva neutro, una falla <b>bifásica</b>:{' '}
                <InlineMath math="I''_{k2} = \dfrac{c_{min} \cdot U_n}{2\,|Z_1|}" />. En ambos casos se usa la Icc
                mínima de la barra, <InlineMath math="c_{min} = 0{,}95" /> y los conductores a la temperatura máxima
                de servicio del cable (más resistencia, menos corriente). Pasá el mouse sobre el valor para ver qué
                tipo de falla se usó. No se evalúa la falla fase-PE: depende del esquema de conexión a tierra, que
                la app todavía no modela.
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
                Cu/PVC = 115 · Al/XLPE = 94 · Al/PVC = 76, IEC 60364-4-43 Tabla 43A).
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
                despejar). El cable tiene que soportar ambos casos. Es una verificación <b>orientativa</b>: usa la
                falla en el extremo y tiempos fijos. La verificación rigurosa compara la energía que deja pasar el
                dispositivo (<InlineMath math="I^2t" />) contra <InlineMath math="k^2 S^2" /> con la falla al inicio
                del cable, y necesita el dato de I²t del catálogo de protecciones, que todavía no está cargado.
              </div>

              <div>
                <span className="text-font-a20 font-medium">Protección</span> — la termomagnética (u otro dispositivo
                del catálogo) asignada al circuito, con un símbolo al lado que resume si es adecuada para esta falla
                (pasá el mouse sobre él para ver los valores de Icu/Im). Se verifican dos cosas independientes:{' '}
                <b>Icu</b> (poder de corte) tiene que ser mayor o igual a la <b>Icc máxima de la barra</b>,{' '}
                <InlineMath math="I_{cu} \geq I_{cc,max}" /> — el interruptor está montado en la barra, así que la
                falla más severa que tiene que cortar es la de sus propios bornes, no la del extremo del cable; y el
                umbral de disparo magnético <InlineMath math="I_m = mult_{curva} \times I_n" /> (extremo{' '}
                <b>superior</b> de la banda de la curva B/C/D/K/Z — recién a partir de ahí el disparo instantáneo está
                garantizado) tiene que quedar por debajo de la falla más débil,{' '}
                <InlineMath math="I_m \leq I''_{k,min}" />, para asegurar que dispare instantáneamente incluso en el
                peor caso. <b className="text-[#6aab6a]">✓</b> verde: ambas verificaciones dieron bien.{' '}
                <b style={{ color: 'var(--clr-danger-a10)' }}>✗</b> roja: al menos una dio mal. <b style={{ color: '#d4a24a' }}>?</b>{' '}
                ámbar: no hay datos suficientes para completar alguna de las dos verificaciones — por ejemplo, la
                protección no tiene curva cargada (caso típico de los diferenciales) o el tablero no tiene Icc mínima
                cargada.
              </div>

              <div>
                <span className="text-font-a20 font-medium">Selectividad</span> — si ante una falla en este circuito
                dispara solo su protección o también la que tiene aguas arriba (el interruptor general del tablero o,
                si no tiene, la protección del alimentador que llega a él; pasá el mouse para ver contra cuál se
                comparó). Se calcula solo entre protecciones con curva normalizada B/C/D/K/Z: la de aguas arriba no
                dispara por su magnético mientras la falla no llegue al extremo <b>inferior</b> de su banda, así que
                el límite de selectividad es <InlineMath math="I_s = mult_{min} \times I_{n,arriba}" /> (curva C:{' '}
                <InlineMath math="5 \cdot I_n" />). Si <InlineMath math="I_s \geq I_{cc,max}" /> de la barra es{' '}
                <b>total</b>; si no, <b>parcial</b> hasta <InlineMath math="I_s" />. Si la In de aguas arriba no supera
                la de este circuito, <b>no selectiva</b>. Es un límite conservador: el real suele ser mayor y sale de
                las tablas de selectividad del fabricante. En la zona de sobrecarga solo se exige que la In de aguas
                arriba sea mayor; no se comparan las curvas térmicas punto a punto.
              </div>

              <div>
                <span className="text-font-a20 font-medium">Is fabricante (A)</span> — límite de selectividad tomado
                de la tabla del fabricante para ese par de protecciones: un valor en amperes, o <b>total</b>. Si está
                cargado reemplaza al calculado (se marca «fab.»). Es la única forma de evaluar protecciones sin curva
                normalizada (caja moldeada con relé regulable, guardamotores, fusibles): sin ese dato quedan en{' '}
                <b style={{ color: '#d4a24a' }}>?</b>. Vacío = usar el calculado. La selectividad entre diferenciales
                no se evalúa.
              </div>
            </div>

            <p>
              <b className="text-font-a20">Qué no calcula todavía:</b> las fuentes tipo UPS y paneles solares no
              tienen fórmula de impedancia en el motor (son fuentes limitadas electrónicamente, fuera del alcance de
              la IEC 60909-0) y se ignoran en la cadena. Si un tablero tiene más de una red o más de un transformador
              cargados a la vez, todos los transformadores se emparejan con la primera red — no se distingue cuál
              trafo cuelga de cuál red. Y no se modela el estado de interruptores (normalmente abiertos, enclavamientos):
              se asume que toda fuente y todo alimentador cargado está efectivamente conectado.
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

      {modalProteccionAbierto && (
        <ProteccionModal
          proteccionInicial={proteccionSeleccionada}
          onGuardar={proteccion => {
            if (!circuitoProteccionEditando) return
            actualizarProteccion(circuitoProteccionEditando, proteccion)
            setModalProteccionAbierto(false)
          }}
          onCerrar={() => setModalProteccionAbierto(false)}
        />
      )}
    </div>
  )
}
