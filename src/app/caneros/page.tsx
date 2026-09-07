'use client'
import { useEffect, useState } from 'react'
import { useToast } from '@/context/ToastContext'
import { useProyectos } from '@/context/ProyectosContext'
import CircuitosPanel from '@/components/CircuitosPanel'
import { calcOcupacionCanio, colorOcupacion, tapadaSugerida, ESPACIAMIENTOS_TIPICOS_M, RECUBRIMIENTO_HORMIGON_M } from '@/utils/electricidad'
import * as canierosApi from '@/services/canieros'
import type { Caniero, CanioDeCaniero } from '@/services/canieros'
import type { Canio } from '@/services/ruteo'

// ── Barra de ocupación ──────────────────────────────────────────────

function OcupacionBar({ pct }: { pct: number }) {
  const color = colorOcupacion(pct, 'canio')
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-surface-tonal-a20 overflow-hidden shrink-0">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span style={{ color, minWidth: 40, textAlign: 'right' }} className="text-[11px]">{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Diagrama de corte transversal ────────────────────────────────────

type ItemLayout = { item: CanioDeCaniero; cxMM: number; cyMM: number; canoR: number; camisaR: number | null; pct: number }
type RowItemInfo = { item: CanioDeCaniero; localXMM: number; canoR: number; camisaR: number | null }
type RowLayout = { widthMM: number; maxRadiusUp: number; maxRadiusDown: number; items: RowItemInfo[] }

function DiagramaCaniero({ caniero, getF }: { caniero: Caniero; getF: (id: number) => any }) {
  const espH = (caniero.espaciamiento_horizontal ?? 0.25) * 1000
  const espV = (caniero.espaciamiento_vertical ?? 0.25) * 1000
  const tapada = (caniero.tapada ?? 0.5) * 1000
  const recubrimiento = (caniero.recubrimiento ?? RECUBRIMIENTO_HORMIGON_M) * 1000

  const filaValuesReales = [...new Set(caniero.canios.map(c => c.fila))].sort((a, b) => a - b)

  if (filaValuesReales.length === 0) {
    return <div className="text-[13px] text-surface-tonal-a40 text-center py-10">Agregá caños para ver el diagrama.</div>
  }

  // Cada fila se arma de forma independiente (lista libre) y luego se centra
  // horizontalmente respecto de la fila más ancha — no hay columnas
  // compartidas entre filas, cada una se acomoda según su propio contenido.
  // El espaciamiento configurado es espacio libre entre paredes (no distancia
  // entre centros). Un caño camisa no es un ítem propio: es una funda más
  // grande alrededor de su caño principal, dibujada tocando su punto inferior
  // (no concéntrica) — por eso el radio "hacia arriba" de un caño con camisa
  // es mayor que el radio "hacia abajo", y eso es lo que empuja a sus vecinos
  // (horizontal y verticalmente) para mantener el espacio libre configurado.
  const rows: RowLayout[] = filaValuesReales.map(filaReal => {
    const rowCanios = caniero.canios.filter(c => c.fila === filaReal).sort((a, b) => a.orden - b.orden)
    const infos = rowCanios.map(c => {
      const canoR = (c.canio.diametro_interno ?? 20) / 2
      const camisaR = c.camisa_canio?.diametro_interno ? c.camisa_canio.diametro_interno / 2 : null
      return { canoR, camisaR, radiusHoriz: camisaR ?? canoR }
    })
    const localX: number[] = [infos[0]?.radiusHoriz ?? 10]
    for (let k = 1; k < infos.length; k++) localX.push(localX[k - 1] + infos[k - 1].radiusHoriz + infos[k].radiusHoriz + espH)
    const widthMM = infos.length ? localX[localX.length - 1] + infos[infos.length - 1].radiusHoriz : 20
    return {
      widthMM,
      maxRadiusUp: infos.length ? Math.max(...infos.map(i => i.camisaR != null ? 2 * i.camisaR - i.canoR : i.canoR)) : 10,
      maxRadiusDown: infos.length ? Math.max(...infos.map(i => i.canoR)) : 10,
      items: rowCanios.map((c, k) => ({ item: c, localXMM: localX[k], canoR: infos[k].canoR, camisaR: infos[k].camisaR })),
    }
  })

  const filas = rows.length
  const contentW = Math.max(...rows.map(r => r.widthMM))

  const rowOffsetMM = [0]
  for (let f = 1; f < filas; f++) rowOffsetMM.push(rowOffsetMM[f - 1] + rows[f - 1].maxRadiusDown + rows[f].maxRadiusUp + espV)

  const items: ItemLayout[] = rows.flatMap((row, f) => {
    const centerOffsetMM = (contentW - row.widthMM) / 2
    return row.items.map(({ item: c, localXMM, canoR, camisaR }) => {
      const { pct } = c.canio.diametro_interno
        ? calcOcupacionCanio(c.canio.diametro_interno, c.circuitos, getF)
        : { pct: 0 }
      return { item: c, cxMM: centerOffsetMM + localXMM, cyMM: rowOffsetMM[f], canoR, camisaR, pct }
    })
  })

  // Escala única: se ajusta tanto al ancho de la grilla como a la tapada real,
  // así que se dibuja a proporción real en vez de con un quiebre — con las
  // distancias típicas (caños en mm, tapada en cm/m) el resultado queda
  // razonable sin necesitar trucos de escala.
  const targetW = 420, targetH = 480
  const totalHmm = tapada + rows[0].maxRadiusUp + rowOffsetMM[filas - 1] + rows[filas - 1].maxRadiusDown
  const scale = Math.min(targetW / contentW, targetH / totalHmm)

  const recubPx = caniero.hormigonado ? recubrimiento * scale : 0
  const marginL = 60 + recubPx, marginR = 30 + recubPx, marginT = 22, marginB = 24 + recubPx + (caniero.hormigonado ? 16 : 0)

  const svgW = marginL + contentW * scale + marginR
  const svgH = marginT + totalHmm * scale + marginB

  const px = (cxMM: number) => marginL + cxMM * scale
  // La tapada se mide desde el suelo hasta la parte más alta del caño (no
  // hasta su centro): el centro de la primera fila queda un radio más abajo.
  const py = (cyMM: number) => marginT + (tapada + rows[0].maxRadiusUp + cyMM) * scale
  const groundY = marginT
  const topFirstRowY = py(0) - rows[0].maxRadiusUp * scale

  const dimTextCx = 'text-[10px] fill-[var(--clr-font-a20)]'

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', maxWidth: svgW, display: 'block' }}>
      {/* Suelo */}
      <line x1={0} y1={groundY} x2={svgW} y2={groundY} stroke="var(--clr-surface-tonal-a30)" strokeDasharray="4 3" />
      <text x={marginL} y={groundY - 6} className={dimTextCx}>▽ Nivel de suelo</text>

      {/* Cota de tapada (a escala real, hasta la parte más alta del caño) */}
      <g>
        <line x1={marginL - 20} y1={groundY} x2={marginL - 20} y2={topFirstRowY} stroke="var(--clr-surface-tonal-a40)" />
        <line x1={marginL - 26} y1={groundY} x2={marginL - 14} y2={groundY} stroke="var(--clr-surface-tonal-a40)" />
        <line x1={marginL - 26} y1={topFirstRowY} x2={marginL - 14} y2={topFirstRowY} stroke="var(--clr-surface-tonal-a40)" />
        <text x={marginL - 26} y={(groundY + topFirstRowY) / 2} textAnchor="end" dominantBaseline="middle" className={dimTextCx}>
          {(tapada / 1000).toFixed(2)} m
        </text>
      </g>

      {/* Cota de espaciamiento horizontal (primer par de la fila más ancha) — se mide
          entre los extremos más próximos de los dos caños (no entre centros),
          igual que el propio espaciamiento configurado. */}
      {rows[0].items.length > 1 && (() => {
        const a = rows[0].items[0], b = rows[0].items[1]
        const radiusA = a.camisaR ?? a.canoR
        const radiusB = b.camisaR ?? b.canoR
        const offsetMM = (contentW - rows[0].widthMM) / 2
        const x1 = px(offsetMM + a.localXMM + radiusA), x2 = px(offsetMM + b.localXMM - radiusB)
        const y = topFirstRowY - 12
        return (
          <g>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke="var(--clr-surface-tonal-a40)" />
            <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke="var(--clr-surface-tonal-a40)" />
            <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke="var(--clr-surface-tonal-a40)" />
            <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className={dimTextCx}>{(espH / 1000).toFixed(3)} m</text>
          </g>
        )
      })()}

      {/* Cota de espaciamiento vertical (fila 0→1, alineada a la izquierda del contenido) —
          igual que la horizontal, se mide entre los extremos más próximos de las dos
          filas (no entre centros). */}
      {filas > 1 && (() => {
        const yTop = py(0) + rows[0].maxRadiusDown * scale
        const yBottom = py(rowOffsetMM[1]) - rows[1].maxRadiusUp * scale
        return (
        <g>
          <line x1={marginL - 20} y1={yTop} x2={marginL - 20} y2={yBottom} stroke="var(--clr-surface-tonal-a40)" />
          <text x={marginL - 26} y={(yTop + yBottom) / 2} textAnchor="end" dominantBaseline="middle" className={dimTextCx}>
            {(espV / 1000).toFixed(3)} m
          </text>
        </g>
        )
      })()}

      {/* Bloque de hormigón */}
      {caniero.hormigonado && (() => {
        const left   = px(0) - recubPx
        const right  = px(contentW) + recubPx
        const top    = topFirstRowY - recubPx
        const bottom = py(rowOffsetMM[filas - 1]) + rows[filas - 1].maxRadiusDown * scale + recubPx
        const blockW = (right - left) / scale / 1000
        const blockH = (bottom - top) / scale / 1000
        return (
          <g>
            <rect x={left} y={top} width={right - left} height={bottom - top} rx={4}
              fill="none" stroke="var(--clr-warning-a10)" strokeDasharray="6 3" strokeWidth={1.3} />
            <text x={left} y={bottom + 14} className="text-[10px] fill-[var(--clr-warning-a10)]">
              Bloque de hormigón: {blockW.toFixed(2)} × {blockH.toFixed(2)} m (recub. {(recubrimiento / 1000).toFixed(3)} m)
            </text>
          </g>
        )
      })()}

      {/* Caños (+ camisa opcional, tocando el punto inferior del caño principal) */}
      {items.map(it => {
        const cx = px(it.cxMM), cy = py(it.cyMM)
        const r  = Math.max(it.canoR * scale, 3)
        const color = colorOcupacion(it.pct, 'canio')
        // Caños chicos: el porcentaje no entra legible adentro, se ubica afuera.
        const textAdentro = r >= 13
        const camisaCy = it.camisaR != null ? cy - (it.camisaR - it.canoR) * scale : null
        const camisaRpx = it.camisaR != null ? it.camisaR * scale : null
        return (
          <g key={it.item.id}>
            {camisaCy != null && camisaRpx != null && (
              <>
                <circle cx={cx} cy={camisaCy} r={camisaRpx} fill="none" stroke="var(--clr-warning-a10)" strokeDasharray="4 2" strokeWidth={1.5} />
                <text x={cx} y={camisaCy - camisaRpx - 4} textAnchor="middle" className="text-[8px] fill-[var(--clr-warning-a10)] font-medium select-none">
                  camisa
                </text>
              </>
            )}
            <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1.5} />
            <text x={cx} y={textAdentro ? cy + 3 : cy + r + 11} textAnchor="middle"
              className={`text-[9px] font-medium select-none ${textAdentro ? 'fill-[var(--clr-font-a0)]' : 'fill-[var(--clr-font-a20)]'}`}>
              {it.pct.toFixed(0)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Modal: crear caniero ───────────────────────────────────────────────

function CrearCanieroModal({ onCrear, onClose }: {
  onCrear: (data: { nombre: string; tapada: number; espaciamiento_horizontal: number; espaciamiento_vertical: number; hormigonado: boolean; recubrimiento: number }) => Promise<void>
  onClose: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [nivel, setNivel] = useState<'BT' | 'MT'>('BT')
  const [tapada, setTapada] = useState(String(tapadaSugerida('BT')))
  const [espH, setEspH] = useState(String(ESPACIAMIENTOS_TIPICOS_M[1]))
  const [espV, setEspV] = useState(String(ESPACIAMIENTOS_TIPICOS_M[1]))
  const [hormigonado, setHormigonado] = useState(false)
  const [recubrimiento, setRecubrimiento] = useState(String(RECUBRIMIENTO_HORMIGON_M))
  const [creando, setCreando] = useState(false)

  const fieldLabel  = 'text-[11px] font-medium text-font-a20 uppercase tracking-[0.04em]'
  const fieldInput  = 'px-[10px] py-1.5 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] outline-none focus:border-primary-a20 w-full'

  const handleSubmit = async () => {
    if (!nombre.trim() || creando) return
    setCreando(true)
    try {
      await onCrear({
        nombre: nombre.trim(),
        tapada: parseFloat(tapada) || 0,
        espaciamiento_horizontal: parseFloat(espH) || 0,
        espaciamiento_vertical: parseFloat(espV) || 0,
        hormigonado,
        recubrimiento: hormigonado ? (parseFloat(recubrimiento) || 0) : 0,
      })
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-100" onClick={onClose}>
      <div className="bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[10px] px-6 py-5 min-w-90 flex flex-col gap-3.5" onClick={e => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-font-a0">Nuevo caniero</div>

        <div className="flex flex-col gap-1.25">
          <label className={fieldLabel}>Nombre</label>
          <input className={fieldInput} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="ej: Caniero alimentador TGBT" autoFocus />
        </div>

        <div className="flex flex-col gap-1.25">
          <label className={fieldLabel}>Nivel de tensión (sugiere tapada)</label>
          <div className="flex gap-1.5">
            {(['BT', 'MT'] as const).map(n => (
              <button key={n} type="button"
                onClick={() => { setNivel(n); setTapada(String(tapadaSugerida(n))) }}
                className={`flex-1 py-1.5 rounded-md text-[12px] font-medium border cursor-pointer transition-colors ${
                  nivel === n ? 'bg-info-a0 border-info-a0 text-font-a0' : 'bg-transparent border-surface-tonal-a30 text-font-a20 hover:bg-surface-tonal-a10'
                }`}
              >{n}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.25">
          <label className={fieldLabel}>Tapada — hasta la parte más alta del caño (m)</label>
          <input className={fieldInput} type="number" step="0.05" min="0" value={tapada} onChange={e => setTapada(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.25">
          <label className={fieldLabel}>Espaciamiento horizontal — espacio libre entre paredes (m)</label>
          <input className={fieldInput} type="number" step="0.005" min="0" value={espH} onChange={e => setEspH(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.25">
          <label className={fieldLabel}>Espaciamiento vertical — espacio libre entre paredes (m)</label>
          <input className={fieldInput} type="number" step="0.005" min="0" value={espV} onChange={e => setEspV(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.25">
          <label className={fieldLabel}>Instalación</label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setHormigonado(false)}
              className={`flex-1 py-1.5 rounded-md text-[12px] font-medium border cursor-pointer transition-colors ${
                !hormigonado ? 'bg-info-a0 border-info-a0 text-font-a0' : 'bg-transparent border-surface-tonal-a30 text-font-a20 hover:bg-surface-tonal-a10'
              }`}
            >Enterrado directo</button>
            <button type="button" onClick={() => setHormigonado(true)}
              className={`flex-1 py-1.5 rounded-md text-[12px] font-medium border cursor-pointer transition-colors ${
                hormigonado ? 'bg-info-a0 border-info-a0 text-font-a0' : 'bg-transparent border-surface-tonal-a30 text-font-a20 hover:bg-surface-tonal-a10'
              }`}
            >Hormigonado</button>
          </div>
        </div>

        {hormigonado && (
          <div className="flex flex-col gap-1.25">
            <label className={fieldLabel}>Recubrimiento mínimo de hormigón (m)</label>
            <input className={fieldInput} type="number" step="0.005" min="0" value={recubrimiento} onChange={e => setRecubrimiento(e.target.value)} />
          </div>
        )}

        <p className="text-[11px] text-surface-tonal-a40 -mt-1">
          Los caños se agregan después, fila por fila, con total libertad — no hace falta definir la cantidad de columnas de antemano.
        </p>

        <div className="flex justify-end gap-2 mt-1">
          <button className="px-4 py-1.75 rounded-md border border-surface-tonal-a30 bg-transparent text-font-a20 text-[13px] cursor-pointer hover:bg-surface-tonal-a10 disabled:opacity-50 disabled:cursor-default" onClick={onClose} disabled={creando}>Cancelar</button>
          <button className="px-4.5 py-1.75 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[13px] cursor-pointer transition-colors hover:bg-primary-a10 disabled:opacity-50 disabled:cursor-default" onClick={handleSubmit} disabled={!nombre.trim() || creando}>
            {creando ? 'Creando...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tabla de una fila ───────────────────────────────────────────────

const inlineSelect = 'px-1.5 py-[3px] bg-surface-tonal-a10 border border-info-a10 rounded-[5px] text-font-a0 text-xs cursor-pointer w-full outline-none focus:border-primary-a20 text-center'

function FilaCanios({
  fila, canios, catalogo, selectedCanioId, onSelect,
  onAgregar, agregando, onEliminarCanio, eliminandoCanioId,
  onCambiarCanio, onCambiarCamisa, onQuitarCircuito,
  onEliminarFila, eliminandoFila, getF,
}: {
  fila: number
  canios: CanioDeCaniero[]
  catalogo: Canio[]
  selectedCanioId: number | null
  onSelect: (id: number | null) => void
  onAgregar: (fila: number, canioId: number) => void
  agregando: boolean
  onEliminarCanio: (id: number) => void
  eliminandoCanioId: number | null
  onCambiarCanio: (id: number, canioId: number) => void
  onCambiarCamisa: (id: number, camisaCanioId: number | null) => void
  onQuitarCircuito: (canioDeCanieroId: number, circId: number) => void
  onEliminarFila: (fila: number) => void
  eliminandoFila: boolean
  getF: (id: number) => any
}) {
  const [nuevoCanioId, setNuevoCanioId] = useState<number | ''>('')

  const handleAgregar = () => {
    if (nuevoCanioId === '') return
    onAgregar(fila, Number(nuevoCanioId))
    setNuevoCanioId('')
  }

  return (
    <div className="border border-surface-tonal-a20 rounded-[10px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20">
        <span className="text-[12px] font-medium text-font-a20">Fila {fila + 1}</span>
        <button
          onClick={() => onEliminarFila(fila)}
          disabled={eliminandoFila}
          className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-[11px] hover:text-danger-a10 disabled:opacity-40 disabled:cursor-default"
        >{eliminandoFila ? 'Eliminando...' : 'Eliminar fila'}</button>
      </div>

      <div className="datatable-container" style={{ maxWidth: '100%', minWidth: 0 }}>
        <table className="datatable">
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th>Caño</th>
              <th style={{ width: 130 }}>Camisa</th>
              <th>Circuitos</th>
              <th>Ocupado / Total</th>
              <th>Ocupación</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {canios.map(c => {
              const isSelected = c.id === selectedCanioId
              const calc = c.canio.diametro_interno
                ? calcOcupacionCanio(c.canio.diametro_interno, c.circuitos, getF) : null
              return (
                <tr
                  key={c.id}
                  className="cursor-pointer"
                  style={isSelected ? { background: 'rgba(33, 73, 138, 0.35)', outline: '1px solid var(--clr-info-a10)' } : undefined}
                  onClick={() => onSelect(isSelected ? null : c.id)}
                >
                  <td className="text-[11px] text-surface-tonal-a40 font-mono text-center select-none">C{c.orden + 1}</td>
                  <td onClick={isSelected ? e => e.stopPropagation() : undefined}>
                    {isSelected ? (
                      <select className={inlineSelect} value={c.canio_id} onChange={e => onCambiarCanio(c.id, Number(e.target.value))}>
                        {catalogo.map(cc => <option key={cc.id} value={cc.id}>{cc.nombre}</option>)}
                      </select>
                    ) : c.canio.nombre}
                  </td>
                  <td onClick={isSelected ? e => e.stopPropagation() : undefined}>
                    {isSelected ? (
                      <select className={inlineSelect} value={c.camisa_canio_id ?? ''} onChange={e => onCambiarCamisa(c.id, e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— Sin camisa —</option>
                        {catalogo.map(cc => <option key={cc.id} value={cc.id}>{cc.nombre}</option>)}
                      </select>
                    ) : c.camisa_canio ? (
                      <span className="inline-block px-1.75 py-0.5 rounded-sm bg-[rgba(230,180,60,0.15)] text-warning-a10 text-[10px] font-medium border border-[rgba(230,180,60,0.3)]">{c.camisa_canio.nombre}</span>
                    ) : (
                      <span className="text-surface-tonal-a40 text-xs">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-center gap-1">
                      {c.circuitos.length === 0
                        ? <span className="text-surface-tonal-a40 text-xs">—</span>
                        : c.circuitos.map(circ => (
                            <span key={circ.id} className="inline-flex items-center gap-0.75 px-1.75 py-0.5 rounded-sm bg-surface-tonal-a10 text-[11px] text-font-a10 border border-surface-tonal-a20">
                              {circ.circuito}
                              {isSelected && (
                                <button
                                  className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-[13px] leading-none px-px hover:text-danger-a10"
                                  onClick={e => { e.stopPropagation(); onQuitarCircuito(c.id, circ.id) }}
                                  title="Quitar"
                                >×</button>
                              )}
                            </span>
                          ))
                      }
                    </div>
                  </td>
                  <td>
                    {calc ? `${calc.areaOcupada.toFixed(1)} / ${calc.areaTotal.toFixed(1)} mm²` : <span className="text-surface-tonal-a40 text-xs">—</span>}
                  </td>
                  <td>{calc ? <OcupacionBar pct={calc.pct} /> : <span className="text-surface-tonal-a40 text-xs">—</span>}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-[15px] leading-none hover:text-danger-a10 disabled:opacity-40 disabled:cursor-default"
                      onClick={() => onEliminarCanio(c.id)}
                      disabled={eliminandoCanioId === c.id}
                      title={eliminandoCanioId === c.id ? 'Eliminando...' : 'Eliminar caño'}
                    >{eliminandoCanioId === c.id ? '…' : '×'}</button>
                  </td>
                </tr>
              )
            })}
            {canios.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center p-5 text-surface-tonal-a40 text-[13px]">
                  Fila vacía. Agregá un caño abajo.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center gap-2 py-3 px-3">
          <select className={inlineSelect} style={{ width: 220 }} value={nuevoCanioId} onChange={e => setNuevoCanioId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Elegí un caño del catálogo —</option>
            {catalogo.map(c => <option key={c.id} value={c.id}>{c.nombre} — Ø{c.diametro_nominal ?? c.diametro_interno}</option>)}
          </select>
          <button
            onClick={handleAgregar}
            disabled={nuevoCanioId === '' || agregando}
            className="px-3.5 py-1.25 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[12px] cursor-pointer transition-colors hover:bg-primary-a10 disabled:opacity-40 disabled:cursor-default"
          >{agregando ? 'Agregando...' : '+ Agregar caño'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Página ──────────────────────────────────────────────────────────

export default function CanerosPage() {
  const { showError } = useToast()
  // canieros/setCanieros viven en ProyectosContext (cargados junto con el resto del
  // proyecto) — ya no hace falta un fetch propio al entrar a la ruta.
  const { proyectoActivo, tableros, getCircuito, canios, canieros, setCanieros } = useProyectos()

  const [selectedCanieroId, setSelectedCanieroId] = useState<number | null>(null)
  const [selectedCanioId, setSelectedCanioId] = useState<number | null>(null)
  const [showAddCaniero, setShowAddCaniero] = useState(false)
  const [eliminandoCaniero, setEliminandoCaniero] = useState(false)
  const [agregandoEnFila, setAgregandoEnFila] = useState<number | null>(null)
  const [eliminandoCanioId, setEliminandoCanioId] = useState<number | null>(null)
  const [eliminandoFila, setEliminandoFila] = useState<number | null>(null)
  const [filasExtra, setFilasExtra] = useState<number[]>([])

  // Selecciona un caniero por defecto cada vez que cambia el proyecto activo (los
  // datos ya están disponibles en el contexto — no hace falta pedirlos de nuevo).
  useEffect(() => {
    setSelectedCanieroId(prev => (prev && canieros.some(c => c.id === prev)) ? prev : (canieros[0]?.id ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoActivo?.id])

  // Al entrar a un caniero sin filas todavía (recién creado, o vacío) se
  // arranca directamente con la Fila 1 lista para cargar caños.
  useEffect(() => {
    const c = canieros.find(c => c.id === selectedCanieroId) ?? null
    setFilasExtra(c && c.canios.length === 0 ? [0] : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCanieroId])

  const caniero = canieros.find(c => c.id === selectedCanieroId) ?? null
  const getF = (id: number) => getCircuito(id)?.formacion

  const filasReales = caniero ? [...new Set(caniero.canios.map(c => c.fila))] : []
  const filas = [...new Set([...filasReales, ...filasExtra])].sort((a, b) => a - b)

  const refrescarCaniero = async (id: number) => {
    const fresh = await canierosApi.getCaniero(id)
    setCanieros(prev => prev.map(c => c.id === id ? fresh : c))
  }

  const handleCrearCaniero = async (data: { nombre: string; tapada: number; espaciamiento_horizontal: number; espaciamiento_vertical: number; hormigonado: boolean; recubrimiento: number }) => {
    if (!proyectoActivo) return
    const nuevo = await canierosApi.createCaniero({ ...data, proyecto_id: proyectoActivo.id })
    setCanieros(prev => [...prev, nuevo])
    setSelectedCanieroId(nuevo.id)
    setShowAddCaniero(false)
  }

  const handleEliminarCaniero = async (id: number) => {
    setEliminandoCaniero(true)
    try {
      await canierosApi.deleteCaniero(id)
      setCanieros(prev => prev.filter(c => c.id !== id))
      if (selectedCanieroId === id) setSelectedCanieroId(null)
    } finally {
      setEliminandoCaniero(false)
    }
  }

  const handlePatchCaniero = async (id: number, patch: Partial<{ nombre: string; tapada: number; espaciamiento_horizontal: number; espaciamiento_vertical: number; hormigonado: boolean; recubrimiento: number }>) => {
    const updated = await canierosApi.updateCaniero(id, patch)
    setCanieros(prev => prev.map(c => c.id === id ? updated : c))
  }

  const handleAgregarFila = () => {
    const next = filas.length ? Math.max(...filas) + 1 : 0
    setFilasExtra(prev => [...prev, next])
  }

  const handleAgregarCanio = async (fila: number, canioId: number) => {
    if (!caniero) return
    setAgregandoEnFila(fila)
    try {
      await canierosApi.addCanioDeCaniero(caniero.id, canioId, fila)
      await refrescarCaniero(caniero.id)
      setFilasExtra(prev => prev.filter(f => f !== fila))
    } finally {
      setAgregandoEnFila(null)
    }
  }

  const handleEliminarCanio = async (canioDeCanieroId: number) => {
    if (!caniero) return
    setEliminandoCanioId(canioDeCanieroId)
    try {
      await canierosApi.deleteCanioDeCaniero(canioDeCanieroId)
      await refrescarCaniero(caniero.id)
      if (selectedCanioId === canioDeCanieroId) setSelectedCanioId(null)
    } finally {
      setEliminandoCanioId(null)
    }
  }

  const handleEliminarFila = async (fila: number) => {
    if (!caniero) { setFilasExtra(prev => prev.filter(f => f !== fila)); return }
    const items = caniero.canios.filter(c => c.fila === fila)
    if (items.length === 0) { setFilasExtra(prev => prev.filter(f => f !== fila)); return }
    setEliminandoFila(fila)
    try {
      await Promise.all(items.map(c => canierosApi.deleteCanioDeCaniero(c.id)))
      await refrescarCaniero(caniero.id)
      if (items.some(c => c.id === selectedCanioId)) setSelectedCanioId(null)
    } finally {
      setEliminandoFila(null)
    }
  }

  const handleCambiarCanio = (id: number, canioId: number) => {
    if (!caniero) return
    canierosApi.updateCanioDeCaniero(id, { canio_id: canioId }).then(() => refrescarCaniero(caniero.id))
  }

  const handleCambiarCamisa = (id: number, camisaCanioId: number | null) => {
    if (!caniero) return
    canierosApi.updateCanioDeCaniero(id, { camisa_canio_id: camisaCanioId }).then(() => refrescarCaniero(caniero.id))
  }

  // Asignación/quita de circuitos: aplica el cambio al instante en el front y
  // sincroniza con la DB en segundo plano (mismo patrón que /ocupaciones y /ruteo).
  const handleAsignar = (circId: number) => {
    if (!caniero || !selectedCanioId) return
    const t = tableros.find(t => t.circuitos.find(c => c.id === circId))
    const c = t?.circuitos.find(c => c.id === circId)
    if (!c || !t) return
    const circ = { id: c.id, circuito: c.circuito, tablero: { tag: t.tag } }
    const canieroId = caniero.id
    const canioId = selectedCanioId
    setCanieros(prev => prev.map(cn => cn.id !== canieroId ? cn : {
      ...cn,
      canios: cn.canios.map(cd => cd.id === canioId && !cd.circuitos.find(x => x.id === circId)
        ? { ...cd, circuitos: [...cd.circuitos, circ] } : cd),
    }))
    canierosApi.addCircuitoToCanio(canioId, circId)
      .then(real => setCanieros(prev => prev.map(cn => cn.id !== canieroId ? cn : {
        ...cn, canios: cn.canios.map(cd => cd.id === canioId ? real : cd),
      })))
      .catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  const handleQuitar = (canioDeCanieroId: number, circId: number) => {
    if (!caniero) return
    const canieroId = caniero.id
    setCanieros(prev => prev.map(cn => cn.id !== canieroId ? cn : {
      ...cn, canios: cn.canios.map(cd => cd.id === canioDeCanieroId ? { ...cd, circuitos: cd.circuitos.filter(x => x.id !== circId) } : cd),
    }))
    canierosApi.removeCircuitoFromCanio(canioDeCanieroId, circId)
      .then(real => setCanieros(prev => prev.map(cn => cn.id !== canieroId ? cn : {
        ...cn, canios: cn.canios.map(cd => cd.id === canioDeCanieroId ? real : cd),
      })))
      .catch(err => { console.error(err); showError('No se pudo guardar el cambio. Reintentá.') })
  }

  const selectedCanio = caniero?.canios.find(c => c.id === selectedCanioId) ?? null
  const fieldInput = 'px-2 py-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[12px] outline-none focus:border-primary-a20 w-24'

  if (!proyectoActivo) {
    return <div className="p-8 text-center text-surface-tonal-a40 text-[13px]">Seleccioná un proyecto para diseñar canieros enterrados.</div>
  }

  return (
    <div className="flex flex-col h-dvh bg-surface-a0 overflow-hidden">

      <div className="shrink-0 bg-surface-tonal-a0 border-b border-surface-tonal-a20 sticky top-0 z-10">
        <div className="flex items-center gap-2.5 pt-2 pb-1 px-3">
          <label className="text-[13px] text-font-a20 font-medium">Caniero</label>
          <select
            value={selectedCanieroId ?? ''}
            onChange={e => setSelectedCanieroId(Number(e.target.value))}
            className="px-2 py-1 text-[13px] bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 outline-none"
          >
            <option value="">— Seleccioná —</option>
            {canieros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button
            onClick={() => setShowAddCaniero(true)}
            className="px-3 py-1 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[12px] cursor-pointer hover:bg-primary-a10"
          >+ Nuevo caniero</button>
          {caniero && (
            <button
              onClick={() => handleEliminarCaniero(caniero.id)}
              disabled={eliminandoCaniero}
              className="px-3 py-1 rounded-md border border-danger-a10 bg-transparent text-danger-a10 text-[12px] cursor-pointer hover:bg-[rgba(220,60,60,0.08)] disabled:opacity-50 disabled:cursor-default"
            >{eliminandoCaniero ? 'Eliminando...' : 'Eliminar caniero'}</button>
          )}
        </div>

        {caniero && (
          <CircuitosPanel
            tableros={tableros}
            asignados={selectedCanio?.circuitos ?? []}
            segmentoSeleccionado={!!selectedCanioId}
            onAsignar={handleAsignar}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {!caniero && (
          <div className="text-center text-[13px] text-surface-tonal-a40 py-10">
            {canieros.length === 0 ? 'Sin canieros en este proyecto. Creá uno con el botón de arriba.' : 'Seleccioná un caniero.'}
          </div>
        )}

        {caniero && (
          <>
            {/* Parámetros del caniero */}
            <div className="border border-surface-tonal-a20 rounded-[10px] p-3 flex flex-wrap items-end gap-4 bg-surface-tonal-a0">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-font-a20">Tapada (m)</label>
                <input className={fieldInput} type="number" step="0.05" min="0" value={caniero.tapada ?? ''}
                  onChange={e => handlePatchCaniero(caniero.id, { tapada: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-font-a20">Espaciamiento horiz. (m)</label>
                <input className={fieldInput} type="number" step="0.005" min="0" value={caniero.espaciamiento_horizontal ?? ''}
                  onChange={e => handlePatchCaniero(caniero.id, { espaciamiento_horizontal: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-font-a20">Espaciamiento vert. (m)</label>
                <input className={fieldInput} type="number" step="0.005" min="0" value={caniero.espaciamiento_vertical ?? ''}
                  onChange={e => handlePatchCaniero(caniero.id, { espaciamiento_vertical: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-font-a20">Instalación</label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => handlePatchCaniero(caniero.id, { hormigonado: false })}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                      !caniero.hormigonado ? 'bg-info-a0 border-info-a0 text-font-a0' : 'bg-transparent border-surface-tonal-a30 text-font-a20 hover:bg-surface-tonal-a10'
                    }`}
                  >Directo</button>
                  <button type="button" onClick={() => handlePatchCaniero(caniero.id, { hormigonado: true, recubrimiento: caniero.recubrimiento ?? RECUBRIMIENTO_HORMIGON_M })}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                      caniero.hormigonado ? 'bg-info-a0 border-info-a0 text-font-a0' : 'bg-transparent border-surface-tonal-a30 text-font-a20 hover:bg-surface-tonal-a10'
                    }`}
                  >Hormigonado</button>
                </div>
              </div>
              {caniero.hormigonado && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-font-a20">Recubrimiento (m)</label>
                  <input className={fieldInput} type="number" step="0.005" min="0" value={caniero.recubrimiento ?? RECUBRIMIENTO_HORMIGON_M}
                    onChange={e => handlePatchCaniero(caniero.id, { recubrimiento: parseFloat(e.target.value) || 0 })} />
                </div>
              )}
              <div className="flex flex-col gap-1 ml-auto">
                <label className="text-[11px] text-font-a20">Total</label>
                <span className="text-[13px] text-font-a0 font-medium">
                  {caniero.canios.length} caño{caniero.canios.length !== 1 ? 's' : ''} en {filasReales.length} fila{filasReales.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
              {/* Filas de caños */}
              <div className="flex flex-col gap-3">
                {filas.map(fila => (
                  <FilaCanios
                    key={fila}
                    fila={fila}
                    canios={caniero.canios.filter(c => c.fila === fila).sort((a, b) => a.orden - b.orden)}
                    catalogo={canios}
                    selectedCanioId={selectedCanioId}
                    onSelect={setSelectedCanioId}
                    onAgregar={handleAgregarCanio}
                    agregando={agregandoEnFila === fila}
                    onEliminarCanio={handleEliminarCanio}
                    eliminandoCanioId={eliminandoCanioId}
                    onCambiarCanio={handleCambiarCanio}
                    onCambiarCamisa={handleCambiarCamisa}
                    onQuitarCircuito={handleQuitar}
                    onEliminarFila={handleEliminarFila}
                    eliminandoFila={eliminandoFila === fila}
                    getF={getF}
                  />
                ))}

                {filas.length === 0 && (
                  <div className="text-center text-[13px] text-surface-tonal-a40 py-6 border border-dashed border-surface-tonal-a20 rounded-[10px]">
                    Sin filas todavía. Agregá una para empezar a cargar caños.
                  </div>
                )}

                <button
                  onClick={handleAgregarFila}
                  className="self-start px-3.5 py-1.5 rounded-md border border-dashed border-surface-tonal-a30 bg-transparent text-font-a20 text-[12px] cursor-pointer hover:border-primary-a20 hover:text-font-a0"
                >+ Agregar fila</button>
              </div>

              {/* Diagrama */}
              <div className="border border-surface-tonal-a20 rounded-[10px] p-3 bg-surface-tonal-a0 lg:w-[500px] self-start">
                <div className="text-[12px] font-medium text-font-a20 mb-2">Corte transversal</div>
                <DiagramaCaniero caniero={caniero} getF={getF} />
              </div>
            </div>
          </>
        )}

        {/* Explicación */}
        <div className="border-t border-surface-tonal-a20 pt-3 text-[11px] text-surface-tonal-a40 flex flex-col gap-1">
          <span>• <b>Filas libres</b> — cada fila es una lista independiente: podés tener una fila con 5 caños y otra con 2, sin una grilla de columnas fija. La posición dentro del diagrama se acomoda sola según cuántos caños tiene cada fila.</span>
          <span>• <b>Tapada</b> — distancia mínima recomendada entre el nivel de suelo y la parte más alta del caño (no su centro), por protección mecánica (excavación, tránsito): 0,5 m en BT y 1,0 m en MT, según AEA 90364 / IEC 60364-5-52. En <b>cruces de calzada</b> la tapada aumenta independientemente del nivel de tensión, por el peso del tránsito vehicular y el riesgo de futuras excavaciones — valores típicos de práctica: ~0,7-0,8 m para tránsito liviano (ingresos vehiculares, playas de estacionamiento) y ~1,0-1,2 m para calzadas con tránsito pesado o cruces de ruta, casi siempre con protección mecánica adicional (losa de hormigón sobre el caniero, o caño camisa). Editable si el proyecto exige otra cosa.</span>
          <span>• <b>Espaciamiento</b> — se toma como espacio libre entre paredes de caños vecinos (no distancia entre centros). No hay un mínimo normativo único: a menor distancia, mayor interacción térmica entre caños y mayor derating de la corriente admisible (factor de agrupamiento, IEC 60364-5-52 Anexo B, tabla B.52.17). Los valores ofrecidos (0,125 / 0,25 / 0,5 / 1,0 m) son los de esa tabla.</span>
          <span>• <b>Cuánto cambia el factor de agrupamiento (Fc)</b> — baja cuantos más circuitos van juntos y más cerca están entre sí, y sube (se acerca a 1) cuanto más se separan. Como orden de magnitud de referencia (tabla tipo IEC 60364-5-52 Anexo B): con 2 circuitos, Fc ronda ~0,85 a 0,125 m de separación y sube a ~0,95 a 1,0 m; con 6 circuitos, ronda ~0,60 a 0,125 m y sube a ~0,85 a 1,0 m. Son valores indicativos, no la tabla exacta — para el dimensionamiento final hay que verificar la tabla completa de la edición de la norma vigente, según la cantidad real de circuitos.</span>
          <span>• <b>Caño camisa</b> — no es un caño más de la fila, sino una funda de mayor diámetro alrededor de un caño principal ya cargado (cruces de calzada, fundaciones, etc.). Se asigna seleccionando el caño y eligiendo su camisa en esa misma fila — no lleva circuitos propios. En el diagrama se dibuja en la misma posición que su caño, tocando su punto inferior (no concéntrica, como apoyaría en la realidad), y al ser más grande empuja a los vecinos en función de su propio radio para mantener el espacio libre configurado.</span>
          <span>• <b>Hormigonado</b> — si el caniero va encofrado en hormigón en vez de enterrado directo, el bloque se dimensiona como el ancho/alto de la grilla de caños más el recubrimiento mínimo en cada lado (valor típico de práctica de diseño de duct banks: ~0,075 m / 3", editable según norma o proyecto).</span>
          <span>• <b>Ocupación</b> — igual criterio que en /ocupaciones: verde 10-25%, ideal para facilitar el tendido y dejar margen a futuro.</span>
        </div>
      </div>

      {showAddCaniero && (
        <CrearCanieroModal onCrear={handleCrearCaniero} onClose={() => setShowAddCaniero(false)} />
      )}
    </div>
  )
}
