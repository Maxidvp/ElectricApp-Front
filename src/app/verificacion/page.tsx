'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useProyectos } from '@/context/ProyectosContext'
import { evaluarProyecto, peorNivel, AREAS, type AreaHallazgo, type NivelHallazgo } from '@/utils/verificacionProyecto'
import { leerParametrosSitio, SITIO_DEFAULT } from '@/utils/parametrosSitio'

// Panel de verificación: todos los ✗ / datos faltantes / avisos del proyecto en una
// sola vista. No calcula nada propio — evaluarProyecto corre las mismas funciones
// que las páginas de Cargas, Ampacidad, Caídas y Cortocircuitos.

const NIVEL: Record<NivelHallazgo | 'ok', { simbolo: string; color: string; etiqueta: string }> = {
  ok:    { simbolo: '✓', color: '#6aab6a',                  etiqueta: 'Cumple' },
  error: { simbolo: '✗', color: 'var(--clr-danger-a10)',    etiqueta: 'No cumple' },
  falta: { simbolo: '?', color: '#d4a24a',                  etiqueta: 'Faltan datos' },
  aviso: { simbolo: '⚠', color: 'var(--clr-warning-a10)',   etiqueta: 'Con salvedad' },
}

// Página donde se corrige cada área.
const RUTA_AREA: Record<AreaHallazgo, string> = {
  'Datos': '/cargas', 'Ampacidad': '/ampacidad', 'Protección': '/ampacidad',
  'Caída': '/caidas', 'Cortocircuito': '/cortocircuitos', 'Selectividad': '/cortocircuitos',
}

function Chip({ n, nivel, texto }: { n: number; nivel: NivelHallazgo | 'ok'; texto: string }) {
  const { simbolo, color } = NIVEL[nivel]
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-surface-tonal-a20 px-3 py-1 text-[12px] text-font-a20">
      <b style={{ color }}>{simbolo} {n}</b> {texto}
    </span>
  )
}

