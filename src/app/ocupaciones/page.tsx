'use client'
import { useState } from 'react'
import { useTableros } from '@/context/TablerosContext'
import { useRuteo } from '@/context/RuteoContext'
import type { Canio, Bandeja, Segmento } from '@/services/ruteo'
import CircuitosPanel from '@/components/CircuitosPanel'
import './ocupaciones.css'

// ── Helpers ────────────────────────────────────────────────────

function calcCanio(seg: Segmento, getCirc: (id: number) => any) {
  const dInt = seg.canio?.diametro_interno
  if (!dInt) return null
  const areaTotal = Math.PI * (dInt / 2) ** 2
  let areaOcupada = 0
  for (const sc of seg.circuitos) {
    const f = getCirc(sc.id)?.formacion
    if (!f) continue
    if (f.cable?.diametro)
      areaOcupada += f.Nfases * f.cond_por_fase * Math.PI * (f.cable.diametro / 2) ** 2
    if (f.Nneutro > 0 && f.cable_neutro?.diametro)
      areaOcupada += f.Nneutro * Math.PI * (f.cable_neutro.diametro / 2) ** 2
    if (f.cable_tierra?.diametro)
      areaOcupada += Math.PI * (f.cable_tierra.diametro / 2) ** 2
  }
  return { areaOcupada, areaTotal, pct: (areaOcupada / areaTotal) * 100 }
}

function calcBandeja(seg: Segmento, getCirc: (id: number) => any) {
  const ancho = seg.bandeja?.ancho
  if (!ancho) return null
  let anchoOcupado = 0
  for (const sc of seg.circuitos) {
    const f = getCirc(sc.id)?.formacion
    if (!f) continue
    if (f.cable?.diametro)
      anchoOcupado += f.Nfases * f.cond_por_fase * f.cable.diametro
    if (f.Nneutro > 0 && f.cable_neutro?.diametro)
      anchoOcupado += f.Nneutro * f.cable_neutro.diametro
    if (f.cable_tierra?.diametro)
      anchoOcupado += f.cable_tierra.diametro
  }
  return { anchoOcupado, anchoTotal: ancho, pct: (anchoOcupado / ancho) * 100 }
}

