'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'
import type { Canio, Bandeja, Segmento } from '@/services/ruteo'
import CircuitosPanel from '@/components/CircuitosPanel'
import { calcOcupacionCanio, calcOcupacionBandeja } from '@/utils/electricidad'

function OcupacionBar({ pct }: { pct: number }) {
  const color =
    pct > 30 ? 'var(--clr-danger-a10)'
    : pct > 25 ? 'var(--clr-warning-a10)'
    : 'var(--clr-success-a10)'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-surface-tonal-a20 overflow-hidden shrink-0">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span style={{ color, minWidth: 44, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────

export default function OcupacionesPage() {
  const {
    tableros, getCircuito,
    segmentos, canios, bandejas,
    conjuntos, activeConjuntoId, setActiveConjuntoId,
    editSegmento,
    asignarCircuito, quitarCircuito,
  } = useProyectos()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAdd, setShowAdd]       = useState(false)

  const activeConjunto    = conjuntos.find(c => c.id === activeConjuntoId)
  const conjuntoTableroIds = new Set(activeConjunto?.tableros.map(t => t.id) ?? [])
  const conjuntoTableros   = tableros.filter(t => conjuntoTableroIds.has(t.id))

  const selectedSeg = segmentos.find(s => s.id === selectedId) ?? null
  const canalSegmentos = segmentos.filter(s => s.tipo === 'canio' || s.tipo === 'bandeja')
  const rows = canalSegmentos.filter(s =>
    activeConjuntoId === null || s.conjuntos.some(c => c.id === activeConjuntoId)
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

  const inlineSelect = 'px-1.5 py-[3px] bg-surface-tonal-a10 border border-info-a10 rounded-[5px] text-font-a0 text-xs cursor-pointer w-full outline-none focus:border-primary-a20'

  return (
    <div className="flex flex-col h-dvh bg-surface-a0 overflow-hidden">

      {/* ── Sticky header ─── */}
      <div className="shrink-0 bg-surface-tonal-a0 border-b border-surface-tonal-a20 sticky top-0 z-10">
        <div className="flex items-center gap-2.5 pt-2 pb-1">
          <label className="text-[13px] text-font-a20 font-medium">Conjunto</label>
          <select
            value={activeConjuntoId ?? ''}
            onChange={e => setActiveConjuntoId(Number(e.target.value))}
            className="px-2 py-1 text-[13px] bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 outline-none"
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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="datatable-container" style={{ maxWidth: '100%', minWidth: 0 }}>
          <table className="datatable">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Tipo</th>
                <th>Caño / Bandeja</th>
                <th>Circuitos</th>
                <th>Ocupado / Total</th>
                <th>Ocupación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(seg => {
                const segIdx = canalSegmentos.findIndex(s => s.id === seg.id) + 1
                const isSelected = seg.id === selectedId
                const getF  = (id: number) => getCircuito(id)?.formacion
                const calcC = seg.tipo === 'canio'   && seg.canio?.diametro_interno
                  ? calcOcupacionCanio(seg.canio.diametro_interno, seg.circuitos, getF) : null
                const calcB = seg.tipo === 'bandeja' && seg.bandeja?.ancho
                  ? calcOcupacionBandeja(seg.bandeja.ancho, seg.circuitos, getF) : null

                return (
                  <tr
                    key={seg.id}
                    className="cursor-pointer"
                    style={isSelected ? { background: 'rgba(33, 73, 138, 0.35)', outline: '1px solid var(--clr-info-a10)' } : undefined}
                    onClick={() => setSelectedId(isSelected ? null : seg.id)}
                  >
                    <td className="text-[11px] text-surface-tonal-a40 font-mono text-center select-none">#{segIdx}</td>
                    <td onClick={isSelected ? e => e.stopPropagation() : undefined}>
                      {isSelected ? (
                        <select className={inlineSelect} value={seg.tipo} onChange={e => handleChangeTipo(seg.id, e.target.value)}>
                          <option value="canio">Caño</option>
                          <option value="bandeja">Bandeja</option>
                        </select>
                      ) : (
                        <span className={`inline-block px-2.25 py-0.5 rounded-[10px] text-[11px] font-medium capitalize tracking-[0.02em] ${
                          seg.tipo === 'canio'
                            ? 'bg-[rgba(232,124,58,0.15)] text-[#E87C3A] border border-[rgba(232,124,58,0.3)]'
                            : 'bg-[rgba(55,138,221,0.15)] text-[#378ADD] border border-[rgba(55,138,221,0.3)]'
                        }`}>{seg.tipo}</span>
                      )}
                    </td>
                    <td onClick={isSelected ? e => e.stopPropagation() : undefined}>
                      {isSelected && seg.tipo === 'canio' ? (
                        <select className={inlineSelect} value={seg.canio_id ?? ''} onChange={e => handleChangeCanio(seg.id, e.target.value ? Number(e.target.value) : null)}>
                          <option value="">— Sin especificar —</option>
                          {canios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      ) : isSelected && seg.tipo === 'bandeja' ? (
                        <select className={inlineSelect} value={seg.bandeja_id ?? ''} onChange={e => handleChangeBandeja(seg.id, e.target.value ? Number(e.target.value) : null)}>
                          <option value="">— Sin especificar —</option>
                          {bandejas.map(b => <option key={b.id} value={b.id}>{b.nombre ?? 'Bandeja'} — {b.ancho} mm</option>)}
                        </select>
                      ) : seg.canio ? (
                        seg.canio.nombre
                      ) : seg.bandeja ? (
                        `${seg.bandeja.nombre ?? 'Bandeja'} — ${seg.bandeja.ancho} mm`
                      ) : (
                        <span className="text-surface-tonal-a40 text-xs">Sin asignar</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {seg.circuitos.length === 0
                          ? <span className="text-surface-tonal-a40 text-xs">—</span>
                          : seg.circuitos.map(sc => (
                              <span key={sc.id} className="inline-flex items-center gap-0.75 px-1.75 py-0.5 rounded-sm bg-surface-tonal-a10 text-[11px] text-font-a10 border border-surface-tonal-a20">
                                {sc.circuito}
                                {isSelected && (
                                  <button
                                    className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-[13px] leading-none px-px hover:text-danger-a10"
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
                        : <span className="text-surface-tonal-a40 text-xs">—</span>
                      }
                    </td>
                    <td>
                      {calcC ? <OcupacionBar pct={calcC.pct} />
                       : calcB ? <OcupacionBar pct={calcB.pct} />
                       : <span className="text-surface-tonal-a40 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-7 text-surface-tonal-a40 text-[13px]">
                    Sin segmentos. Agregá uno con el botón de abajo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end py-2">
          <button
            className="px-4.5 py-1.75 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[13px] cursor-pointer transition-colors hover:bg-primary-a10 disabled:opacity-50 disabled:cursor-default"
            onClick={() => setShowAdd(true)}
          >
            + Agregar segmento
          </button>
        </div>
      </div>

      {showAdd && (
        <AddModal canios={canios} bandejas={bandejas} onClose={() => setShowAdd(false)} />
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
  const { addSegmento } = useProyectos()
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

  const fieldLabel = 'text-[11px] font-medium text-font-a20 uppercase tracking-[0.04em]'
  const fieldSelect = 'px-[10px] py-1.5 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-md text-font-a0 text-[13px] outline-none focus:border-primary-a20'

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-100" onClick={onClose}>
      <div className="bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[10px] px-6 py-5 min-w-80 flex flex-col gap-3.5" onClick={e => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-font-a0">Agregar segmento</div>

        <div className="flex flex-col gap-1.25">
          <label className={fieldLabel}>Tipo</label>
          <select className={fieldSelect} value={tipo} onChange={e => setTipo(e.target.value as any)}>
            <option value="canio">Caño</option>
            <option value="bandeja">Bandeja</option>
            <option value="pared">Pared</option>
          </select>
        </div>

        {tipo === 'canio' && (
          <div className="flex flex-col gap-1.25">
            <label className={fieldLabel}>Caño</label>
            <select className={fieldSelect} value={canioId} onChange={e => setCanioId(Number(e.target.value))}>
              <option value="">— Sin especificar —</option>
              {canios.map(c => <option key={c.id} value={c.id}>{c.nombre} — Ø{c.diametro_nominal}</option>)}
            </select>
          </div>
        )}

        {tipo === 'bandeja' && (
          <div className="flex flex-col gap-1.25">
            <label className={fieldLabel}>Bandeja</label>
            <select className={fieldSelect} value={bandejaId} onChange={e => setBandejaId(Number(e.target.value))}>
              <option value="">— Sin especificar —</option>
              {bandejas.map(b => <option key={b.id} value={b.id}>{b.nombre ?? 'Bandeja'} — {b.ancho} mm</option>)}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <button className="px-4 py-1.75 rounded-md border border-surface-tonal-a30 bg-transparent text-font-a20 text-[13px] cursor-pointer hover:bg-surface-tonal-a10" onClick={onClose}>Cancelar</button>
          <button className="px-4.5 py-1.75 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[13px] cursor-pointer transition-colors hover:bg-primary-a10" onClick={handleSubmit}>
            Crear
          </button>
        </div>
      </div>
    </div>
  )
}
