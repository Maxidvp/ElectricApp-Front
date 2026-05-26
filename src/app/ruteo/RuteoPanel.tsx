'use client'
import { useProyectos } from '@/context/ProyectosContext'
import { COLORS } from './_constants'
import type { ToolType } from './_constants'
import { DeferredInput } from './DeferredInput'

interface Props {
  tool: ToolType
  selectedId: number | null
  activeCircId: number | null
  asignarTableroId: number | null
  setActiveCircId: (id: number | null) => void
  setAsignarTableroId: (id: number | null) => void
  handleDelete: () => void
}

const cx = {
  panel: 'w-[260px] shrink-0 bg-surface-tonal-a0 border-l border-surface-tonal-a20 flex flex-col overflow-y-auto',
  sectionLabel: 'text-[11px] font-medium text-font-a20 tracking-[0.04em] uppercase',
  sectionInput: 'w-full px-2 py-[5px] bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[5px] text-font-a0 text-[13px] box-border outline-none focus:border-primary-a20',
  conjuntoBtn: (active: boolean) =>
    `w-full text-left px-2 py-[5px] rounded-[5px] border text-xs cursor-pointer transition-[background,color,border-color] duration-100 ${
      active
        ? 'bg-[rgba(33,73,138,0.18)] border-info-a10 text-font-a0'
        : 'border-surface-tonal-a20 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
    }`,
}

