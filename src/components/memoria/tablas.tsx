'use client'
import type { TableroEvaluado, CircuitoEvaluado, NivelHallazgo, AreaHallazgo } from '@/utils/verificacionProyecto'
import type { EstadoSelectividad } from '@/utils/selectividad'
import { LIMITE_CAIDA_PCT } from '@/utils/caida'
import { desequilibrioFases } from '@/utils/cargas'
import { generarFormacion, type FormatoFormacion } from '@/utils/electricidad'
import { proteccionLabel } from '@/utils/protecciones'
import { n, Veredicto } from './Hoja'

// Tablas por tablero que comparten los documentos de /memorias. Cada una recibe el
// tablero ya evaluado: acá solo se le da forma a los números.

export const METODO: Record<string, string> = {
  bandeja_perf: 'Bandeja perforada', bandeja_esc: 'Escalera', conduit_emb: 'Conduit embutido',
  conduit_sup: 'Conduit superficial', enterrado: 'Ducto enterrado', aire_libre: 'Aire libre',
}
const TENSION: Record<string, string> = { mono: 'Monofásica', bi: 'Bifásica', tri: 'Trifásica' }
const NIVEL_TXT: Record<NivelHallazgo, string> = { error: 'NO CUMPLE', falta: 'FALTA DATO', aviso: 'SALVEDAD' }
const SELECTIVIDAD_TXT: Record<EstadoSelectividad, string> = {
  total: 'Total', parcial: 'Parcial', no_selectiva: 'NO SELECTIVA', sin_datos: 'FALTA DATO', no_aplica: 'No aplica',
}

type Props = { t: TableroEvaluado }
type PropsF = Props & { formato: FormatoFormacion }

export const formacionDe = (e: CircuitoEvaluado, formato: FormatoFormacion) =>
  e.circuito.formacion ? generarFormacion(e.circuito.formacion, formato) : '—'

export function TituloTablero({ t, numero }: Props & { numero?: number }) {
  const { tablero } = t
  return <h2>{numero != null ? `${numero}. ` : ''}Tablero {tablero.tag}{tablero.nombre ? ` — ${tablero.nombre}` : ''}</h2>
}

export function DatosTablero({ t }: Props) {
  const { tablero, icc } = t
  return (
    <div className="mem-datos">
      <span><b>Ubicación:</b> {tablero.ubicacion ?? '—'}</span>
      <span><b>Tensiones:</b> {[tablero.tension_tri, tablero.tension_bi, tablero.tension_mono].filter(v => v != null).join(' / ') || '—'} V</span>
      <span><b>Frecuencia:</b> {tablero.frecuencia ?? '—'} Hz</span>
      <span><b>Grado de protección:</b> {tablero.grado_proteccion ?? '—'}</span>
      <span><b>Icc máx de barra:</b> {n(icc.Icc_max_kA)} kA</span>
      <span><b>Icc mín de barra:</b> {n(icc.Icc_min_kA)} kA</span>
    </div>
  )
}

export function TablaCargas({ t, formato, conProteccion = false }: PropsF & { conProteccion?: boolean }) {
  return (
    <table>
      <thead><tr>
        <th className="izq">Circuito</th><th className="izq">Descripción</th><th>Tipo</th><th>Tensión</th><th>U (V)</th>
        <th>Fase</th><th>P (kW)</th><th>cos φ</th><th>Ib (A)</th><th>L (m)</th><th className="izq">Conductores</th>
        {conProteccion && <th className="izq">Protección</th>}
      </tr></thead>
      <tbody>{t.circuitos.map(e => (
        <tr key={e.circuito.id}>
          <td className="izq">{e.circuito.circuito}</td><td className="izq">{e.circuito.descripcion ?? '—'}</td>
          <td>{e.circuito.tipo ?? '—'}</td><td>{e.carga.tipo ? TENSION[e.carga.tipo] ?? e.carga.tipo : '—'}</td>
          <td>{n(e.carga.tension, 0)}</td><td>{e.circuito.fase ?? '—'}</td>
          <td>{n(e.carga.potencia)}</td><td>{n(e.carga.fp)}</td><td>{n(e.carga.corriente, 1)}</td>
          <td>{n(e.circuito.Largo, 0)}</td><td className="izq">{formacionDe(e, formato)}</td>
          {conProteccion && <td className="izq">{e.circuito.proteccion ? proteccionLabel(e.circuito.proteccion) : '—'}</td>}
        </tr>
      ))}</tbody>
    </table>
  )
}