function OcupacionBar({ pct }: { pct: number }) {
  const color =
    pct > 30 ? 'var(--clr-danger-a10)'
    : pct > 25 ? 'var(--clr-warning-a10)'
    : 'var(--clr-success-a10)'
  return (
    <div className="ocup-bar-wrap">
      <div className="ocup-bar-track">
        <div className="ocup-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span style={{ color, minWidth: 44, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function OcupacionesPage() {
  const { tableros, getCircuito } = useTableros()
  const {
    segmentos, canios, bandejas,
    conjuntos, activeConjuntoId, setActiveConjuntoId,
    editSegmento,
    asignarCircuito, quitarCircuito,
  } = useRuteo()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAdd, setShowAdd]       = useState(false)

  const activeConjunto    = conjuntos.find(c => c.id === activeConjuntoId)
  const conjuntoTableroIds = new Set(activeConjunto?.tableros.map(t => t.id) ?? [])
  const conjuntoTableros   = tableros.filter(t => conjuntoTableroIds.has(t.id))

  const selectedSeg = segmentos.find(s => s.id === selectedId) ?? null
  const rows = segmentos.filter(s =>
    (s.tipo === 'canio' || s.tipo === 'bandeja') &&
    (activeConjuntoId === null || s.conjuntos.some(c => c.id === activeConjuntoId))
  )

  const handleAsignar = (circId: number) => {
    if (!selectedId) return
    const t = tableros.find(t => t.circuitos.find(c => c.id === circId))
    const c = t?.circuitos.find(c => c.id === circId)
    if (!c || !t) return
    asignarCircuito(selectedId, circId, { id: c.id, circuito: c.circuito, tablero: { tag: t.tag } })
  }

  const handleQuitar = (segId: number, circId: number) => {
    quitarCircuito(segId, circId)
  }

  const handleChangeTipo = (segId: number, nuevoTipo: string) => {
    editSegmento(segId, {
      tipo: nuevoTipo,
      ...(nuevoTipo !== 'canio'   && { canio_id:   null }),
      ...(nuevoTipo !== 'bandeja' && { bandeja_id: null }),
    })
  }

  const handleChangeCanio = (segId: number, canioId: number | null) => {
    editSegmento(segId, { canio_id: canioId })
  }

  const handleChangeBandeja = (segId: number, bandejaId: number | null) => {
    editSegmento(segId, { bandeja_id: bandejaId })
  }

  return (
    <div className="ocup-layout">

      {/* ── Sticky header ─── */}
      <div className="ocup-sticky">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 4px' }}>
          <label style={{ fontSize: 13, color: 'var(--clr-font-a20)', fontWeight: 500 }}>Conjunto</label>
          <select
            value={activeConjuntoId ?? ''}
            onChange={e => setActiveConjuntoId(Number(e.target.value))}
            style={{
              padding: '4px 8px', fontSize: 13,
              background: 'var(--clr-surface-tonal-a10)',
              border: '1px solid var(--clr-surface-tonal-a20)',
              borderRadius: 6, color: 'var(--clr-font-a0)',
            }}
          >
            {conjuntos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <CircuitosPanel
          tableros={conjuntoTableros}
          asignados={selectedSeg?.circuitos ?? []}
          segmentoSeleccionado={!!selectedId}
          onAsignar={handleAsignar}
        />
      </div>

      {/* ── Scrollable content ─── */}
      <div className="ocup-scroll">
        <div className="datatable-container" style={{ maxWidth: '100%', minWidth: 0 }}>
          <table className="datatable">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Caño / Bandeja</th>
                <th>Circuitos</th>
                <th>Ocupado / Total</th>
                <th>Ocupación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(seg => {
                const isSelected = seg.id === selectedId
                const calcC = seg.tipo === 'canio'   ? calcCanio(seg, getCircuito)   : null
                const calcB = seg.tipo === 'bandeja' ? calcBandeja(seg, getCircuito) : null

                return (
                  <tr
                    key={seg.id}
                    className={isSelected ? 'ocup-row-selected' : ''}
                    onClick={() => setSelectedId(isSelected ? null : seg.id)}
                  >
                    <td onClick={isSelected ? e => e.stopPropagation() : undefined}>
                      {isSelected ? (
                        <select
                          className="ocup-inline-select"
                          value={seg.tipo}
                          onChange={e => handleChangeTipo(seg.id, e.target.value)}
                        >
                          <option value="canio">Caño</option>
                          <option value="bandeja">Bandeja</option>
                        </select>
                      ) : (
                        <span className={`ocup-badge ocup-badge-${seg.tipo}`}>{seg.tipo}</span>
                      )}
                    </td>
                    <td onClick={isSelected ? e => e.stopPropagation() : undefined}>
                      {isSelected && seg.tipo === 'canio' ? (
                        <select
                          className="ocup-inline-select"
                          value={seg.canio_id ?? ''}
                          onChange={e => handleChangeCanio(seg.id, e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">— Sin especificar —</option>
                          {canios.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      ) : isSelected && seg.tipo === 'bandeja' ? (
                        <select
                          className="ocup-inline-select"
                          value={seg.bandeja_id ?? ''}
                          onChange={e => handleChangeBandeja(seg.id, e.target.value ? Number(e.target.value) : null)}
                        >
                          <option value="">— Sin especificar —</option>
                          {bandejas.map(b => (
                            <option key={b.id} value={b.id}>{b.nombre ?? 'Bandeja'} — {b.ancho} mm</option>
                          ))}
                        </select>
                      ) : seg.canio ? (
                        seg.canio.nombre
                      ) : seg.bandeja ? (
                        `${seg.bandeja.nombre ?? 'Bandeja'} — ${seg.bandeja.ancho} mm`
                      ) : (
                        <span className="ocup-dim">Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <div className="ocup-chips">
                        {seg.circuitos.length === 0
                          ? <span className="ocup-dim">—</span>
                          : seg.circuitos.map(sc => (
                              <span key={sc.id} className="ocup-chip">
                                {sc.circuito}
                                {isSelected && (
                                  <button
                                    className="ocup-chip-remove"
                                    onClick={e => { e.stopPropagation(); handleQuitar(seg.id, sc.id) }}
                                    title="Quitar"
                                  >×</button>
                                )}
                              </span>
                            ))
                        }
                      </div>
                    </td>
                    <td>
                      {calcC
                        ? `${calcC.areaOcupada.toFixed(1)} / ${calcC.areaTotal.toFixed(1)} mm²`
                        : calcB
                        ? `${calcB.anchoOcupado.toFixed(1)} / ${calcB.anchoTotal.toFixed(1)} mm`
                        : <span className="ocup-dim">—</span>
                      }
                    </td>
                    <td>
                      {calcC ? <OcupacionBar pct={calcC.pct} />
                       : calcB ? <OcupacionBar pct={calcB.pct} />
                       : <span className="ocup-dim">—</span>}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="ocup-empty-row">
                    Sin segmentos. Agregá uno con el botón de abajo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ocup-footer">
          <button className="ocup-add-btn" onClick={() => setShowAdd(true)}>
            + Agregar segmento
          </button>
        </div>
      </div>

      {showAdd && (
        <AddModal
          canios={canios}
          bandejas={bandejas}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

// ── Add modal ──────────────────────────────────────────────────

function AddModal({ canios, bandejas, onClose }: {
  canios: Canio[]
  bandejas: Bandeja[]
  onClose: () => void
}) {
  const { addSegmento } = useRuteo()
  const [tipo, setTipo]           = useState<'canio' | 'bandeja' | 'pared'>('canio')
  const [canioId, setCanioId]     = useState<number | ''>(canios[0]?.id ?? '')
  const [bandejaId, setBandejaId] = useState<number | ''>(bandejas[0]?.id ?? '')

  const handleSubmit = () => {
    addSegmento({
      tipo,
      x1: 0, y1: 0, z1: 0,
      x2: 0, y2: 0, z2: 0,
      canio_id:   tipo === 'canio'   && canioId   !== '' ? Number(canioId)   : null,
      bandeja_id: tipo === 'bandeja' && bandejaId !== '' ? Number(bandejaId) : null,
    })
    onClose()
  }

  return (
    <div className="ocup-overlay" onClick={onClose}>
      <div className="ocup-modal" onClick={e => e.stopPropagation()}>
        <div className="ocup-modal-title">Agregar segmento</div>

        <div className="ocup-field">
          <label>Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as any)}>
            <option value="canio">Caño</option>
            <option value="bandeja">Bandeja</option>
            <option value="pared">Pared</option>
          </select>
        </div>

        {tipo === 'canio' && (
          <div className="ocup-field">
            <label>Caño</label>
            <select value={canioId} onChange={e => setCanioId(Number(e.target.value))}>
              <option value="">— Sin especificar —</option>
              {canios.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} — Ø{c.diametro_nominal}
                </option>
              ))}
            </select>
          </div>
        )}

        {tipo === 'bandeja' && (
          <div className="ocup-field">
            <label>Bandeja</label>
            <select value={bandejaId} onChange={e => setBandejaId(Number(e.target.value))}>
              <option value="">— Sin especificar —</option>
              {bandejas.map(b => (
                <option key={b.id} value={b.id}>
                  {b.nombre ?? 'Bandeja'} — {b.ancho} mm
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ocup-modal-actions">
          <button className="ocup-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="ocup-add-btn" onClick={handleSubmit}>
            Crear
          </button>
        </div>
      </div>
    </div>
  )
}
