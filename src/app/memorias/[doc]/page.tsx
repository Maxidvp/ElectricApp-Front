'use client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Hoja, useMemoria, n } from '@/components/memoria/Hoja'
import {
  TituloTablero, DatosTablero, TablaCargas, TablaBalance, TablaAmpacidad, TablaCaida,
  TablaCortocircuito, TablaSelectividad, TablaObservaciones, formacionDe, METODO,
} from '@/components/memoria/tablas'
import { DOCUMENTOS, type DocumentoId } from '@/components/memoria/documentos'
import { LIMITE_CAIDA_PCT } from '@/utils/caida'
import { proteccionLabel } from '@/utils/protecciones'

// Un documento de /memorias. Todos leen el mismo evaluarProyecto (vía useMemoria):
// acá solo se elige qué tablas entran en cada uno.

type Datos = ReturnType<typeof useMemoria>

function CriterioCortocircuito() {
  return (
    <p><b>Cortocircuito.</b>{' '}Método de la fuente de tensión equivalente, IEC 60909-0. La Icc de barra se deriva de la
      fuente del tablero o del tablero que lo alimenta. I&quot;k máx: falla trifásica en el extremo del cable, c = 1,05,
      conductor a 20 °C. I&quot;k mín: falla fase-neutro en el extremo (bifásica si no hay neutro), c = 0,95, conductor a su
      temperatura máxima de servicio. Verificaciones: poder de corte Icu ≥ Icc máx de barra; disparo magnético
      Im ≤ I&quot;k mín, con Im en el extremo superior de la banda de la curva. La sección mínima térmica
      S = Ith·√t / k (t = 0,02 s y 0,2 s) es orientativa.</p>
  )
}

function CriterioSelectividad() {
  return (
    <p><b>Selectividad.</b>{' '}Entre la protección de cada circuito y la inmediata aguas arriba (interruptor general
      del tablero o protección del alimentador que llega a él). Entre protecciones con curva normalizada, el límite
      de selectividad es el extremo inferior de la banda de disparo magnético de la de aguas arriba
      (Is = mult. mín · In); es total si Is ≥ Icc máx de barra y parcial hasta Is en caso contrario. Criterio
      conservador, limitado a la zona de cortocircuito; en sobrecarga solo se exige In aguas arriba &gt; In aguas
      abajo. Donde se indica «fabricante», el límite es el de la tabla de selectividad del fabricante. No se evalúa
      la selectividad entre diferenciales.</p>
  )
}

function General({ evaluado, sitio, formato }: Datos) {
  const { resumen } = evaluado
  return (
    <>
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
      <CriterioCortocircuito />
      <CriterioSelectividad />

      {evaluado.tableros.map((t, i) => (
        <div key={t.tablero.id} className="mem-tablero">
          <TituloTablero t={t} numero={i + 3} />
          <DatosTablero t={t} />
          <h3>Cargas</h3><TablaCargas t={t} formato={formato} />
          <h3>Corriente admisible y protección</h3><TablaAmpacidad t={t} />
          <h3>Caída de tensión</h3><TablaCaida t={t} />
          <h3>Cortocircuito</h3><TablaCortocircuito t={t} />
          <h3>Selectividad</h3><TablaSelectividad t={t} />
          <h3>Observaciones</h3><TablaObservaciones t={t} />
        </div>
      ))}
    </>
  )
}

function Cargas({ evaluado, formato }: Datos) {
  return (
    <>
      <p className="mem-nota" style={{ marginTop: 10 }}>
        Potencias instaladas, sin factores de demanda ni de simultaneidad. La acometida suma los circuitos del tablero;
        un alimentador toma la demanda del tablero que alimenta.
      </p>
      {evaluado.tableros.map((t, i) => {
        // Potencia del tablero = suma de sus salidas (la acometida es esa misma suma).
        const salidas = t.circuitos.filter(e => !e.circuito.es_acometida)
        const total = salidas.reduce((acc, e) => acc + (e.carga.potencia ?? 0), 0)
        const sinPotencia = salidas.filter(e => e.carga.potencia == null).length
        return (
          <div key={t.tablero.id} className={i > 0 ? 'mem-tablero' : undefined}>
            <TituloTablero t={t} />
            <DatosTablero t={t} />
            <TablaCargas t={t} formato={formato} conProteccion />
            <p>
              <b>Potencia instalada del tablero:</b> {n(total)} kW en {salidas.length} salida(s)
              {sinPotencia > 0 && <span className="mem-mal"> — {sinPotencia} salida(s) sin potencia cargada, no incluidas</span>}
            </p>
            <h3>Balance de fases</h3>
            <TablaBalance t={t} />
          </div>
        )
      })}
    </>
  )
}