// Corriente por fase de las salidas del tablero (sin la acometida, que es su suma).
export function TablaBalance({ t }: Props) {
  if (t.tablero.tension_tri == null && t.tablero.tension_bi == null)
    return <p className="mem-nota">No aplica: el tablero es monofásico.</p>
  if (!t.fases) return <p className="mem-nota">Sin datos suficientes para el balance de fases (faltan potencia, FP o fase asignada).</p>
  const { R, S, T } = t.fases
  const d = desequilibrioFases(t.fases)
  return (
    <>
      <table style={{ width: 'auto', minWidth: 420 }}>
        <thead><tr><th>I fase R (A)</th><th>I fase S (A)</th><th>I fase T (A)</th><th>Promedio (A)</th><th>Desequilibrio</th></tr></thead>
        <tbody><tr>
          <td>{n(R, 1)}</td><td>{n(S, 1)}</td><td>{n(T, 1)}</td><td>{n((R + S + T) / 3, 1)}</td><td>{d != null ? `${n(d, 1)} %` : '—'}</td>
        </tr></tbody>
      </table>
      <p className="mem-nota">Suma de las corrientes de las salidas por fase, sin factores de simultaneidad. Desequilibrio = (I máx − I mín) / I promedio.</p>
    </>
  )
}

export function TablaAmpacidad({ t }: Props) {
  return (
    <>
      <table>
        <thead><tr>
          <th className="izq">Circuito</th><th>Método</th><th>Iadm·n (A)</th><th>FH</th><th>FC</th><th>FT</th>
          <th>Iz (A)</th><th>Ib (A)</th><th>Iz ≥ Ib</th><th className="izq">Protección</th><th>Ib ≤ In ≤ Iz</th>
        </tr></thead>
        <tbody>{t.circuitos.map(e => {
          const a = e.ampacidad
          const coord = a.coord.estado === 'ok' ? true : a.coord.estado === 'sin_datos' || a.coord.estado === 'no_aplica' ? null : false
          return (
            <tr key={e.circuito.id}>
              <td className="izq">{e.circuito.circuito}</td><td>{METODO[a.metodo] ?? '—'}</td>
              <td>{n(a.iadm, 1)}{a.iadmAviso ? ' *' : ''}</td><td>{n(a.fh, 3)}</td><td>{n(a.fcEfectivo)}</td><td>{n(a.ftEfectivo)}</td>
              <td>{n(a.iadm_corr, 1)}</td><td>{n(e.carga.corriente, 1)}</td><td><Veredicto v={a.cumple} /></td>
              <td className="izq">{e.circuito.proteccion ? proteccionLabel(e.circuito.proteccion) : '—'}</td>
              <td><Veredicto v={coord} /></td>
            </tr>
          )
        })}</tbody>
      </table>
      {t.circuitos.some(e => e.ampacidad.iadmAviso) && (
        <p className="mem-nota">* El cable no tiene cargada la corriente admisible para ese método de instalación: se usó la genérica del catálogo.</p>
      )}
    </>
  )
}

export function TablaCaida({ t }: Props) {
  return (
    <table>
      <thead><tr>
        <th className="izq">Circuito</th><th>Ib (A)</th><th>L (m)</th><th>Cond./fase</th><th>R (Ω/km)</th><th>X (Ω/km)</th>
        <th>cos φ</th><th>e (V)</th><th>e (%)</th><th>≤ {LIMITE_CAIDA_PCT} %</th>
      </tr></thead>
      <tbody>{t.circuitos.map(e => (
        <tr key={e.circuito.id}>
          <td className="izq">{e.circuito.circuito}</td><td>{n(e.carga.corriente, 1)}</td><td>{n(e.caida.largoAuto, 0)}</td>
          <td>{e.caida.cfAuto ?? '—'}</td><td>{n(e.caida.rAuto, 4)}</td><td>{n(e.caida.xAuto, 4)}</td><td>{n(e.carga.fp)}</td>
          <td>{n(e.caida.ev)}</td><td>{n(e.caida.epct)}</td>
          <td><Veredicto v={e.caida.epct == null ? null : e.caida.epct <= LIMITE_CAIDA_PCT} /></td>
        </tr>
      ))}</tbody>
    </table>
  )
}

