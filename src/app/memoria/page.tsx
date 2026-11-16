'use client'
import { useMemo, useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'
import { evaluarProyecto, type CircuitoEvaluado, type NivelHallazgo } from '@/utils/verificacionProyecto'
import { leerParametrosSitio, SITIO_DEFAULT } from '@/utils/parametrosSitio'
import { LIMITE_CAIDA_PCT } from '@/utils/caida'
import { generarFormacion, type FormatoFormacion } from '@/utils/electricidad'
import { proteccionLabel } from '@/utils/protecciones'
import type { EstadoSelectividad } from '@/utils/selectividad'

// Memoria de cálculo imprimible (Imprimir → Guardar como PDF). Se muestra como una
// hoja blanca también en pantalla: lo que se ve es lo que sale impreso. Todos los
// números salen de evaluarProyecto — las mismas funciones que usan las páginas.

const METODO: Record<string, string> = {
  bandeja_perf: 'Bandeja perforada', bandeja_esc: 'Escalera', conduit_emb: 'Conduit embutido',
  conduit_sup: 'Conduit superficial', enterrado: 'Ducto enterrado', aire_libre: 'Aire libre',
}
const TENSION: Record<string, string> = { mono: 'Monofásica', bi: 'Bifásica', tri: 'Trifásica' }
const NIVEL_TXT: Record<NivelHallazgo, string> = { error: 'NO CUMPLE', falta: 'FALTA DATO', aviso: 'SALVEDAD' }

const SELECTIVIDAD_TXT: Record<EstadoSelectividad, string> = {
  total: 'Total', parcial: 'Parcial', no_selectiva: 'NO SELECTIVA', sin_datos: 'FALTA DATO', no_aplica: 'No aplica',
}

const n = (v: number | null | undefined, d = 2) => v == null || isNaN(v) ? '—' : v.toFixed(d)
const sn = (v: boolean | null) => v == null ? '—' : v ? 'Cumple' : 'NO CUMPLE'

function Veredicto({ v }: { v: boolean | null }) {
  return <span className={v === false ? 'mem-mal' : v === true ? 'mem-bien' : undefined}>{sn(v)}</span>
}

const ESTILOS = `
.mem-fondo { background: var(--clr-surface-a10); padding: 20px 16px 60px; min-height: 100dvh; }
.mem-barra { max-width: 1100px; margin: 0 auto 14px; display: flex; align-items: center; gap: 12px; justify-content: space-between; font-size: 12px; color: var(--clr-surface-tonal-a40); }
.mem-btn { background: var(--clr-info-a0); color: #fff; border: 1px solid var(--clr-info-a10); border-radius: 6px; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.mem-hoja { max-width: 1100px; margin: 0 auto; background: #fff; color: #111; padding: 36px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.45; }
.mem-hoja h1 { font-size: 20px; margin: 0 0 4px; }
.mem-hoja h2 { font-size: 14px; margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #111; }
.mem-hoja h3 { font-size: 12px; margin: 16px 0 6px; break-after: avoid; }
.mem-hoja p { margin: 0 0 6px; }
.mem-hoja table { width: 100%; border-collapse: collapse; margin: 4px 0 10px; }
.mem-hoja th, .mem-hoja td { border: 1px solid #999; padding: 3px 5px; text-align: center; vertical-align: middle; }
.mem-hoja th { background: #e9e9e9; font-weight: 700; }
.mem-hoja td.izq, .mem-hoja th.izq { text-align: left; }
.mem-datos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px 18px; margin-bottom: 8px; }
.mem-datos span b { font-weight: 700; }
.mem-mal { color: #b00020; font-weight: 700; }
.mem-bien { color: #1b6e1b; }
.mem-nota { color: #555; font-size: 10px; }
.mem-tablero { break-before: page; }
.mem-hoja tr { break-inside: avoid; }
@media print {
  nav, .mem-barra { display: none !important; }
  html, body { background: #fff !important; }
  .mem-fondo { background: #fff; padding: 0; }
  .mem-hoja { max-width: none; padding: 0; }
  @page { size: A4 landscape; margin: 12mm; }
}
`

export default function Memoria() {
  const { tableros, segmentos, proyectoActivo } = useProyectos()
  const [sitio] = useState(() => typeof window === 'undefined' ? SITIO_DEFAULT : leerParametrosSitio())
  const [fecha] = useState(() => new Date().toLocaleDateString('es-AR'))
  const evaluado = useMemo(() => evaluarProyecto(tableros, segmentos, sitio), [tableros, segmentos, sitio])
  const formato = (proyectoActivo?.formato_formacion as FormatoFormacion) ?? 'ingles'

  if (!proyectoActivo) return <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin proyecto activo.</p>

  const { resumen } = evaluado
  const formacionDe = (e: CircuitoEvaluado) => e.circuito.formacion ? generarFormacion(e.circuito.formacion, formato) : '—'

  return (
    <div className="mem-fondo">
      <style>{ESTILOS}</style>

      <div className="mem-barra">
        <span>Vista previa de la memoria de cálculo. Para obtener el PDF: Imprimir → Guardar como PDF (A4 apaisado).</span>
        <button className="mem-btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>

      <div className="mem-hoja">
        <h1>Memoria de cálculo eléctrico</h1>
        <p style={{ fontSize: 13 }}><b>{proyectoActivo.nombre}</b>{proyectoActivo.descripcion ? ` — ${proyectoActivo.descripcion}` : ''}</p>
        <p className="mem-nota">Emitida el {fecha} · Generada con ElectricApp</p>

        <h2>1. Alcance y resumen</h2>
        <p>
          Comprende los {evaluado.tableros.length} tablero(s) de potencia del proyecto y sus {resumen.circuitos} circuito(s):
          corriente de diseño, corriente admisible de los conductores, coordinación con la protección, caída de tensión,
          cortocircuito y selectividad.
        </p>
        <p>
          Resultado: <b>{resumen.circuitosOk}</b> circuito(s) sin observaciones ·{' '}
          <span className={resumen.error ? 'mem-mal' : undefined}>{resumen.error} verificación(es) que no cumplen</span> ·{' '}
          {resumen.falta} dato(s) faltante(s) · {resumen.aviso} salvedad(es). El detalle está en la sección de observaciones de
          cada tablero.
        </p>
        <div className="mem-datos">
          <span><b>Altitud:</b> {sitio.altitud} m.s.n.m.</span>
          <span><b>Temperatura ambiente:</b> {sitio.tempAmbiente ?? '—'} °C</span>
          <span><b>Límite de caída:</b> {LIMITE_CAIDA_PCT} %</span>
        </div>

        <h2>2. Criterios de cálculo</h2>
        <p><b>Corriente de diseño (Ib).</b> Monofásico/bifásico: I = P / (U · cos φ). Trifásico: I = P / (√3 · U · cos φ). La
          acometida suma la potencia de los circuitos del tablero con factor de potencia ponderado por potencia; un
          alimentador toma la demanda del tablero que alimenta. No se aplican factores de demanda ni de simultaneidad.</p>
        <p><b>Corriente admisible (Iz).</b> Iz = Iadm · n · FH · FC · FT. Iadm: dato de catálogo del cable para la forma de
          instalación; n: conductores en paralelo por fase; FH: factor por altitud, min(1; 1,02 − 0,00002·h); FC: factor por
          agrupamiento (AEA 90364-7-771 / IEC 60364-5-52 B.52.17 y B.52.20) según el método y la cantidad de circuitos que
          comparten canalización; FT: factor por temperatura ambiente, √((θmáx − θamb) / (θmáx − θref)) con θref = 30 °C al
          aire y 20 °C enterrado. Condición: Iz ≥ Ib.</p>
        <p><b>Coordinación con la protección.</b> Ib ≤ In ≤ Iz.</p>
        <p><b>Caída de tensión.</b> e = k · (Ib / n) · L · (R·cos φ + X·sen φ), con k = 2 (monofásico/bifásico) o √3
          (trifásico); R a la temperatura máxima de servicio del conductor (IEC 60228) y X según la disposición de la
          formación. Límite adoptado: {LIMITE_CAIDA_PCT} %.</p>
        <p><b>Cortocircuito.</b>{' '}Método de la fuente de tensión equivalente, IEC 60909-0. La Icc de barra se deriva de la
          fuente del tablero o del tablero que lo alimenta. I&quot;k máx: falla trifásica en el extremo del cable, c = 1,05,
          conductor a 20 °C. I&quot;k mín: falla fase-neutro en el extremo (bifásica si no hay neutro), c = 0,95, conductor a su
          temperatura máxima de servicio. Verificaciones: poder de corte Icu ≥ Icc máx de barra; disparo magnético
          Im ≤ I&quot;k mín, con Im en el extremo superior de la banda de la curva. La sección mínima térmica
          S = Ith·√t / k (t = 0,02 s y 0,2 s) es orientativa.</p>
        <p><b>Selectividad.</b>{' '}Entre la protección de cada circuito y la inmediata aguas arriba (interruptor general
          del tablero o protección del alimentador que llega a él). Entre protecciones con curva normalizada, el límite
          de selectividad es el extremo inferior de la banda de disparo magnético de la de aguas arriba
          (Is = mult. mín · In); es total si Is ≥ Icc máx de barra y parcial hasta Is en caso contrario. Criterio
          conservador, limitado a la zona de cortocircuito; en sobrecarga solo se exige In aguas arriba &gt; In aguas
          abajo. Donde se indica «fabricante», el límite es el de la tabla de selectividad del fabricante. No se evalúa
          la selectividad entre diferenciales.</p>

        {evaluado.tableros.map(({ tablero, icc, hallazgos, circuitos }, i) => {
          const observaciones = [
            ...hallazgos.map(h => ({ ...h, circuito: 'Tablero' })),
            ...circuitos.flatMap(e => e.hallazgos.map(h => ({ ...h, circuito: e.circuito.circuito }))),
          ]
          return (
            <div key={tablero.id} className="mem-tablero">
              <h2>{i + 3}. Tablero {tablero.tag}{tablero.nombre ? ` — ${tablero.nombre}` : ''}</h2>
              <div className="mem-datos">
                <span><b>Ubicación:</b> {tablero.ubicacion ?? '—'}</span>
                <span><b>Tensiones:</b> {[tablero.tension_tri, tablero.tension_bi, tablero.tension_mono].filter(v => v != null).join(' / ') || '—'} V</span>
                <span><b>Frecuencia:</b> {tablero.frecuencia ?? '—'} Hz</span>
                <span><b>Grado de protección:</b> {tablero.grado_proteccion ?? '—'}</span>
                <span><b>Icc máx de barra:</b> {n(icc.Icc_max_kA)} kA</span>
                <span><b>Icc mín de barra:</b> {n(icc.Icc_min_kA)} kA</span>
              </div>

              <h3>Cargas</h3>
              <table>
                <thead><tr>
                  <th className="izq">Circuito</th><th className="izq">Descripción</th><th>Tipo</th><th>Tensión</th><th>U (V)</th>
                  <th>Fase</th><th>P (kW)</th><th>cos φ</th><th>Ib (A)</th><th>L (m)</th><th className="izq">Conductores</th>
                </tr></thead>
                <tbody>{circuitos.map(e => (
                  <tr key={e.circuito.id}>
                    <td className="izq">{e.circuito.circuito}</td><td className="izq">{e.circuito.descripcion ?? '—'}</td>
                    <td>{e.circuito.tipo ?? '—'}</td><td>{e.carga.tipo ? TENSION[e.carga.tipo] ?? e.carga.tipo : '—'}</td>
                    <td>{n(e.carga.tension, 0)}</td><td>{e.circuito.fase ?? '—'}</td>
                    <td>{n(e.carga.potencia)}</td><td>{n(e.carga.fp)}</td><td>{n(e.carga.corriente, 1)}</td>
                    <td>{n(e.circuito.Largo, 0)}</td><td className="izq">{formacionDe(e)}</td>
                  </tr>
                ))}</tbody>
              </table>

              <h3>Corriente admisible y protección</h3>
              <table>
                <thead><tr>
                  <th className="izq">Circuito</th><th>Método</th><th>Iadm·n (A)</th><th>FH</th><th>FC</th><th>FT</th>
                  <th>Iz (A)</th><th>Ib (A)</th><th>Iz ≥ Ib</th><th className="izq">Protección</th><th>Ib ≤ In ≤ Iz</th>
                </tr></thead>
                <tbody>{circuitos.map(e => {
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
              {circuitos.some(e => e.ampacidad.iadmAviso) && (
                <p className="mem-nota">* El cable no tiene cargada la corriente admisible para ese método de instalación: se usó la genérica del catálogo.</p>
              )}

              <h3>Caída de tensión</h3>
              <table>
                <thead><tr>
                  <th className="izq">Circuito</th><th>Ib (A)</th><th>L (m)</th><th>Cond./fase</th><th>R (Ω/km)</th><th>X (Ω/km)</th>
                  <th>cos φ</th><th>e (V)</th><th>e (%)</th><th>≤ {LIMITE_CAIDA_PCT} %</th>
                </tr></thead>
                <tbody>{circuitos.map(e => (
                  <tr key={e.circuito.id}>
                    <td className="izq">{e.circuito.circuito}</td><td>{n(e.carga.corriente, 1)}</td><td>{n(e.caida.largoAuto, 0)}</td>
                    <td>{e.caida.cfAuto ?? '—'}</td><td>{n(e.caida.rAuto, 4)}</td><td>{n(e.caida.xAuto, 4)}</td><td>{n(e.carga.fp)}</td>
                    <td>{n(e.caida.ev)}</td><td>{n(e.caida.epct)}</td>
                    <td><Veredicto v={e.caida.epct == null ? null : e.caida.epct <= LIMITE_CAIDA_PCT} /></td>
                  </tr>
                ))}</tbody>
              </table>

              <h3>Cortocircuito</h3>
              <table>
                <thead><tr>
                  <th className="izq">Circuito</th><th>S (mm²)</th><th>I&quot;k máx (kA)</th><th>ip (kA)</th><th>I&quot;k mín (kA)</th><th>Falla mín.</th>
                  <th>Icu (kA)</th><th>Icu ≥ Icc barra</th><th>Im (A)</th><th>Im ≤ I&quot;k mín</th><th>S mín 0,02 s</th><th>S mín 0,2 s</th>
                </tr></thead>
                <tbody>{circuitos.map(e => {
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

              <h3>Selectividad</h3>
              <table>
                <thead><tr>
                  <th className="izq">Circuito</th><th className="izq">Protección</th><th className="izq">Aguas arriba</th>
                  <th>Is (A)</th><th>Origen</th><th>Icc máx barra (kA)</th><th>Resultado</th>
                </tr></thead>
                <tbody>{circuitos.map(e => {
                  const s = e.selectividad
                  return (
                    <tr key={e.circuito.id}>
                      <td className="izq">{e.circuito.circuito}</td>
                      <td className="izq">{e.circuito.proteccion ? proteccionLabel(e.circuito.proteccion) : '—'}</td>
                      <td className="izq">{s.aguasArriba ? `${s.aguasArriba.circuito}: ${proteccionLabel(s.aguasArriba.proteccion)}` : '—'}</td>
                      <td>{n(s.Is_A, 0)}</td>
                      <td>{s.origen === 'manual' ? 'Fabricante' : s.origen === 'calculado' ? 'Calculado' : '—'}</td>
                      <td>{n(icc.Icc_max_kA)}</td>
                      <td className={s.estado === 'no_selectiva' ? 'mem-mal' : s.estado === 'total' ? 'mem-bien' : undefined}>{SELECTIVIDAD_TXT[s.estado]}</td>
                    </tr>
                  )
                })}</tbody>
              </table>

              <h3>Observaciones</h3>
              {observaciones.length === 0 ? <p>Sin observaciones.</p> : (
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