export default function Verificacion() {
  const { tableros, segmentos, proyectoActivo, seleccionarTablero } = useProyectos()
  const [sitio] = useState(() => typeof window === 'undefined' ? SITIO_DEFAULT : leerParametrosSitio())
  const [soloObservados, setSoloObservados] = useState(true)

  const evaluado = useMemo(() => evaluarProyecto(tableros, segmentos, sitio), [tableros, segmentos, sitio])
  const { resumen } = evaluado

  if (!proyectoActivo) return <p style={{ padding: 24, color: 'var(--clr-surface-tonal-a40)' }}>Sin proyecto activo.</p>

  return (
    <div className="subcontainer px-4 py-4 flex flex-col gap-4 min-h-dvh">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[16px] font-semibold text-font-a0 m-0">Verificación del proyecto</h1>
          <p className="text-[12px] text-surface-tonal-a40 mt-0.5">
            {proyectoActivo.nombre} · tableros de potencia · altitud {sitio.altitud} m.s.n.m. · ambiente{' '}
            {sitio.tempAmbiente ?? '—'} °C <span className="opacity-70">(se cambian en Ampacidad)</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip n={resumen.circuitosOk} nivel="ok" texto={`de ${resumen.circuitos} circuitos sin observaciones`} />
          <Chip n={resumen.error} nivel="error" texto="no cumplen" />
          <Chip n={resumen.falta} nivel="falta" texto="datos faltantes" />
          <Chip n={resumen.aviso} nivel="aviso" texto="salvedades" />
          <Link href="/memoria" className="rounded-md border border-surface-tonal-a30 px-3 py-1 text-[12px] text-font-a0 no-underline hover:bg-surface-tonal-a10">
            Memoria de cálculo →
          </Link>
        </div>
      </div>

      <label className="flex items-center gap-2 text-[12px] text-font-a20 cursor-pointer w-fit">
        <input type="checkbox" checked={soloObservados} onChange={e => setSoloObservados(e.target.checked)} />
        Mostrar solo circuitos con observaciones
      </label>

      {evaluado.tableros.length === 0 && (
        <p className="text-[13px] text-surface-tonal-a40">El proyecto no tiene tableros de potencia.</p>
      )}

      {evaluado.tableros.map(({ tablero, icc, hallazgos, circuitos }) => {
        const visibles = soloObservados ? circuitos.filter(e => e.hallazgos.length > 0) : circuitos
        return (
          <div key={tablero.id} className="datatable-container">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[var(--dt-border-color)] flex-wrap">
              <span className="text-[14px] font-semibold text-font-a0">{tablero.tag}</span>
              {tablero.nombre && <span className="text-[13px] text-surface-tonal-a40">{tablero.nombre}</span>}
              <span className="text-[12px] text-surface-tonal-a40">
                Icc máx = {icc.Icc_max_kA != null ? `${icc.Icc_max_kA.toFixed(2)} kA` : '—'} · Icc mín ={' '}
                {icc.Icc_min_kA != null ? `${icc.Icc_min_kA.toFixed(2)} kA` : '—'}
              </span>
              <span className="ml-auto text-[11px] text-surface-tonal-a40">
                {circuitos.length - circuitos.filter(e => e.hallazgos.length > 0).length} de {circuitos.length} sin observaciones
              </span>
            </div>

            {hallazgos.length > 0 && (
              <ul className="px-3.5 py-2 border-b border-[var(--dt-border-color)] text-[12px] space-y-0.5">
                {hallazgos.map(h => (
                  <li key={h.mensaje} style={{ color: NIVEL[h.nivel].color }}>{NIVEL[h.nivel].simbolo} {h.mensaje}</li>
                ))}
              </ul>
            )}

            {visibles.length === 0 ? (
              <p className="px-3.5 py-3 text-[12px] text-surface-tonal-a40">
                {circuitos.length === 0 ? 'Sin circuitos.' : 'Todos los circuitos cumplen, sin observaciones.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="datatable" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', width: 150 }}>Circuito</th>
                      <th style={{ width: 80 }}>Ib (A)</th>
                      {AREAS.map(a => <th key={a} style={{ width: 95 }}>{a}</th>)}
                      <th style={{ textAlign: 'left' }}>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map(e => (
                      <tr key={e.circuito.id}>
                        <td style={{ fontSize: 12, fontWeight: 500, textAlign: 'left', padding: '6px 10px' }}>
                          {e.circuito.circuito}
                          {e.circuito.descripcion && <span className="block text-[11px] font-normal text-surface-tonal-a40">{e.circuito.descripcion}</span>}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--clr-font-a20)' }}>
                          {e.carga.corriente != null ? e.carga.corriente.toFixed(1) : '—'}
                        </td>
                        {AREAS.map(area => {
                          const { simbolo, color, etiqueta } = NIVEL[peorNivel(e.hallazgos, area) ?? 'ok']
                          return (
                            <td key={area} style={{ textAlign: 'center' }}>
                              <Link
                                href={RUTA_AREA[area]} title={`${etiqueta} — abrir ${RUTA_AREA[area]}`}
                                onClick={() => seleccionarTablero(tablero.id)}
                                style={{ color, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                              >
                                {simbolo}
                              </Link>
                            </td>
                          )
                        })}
                        <td style={{ fontSize: 12, padding: '6px 10px', textAlign: 'left' }}>
                          {e.hallazgos.length === 0
                            ? <span className="text-surface-tonal-a40">—</span>
                            : e.hallazgos.map(h => (
                              <div key={h.area + h.mensaje} style={{ lineHeight: 1.5 }}>
                                <span style={{ color: NIVEL[h.nivel].color, fontWeight: 700 }}>{NIVEL[h.nivel].simbolo}</span>{' '}
                                <span className="text-surface-tonal-a40">{h.area}:</span>{' '}
                                <span className="text-font-a20">{h.mensaje}</span>
                              </div>
                            ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      <p className="text-[11px] text-surface-tonal-a40 leading-relaxed">
        <b style={{ color: NIVEL.error.color }}>✗</b> una verificación no cumple ·{' '}
        <b style={{ color: NIVEL.falta.color }}>?</b> no se pudo verificar porque falta un dato (no equivale a cumplir) ·{' '}
        <b style={{ color: NIVEL.aviso.color }}>⚠</b> el resultado tiene una salvedad ·{' '}
        <b style={{ color: NIVEL.ok.color }}>✓</b> sin observaciones. Cada símbolo abre la página donde se corrige. La caída
        de tensión se evalúa con los datos guardados del circuito (sin los ajustes temporales de la página Caídas).
      </p>
    </div>
  )
}