export function RuteoPanel({
  tool, selectedId, activeCircId, asignarTableroId,
  setActiveCircId, setAsignarTableroId, handleDelete,
}: Props) {
  const {
    tableros, segmentos, canios, bandejas, conjuntos,
    previewSegmento, editSegmento, quitarCircuito,
    addSegmentoToConjunto, removeSegmentoFromConjunto,
  } = useProyectos()

  const selectedSeg      = segmentos.find(s => s.id === selectedId) ?? null
  const updateProp       = (field: string, value: unknown) => { if (selectedId) editSegmento(selectedId, { [field]: value } as never) }
  const handleQuitar     = (circId: number) => { if (selectedId) quitarCircuito(selectedId, circId) }
  const asignarTablero   = tableros.find(t => t.id === asignarTableroId)
  const asignarCircuitos = asignarTablero?.circuitos ?? []
  const activeCirc       = tableros.flatMap(t => t.circuitos).find(c => c.id === activeCircId) ?? null

  if (tool === 'asignar') return (
    <div className={cx.panel}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3.5 py-3 text-xs text-surface-tonal-a40 border-b border-surface-tonal-a10 leading-relaxed">
          {activeCircId
            ? <>Circuito activo: <strong>{activeCirc?.circuito}</strong><br /><span>Click en un caño o bandeja para asignar o quitar</span></>
            : 'Seleccioná un circuito para activarlo'}
        </div>
        {tableros.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2.5 py-2 border-b border-surface-tonal-a10">
            {tableros.map(t => (
              <button key={t.id}
                onClick={() => setAsignarTableroId(t.id)}
                className={`px-2.5 py-0.75 rounded-xl border text-[11px] cursor-pointer transition-[background,color] ${
                  asignarTableroId === t.id
                    ? 'bg-surface-tonal-a20 text-font-a0 border-surface-tonal-a30'
                    : 'border-surface-tonal-a20 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
                }`}
              >{t.tag}</button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 flex flex-col gap-0.75">
          {asignarCircuitos.length === 0
            ? <span className="text-xs text-surface-tonal-a40 py-2 px-1">Sin circuitos</span>
            : asignarCircuitos.map(c => (
                <button key={c.id}
                  onClick={() => setActiveCircId(activeCircId === c.id ? null : c.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-[background,color,border-color] ${
                    activeCircId === c.id
                      ? 'bg-[rgba(33,73,138,0.25)] border-info-a10 text-font-a0 font-medium'
                      : 'border-transparent bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
                  }`}
                >{c.circuito}</button>
              ))}
        </div>
      </div>
    </div>
  )

  if (!selectedSeg) return (
    <div className={cx.panel}>
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-surface-tonal-a40 text-[13px] px-6 py-6 text-center">
        <span>Seleccioná un elemento para ver sus propiedades</span>
      </div>
    </div>
  )

  return (
    <div className={cx.panel}>
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-surface-tonal-a20">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[selectedSeg.tipo] }} />
        <span className="flex-1 text-[13px] font-medium text-font-a0 capitalize">{selectedSeg.tipo}</span>
        <button
          onClick={handleDelete}
          className="px-2 py-0.75 border border-danger-a0 rounded-sm bg-transparent text-danger-a10 text-xs cursor-pointer hover:bg-danger-a0 hover:text-font-a0"
        >Eliminar</button>
      </div>

      <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
        <label className={cx.sectionLabel}>Punto inicio</label>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] gap-1.5">
          <div><label className="text-[11px] text-font-a20 mb-0.5 block">X1 (m)</label>
            <DeferredInput className={cx.sectionInput} type="number" step="0.01" value={selectedSeg.x1/100}
              onPreview={v => previewSegmento(selectedSeg.id, { x1: Math.round(v*100) })}
              onCommit={v => updateProp('x1', Math.round(v*100))} /></div>
          <div><label className="text-[11px] text-font-a20 mb-0.5 block">Y1 (m)</label>
            <DeferredInput className={cx.sectionInput} type="number" step="0.01" value={selectedSeg.y1/100}
              onPreview={v => previewSegmento(selectedSeg.id, { y1: Math.round(v*100) })}
              onCommit={v => updateProp('y1', Math.round(v*100))} /></div>
          <div><label className="text-[11px] text-font-a20 mb-0.5 block">Z1 (m)</label>
            <DeferredInput className={cx.sectionInput} type="number" step="0.01" value={selectedSeg.z1/100}
              onPreview={v => previewSegmento(selectedSeg.id, { z1: Math.round(v*100) })}
              onCommit={v => updateProp('z1', Math.round(v*100))} /></div>
        </div>
      </div>

      <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
        <label className={cx.sectionLabel}>Punto fin</label>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(60px,1fr))] gap-1.5">
          <div><label className="text-[11px] text-font-a20 mb-0.5 block">X2 (m)</label>
            <DeferredInput className={cx.sectionInput} type="number" step="0.01" value={selectedSeg.x2/100}
              onPreview={v => previewSegmento(selectedSeg.id, { x2: Math.round(v*100) })}
              onCommit={v => updateProp('x2', Math.round(v*100))} /></div>
          <div><label className="text-[11px] text-font-a20 mb-0.5 block">Y2 (m)</label>
            <DeferredInput className={cx.sectionInput} type="number" step="0.01" value={selectedSeg.y2/100}
              onPreview={v => previewSegmento(selectedSeg.id, { y2: Math.round(v*100) })}
              onCommit={v => updateProp('y2', Math.round(v*100))} /></div>
          <div><label className="text-[11px] text-font-a20 mb-0.5 block">Z2 (m)</label>
            <DeferredInput className={cx.sectionInput} type="number" step="0.01" value={selectedSeg.z2/100}
              onPreview={v => previewSegmento(selectedSeg.id, { z2: Math.round(v*100) })}
              onCommit={v => updateProp('z2', Math.round(v*100))} /></div>
        </div>
      </div>

      {selectedSeg.tipo === 'canio' && (
        <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
          <label className={cx.sectionLabel}>Tipo de caño</label>
          <select className={cx.sectionInput} value={selectedSeg.canio_id ?? ''}
            onChange={e => updateProp('canio_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Sin especificar —</option>
            {canios.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      )}

      {selectedSeg.tipo === 'bandeja' && (
        <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
          <label className={cx.sectionLabel}>Tipo de bandeja</label>
          <select className={cx.sectionInput} value={selectedSeg.bandeja_id ?? ''}
            onChange={e => updateProp('bandeja_id', e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Sin especificar —</option>
            {bandejas.map(b => <option key={b.id} value={b.id}>{b.nombre ?? 'Bandeja'} — {b.ancho} mm</option>)}
          </select>
        </div>
      )}

      {(selectedSeg.tipo === 'canio' || selectedSeg.tipo === 'bandeja') && selectedSeg.circuitos.length > 0 && (
        <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
          <label className={cx.sectionLabel}>Circuitos asignados</label>
          <div className="flex flex-col gap-1">
            {selectedSeg.circuitos.map(c => (
              <div key={c.id} className="flex items-center justify-between px-2 py-1 bg-surface-tonal-a10 rounded-sm text-xs text-font-a10">
                <div><span>{c.circuito}</span><span className="text-[11px] text-surface-tonal-a40"> · {c.tablero.tag}</span></div>
                <button
                  onClick={() => handleQuitar(c.id)}
                  className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-sm leading-none px-0.5 hover:text-danger-a10"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {conjuntos.length > 0 && (
        <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
          <label className={cx.sectionLabel}>Canalizaciones</label>
          <div className="flex flex-col gap-0.75">
            {conjuntos.map(c => {
              const inC = selectedSeg.conjuntos.some(sc => sc.id === c.id)
              return (
                <button key={c.id}
                  className={cx.conjuntoBtn(inC)}
                  onClick={() => inC
                    ? removeSegmentoFromConjunto(selectedSeg.id, c.id)
                    : addSegmentoToConjunto(selectedSeg.id, c.id)}
                >{inC ? '✓ ' : ''}{c.nombre}</button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