function Cortocircuito({ evaluado }: Datos) {
  return (
    <>
      <h2>Criterios</h2>
      <CriterioCortocircuito />
      <CriterioSelectividad />
      <h2>Corriente de cortocircuito en barras</h2>
      <table style={{ width: 'auto', minWidth: 480 }}>
        <thead><tr><th className="izq">Tablero</th><th>Un (V)</th><th>Icc máx (kA)</th><th>Icc mín (kA)</th></tr></thead>
        <tbody>{evaluado.tableros.map(({ tablero, icc }) => (
          <tr key={tablero.id}>
            <td className="izq">{tablero.tag}{tablero.nombre ? ` — ${tablero.nombre}` : ''}</td>
            <td>{tablero.tension_tri ?? tablero.tension_bi ?? tablero.tension_mono ?? '—'}</td>
            <td>{n(icc.Icc_max_kA)}</td><td>{n(icc.Icc_min_kA)}</td>
          </tr>
        ))}</tbody>
      </table>
      {evaluado.tableros.map(t => (
        <div key={t.tablero.id} className="mem-tablero">
          <TituloTablero t={t} />
          <DatosTablero t={t} />
          <h3>Cortocircuito por circuito</h3><TablaCortocircuito t={t} />
          <h3>Selectividad</h3><TablaSelectividad t={t} />
          <h3>Observaciones</h3><TablaObservaciones t={t} areas={['Cortocircuito', 'Selectividad']} />
        </div>
      ))}
    </>
  )
}

function Cables({ evaluado, formato }: Datos) {
  const tendidos = evaluado.tableros.flatMap(t => t.circuitos.map(e => ({ t, e })))
  // Resumen: metros de TENDIDO por formación (largo del circuito), no metros de cada
  // conductor — para el cómputo de conductores hay que multiplicar por la formación.
  const resumen = new Map<string, { cantidad: number; metros: number; sinLargo: number }>()
  for (const { e } of tendidos) {
    if (!e.circuito.formacion) continue
    const clave = formacionDe(e, formato)
    const r = resumen.get(clave) ?? { cantidad: 0, metros: 0, sinLargo: 0 }
    r.cantidad++
    if (e.circuito.Largo) r.metros += e.circuito.Largo; else r.sinLargo++
    resumen.set(clave, r)
  }
  const sinFormacion = tendidos.filter(({ e }) => !e.circuito.formacion).length

  return (
    <>
      <h2>Tendidos</h2>
      <table>
        <thead><tr>
          <th className="izq">Circuito</th><th className="izq">Desde</th><th className="izq">Hasta</th><th className="izq">Formación</th>
          <th>L (m)</th><th>Método de instalación</th><th className="izq">Protección en origen</th>
        </tr></thead>
        <tbody>{tendidos.map(({ t, e }) => {
          const c = e.circuito
          // La acometida llega al tablero; el resto sale de él.
          const destino = c.tablero_destino ? c.tablero_destino.tag : (c.descripcion ?? '—')
          return (
            <tr key={c.id}>
              <td className="izq">{c.circuito}</td>
              <td className="izq">{c.es_acometida ? (c.descripcion ?? 'Alimentación') : t.tablero.tag}</td>
              <td className="izq">{c.es_acometida ? t.tablero.tag : destino}</td>
              <td className="izq">{formacionDe(e, formato)}</td><td>{n(c.Largo, 0)}</td>
              <td>{METODO[c.metodo_instalacion ?? ''] ?? '—'}</td>
              <td className="izq">{c.proteccion ? proteccionLabel(c.proteccion) : '—'}</td>
            </tr>
          )
        })}</tbody>
      </table>
      {sinFormacion > 0 && <p className="mem-mal">{sinFormacion} circuito(s) sin cable asignado.</p>}

      <h2>Resumen por formación</h2>
      <table style={{ width: 'auto', minWidth: 520 }}>
        <thead><tr><th className="izq">Formación</th><th>Circuitos</th><th>Metros de tendido</th><th>Sin largo cargado</th></tr></thead>
        <tbody>
          {[...resumen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([clave, r]) => (
            <tr key={clave}>
              <td className="izq">{clave}</td><td>{r.cantidad}</td><td>{n(r.metros, 0)}</td>
              <td className={r.sinLargo ? 'mem-mal' : undefined}>{r.sinLargo || '—'}</td>
            </tr>
          ))}
          <tr className="mem-total">
            <td className="izq">Total</td><td>{[...resumen.values()].reduce((a, r) => a + r.cantidad, 0)}</td>
            <td>{n([...resumen.values()].reduce((a, r) => a + r.metros, 0), 0)}</td>
            <td>{[...resumen.values()].reduce((a, r) => a + r.sinLargo, 0) || '—'}</td>
          </tr>
        </tbody>
      </table>
      <p className="mem-nota">
        Metros de tendido = largo del circuito. Cada tendido lleva todos los conductores de su formación. Comprende los
        circuitos de los tableros de potencia; no incluye cables de instrumentación ni de datos.
      </p>
    </>
  )
}

const CONTENIDO: Record<DocumentoId, (d: Datos) => React.ReactNode> = {
  general: General, cargas: Cargas, cortocircuito: Cortocircuito, cables: Cables,
}

export default function DocumentoMemoria() {
  const { doc } = useParams<{ doc: string }>()
  const datos = useMemoria()
  const documento = DOCUMENTOS.find(d => d.id === doc)

  if (!documento) return (
    <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>
      Ese documento no existe. <Link href="/memorias" style={{ color: 'var(--clr-info-a10)' }}>Ver las memorias disponibles</Link>
    </p>
  )
  const Contenido = CONTENIDO[documento.id]
  return <Hoja titulo={documento.titulo}><Contenido {...datos} /></Hoja>
}