export function TablaCortocircuito({ t }: Props) {
  return (
    <table>
      <thead><tr>
        <th className="izq">Circuito</th><th>S (mm²)</th><th>I&quot;k máx (kA)</th><th>ip (kA)</th><th>I&quot;k mín (kA)</th><th>Falla mín.</th>
        <th>Icu (kA)</th><th>Icu ≥ Icc barra</th><th>Im (A)</th><th>Im ≤ I&quot;k mín</th><th>S mín 0,02 s</th><th>S mín 0,2 s</th>
      </tr></thead>
      <tbody>{t.circuitos.map(e => {
        const c = e.cc
        return (
          <tr key={e.circuito.id}>
            <td className="izq">{e.circuito.circuito}</td><td>{n(c.S_real_mm2, 1)}</td><td>{n(c.Ik_kA_max)}</td><td>{n(c.ip_kA)}</td>
            <td>{n(c.Ik_kA_min)}</td><td>{c.tipoFallaMin === 'FASE_NEUTRO' ? 'F-N' : c.tipoFallaMin === 'BIFASICA' ? 'F-F' : '—'}</td>
            <td>{n(c.Icu_kA, 1)}</td><td><Veredicto v={c.Icu_ok} /></td><td>{n(c.Im_A, 0)}</td><td><Veredicto v={c.Im_ok} /></td>
            <td>{n(c.S_min_002)}</td><td>{n(c.S_min_02)}</td>
          </tr>
        )
      })}</tbody>
    </table>
  )
}

export function TablaSelectividad({ t }: Props) {
  return (
    <table>
      <thead><tr>
        <th className="izq">Circuito</th><th className="izq">Protección</th><th className="izq">Aguas arriba</th>
        <th>Is (A)</th><th>Origen</th><th>Icc máx barra (kA)</th><th>Resultado</th>
      </tr></thead>
      <tbody>{t.circuitos.map(e => {
        const s = e.selectividad
        return (
          <tr key={e.circuito.id}>
            <td className="izq">{e.circuito.circuito}</td>
            <td className="izq">{e.circuito.proteccion ? proteccionLabel(e.circuito.proteccion) : '—'}</td>
            <td className="izq">{s.aguasArriba ? `${s.aguasArriba.circuito}: ${proteccionLabel(s.aguasArriba.proteccion)}` : '—'}</td>
            <td>{n(s.Is_A, 0)}</td>
            <td>{s.origen === 'manual' ? 'Fabricante' : s.origen === 'calculado' ? 'Calculado' : '—'}</td>
            <td>{n(t.icc.Icc_max_kA)}</td>
            <td className={s.estado === 'no_selectiva' ? 'mem-mal' : s.estado === 'total' ? 'mem-bien' : undefined}>{SELECTIVIDAD_TXT[s.estado]}</td>
          </tr>
        )
      })}</tbody>
    </table>
  )
}

// `areas`: si se pasa, solo las observaciones de esas áreas (documentos parciales).
export function TablaObservaciones({ t, areas }: Props & { areas?: AreaHallazgo[] }) {
  const observaciones = [
    ...t.hallazgos.map(h => ({ ...h, circuito: 'Tablero' })),
    ...t.circuitos.flatMap(e => e.hallazgos.map(h => ({ ...h, circuito: e.circuito.circuito }))),
  ].filter(h => !areas || areas.includes(h.area))
  if (observaciones.length === 0) return <p>Sin observaciones.</p>
  return (
    <table>
      <thead><tr><th className="izq" style={{ width: 130 }}>Circuito</th><th style={{ width: 90 }}>Estado</th><th style={{ width: 100 }}>Área</th><th className="izq">Detalle</th></tr></thead>
      <tbody>{observaciones.map((h, k) => (
        <tr key={k}>
          <td className="izq">{h.circuito}</td>
          <td className={h.nivel === 'error' ? 'mem-mal' : undefined}>{NIVEL_TXT[h.nivel]}</td>
          <td>{h.area}</td><td className="izq">{h.mensaje}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}
