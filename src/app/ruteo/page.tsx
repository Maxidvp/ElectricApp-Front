'use client'
import { useState, useEffect, useCallback } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useProyectos } from '@/context/ProyectosContext'
import type { Segmento, Pared } from '@/services/ruteo'
import { GRID, SNAP_EP_DIST, COLORS } from './_constants'
import type { ToolType } from './_constants'
import { RuteoToolbar } from './RuteoToolbar'
import { RuteoCanvas } from './RuteoCanvas'
import { RuteoPanel } from './RuteoPanel'
import { ConjuntosModal } from './ConjuntosModal'
import { ArquitecturasModal } from './ArquitecturasModal'
import ConfirmModal from '@/components/ConfirmModal'

const snap = (v: number) => Math.round(v / GRID) * GRID

export default function RuteoPage() {
  const [tool,             setTool]             = useState<ToolType>('seleccionar')
  const [drawStart,        setDrawStart]        = useState<{ x: number; y: number } | null>(null)
  const [selectedIds,      setSelectedIds]      = useState<Set<number>>(new Set())
  const [selectedParedId,  setSelectedParedId]  = useState<number | null>(null)
  const [drawZ,            setDrawZ]            = useState(0)
  const [activeCircId,     setActiveCircId]     = useState<number | null>(null)
  const [asignarTableroId, setAsignarTableroId] = useState<number | null>(null)
  const [showConjuntosModal, setShowConjuntosModal] = useState(false)
  const [showParedesModal,   setShowParedesModal]   = useState(false)
  const [pendingDelete,      setPendingDelete]      = useState<'segmento' | 'pared' | null>(null)
  const [alertaModal,        setAlertaModal]        = useState<{ mensaje: string; labelAccion: string; onAccion: () => void } | null>(null)

  // ── Vertical tool ──────────────────────────────────────
  const [verticalZMax,          setVerticalZMax]          = useState(300) // 3 m en cm
  const [verticalZMin,          setVerticalZMin]          = useState(0)
  const [continuarCanalizacion, setContinuarCanalizacion] = useState(false)
  const [verticalTipo,          setVerticalTipo]          = useState<'canio' | 'bandeja'>('canio')

  const {
    tableros, segmentos, conjuntos, paredes,
    activeConjuntoId, setActiveConjuntoId,
    tablaParedes, activaArquitecturaId,
    addSegmento, removeSegmento, removeSegmentos, editSegmentosZ, splitSegmento,
    asignarCircuito, quitarCircuito,
    addPared, removePared,
  } = useProyectos()

  const selectedId = selectedIds.size === 1 ? [...selectedIds][0] : null

  useEffect(() => {
    if (tableros.length > 0 && asignarTableroId === null) setAsignarTableroId(tableros[0].id)
  }, [tableros, asignarTableroId])

  // ── Visibility ─────────────────────────────────────────
  const getSegColor = useCallback((seg: Segmento): string => {
    if (seg.color) return seg.color
    if (seg.tipo === 'canio')   return seg.canio?.color   ?? '#ffffff'
    if (seg.tipo === 'bandeja') return seg.bandeja?.color ?? '#ffffff'
    return COLORS[seg.tipo] ?? '#aaa'
  }, [])

  const isSegVisible = useCallback((seg: Segmento) => {
    if (activeConjuntoId === null) return true
    return seg.conjuntos.some(c => c.id === activeConjuntoId)
  }, [activeConjuntoId])

  const isParedVisible = useCallback((p: Pared) => {
    if (activaArquitecturaId === null) return false
    return p.tabla_pared_id === activaArquitecturaId
  }, [activaArquitecturaId])

  // ── Vertical tool helper ───────────────────────────────
  const closestPointOnSegment = useCallback((px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1, dy = y2 - y1
    const len2 = dx * dx + dy * dy
    if (len2 === 0) return { x: x1, y: y1 }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2))
    return { x: Math.round(x1 + t * dx), y: Math.round(y1 + t * dy) }
  }, [])

  // ── Endpoint snap ──────────────────────────────────────
  const findNearestEndpoint = useCallback((x: number, y: number, excludeId: number) => {
    let nearest: { x: number; y: number } | null = null
    let minDist = SNAP_EP_DIST
    const all = [
      ...segmentos.map(s => ({ id: s.id,        x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2 })),
      ...paredes.map(p   => ({ id: -p.id - 1e6, x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 })),
    ]
    for (const item of all) {
      if (item.id === excludeId) continue
      for (const [px, py] of [[item.x1, item.y1], [item.x2, item.y2]] as [number, number][]) {
        const d = Math.hypot(x - px, y - py)
        if (d < minDist) { minDist = d; nearest = { x: px, y: py } }
      }
    }
    return nearest
  }, [segmentos, paredes])

  const snapPoint = useCallback((x: number, y: number, excludeId = -1) =>
    findNearestEndpoint(x, y, excludeId) ?? { x: snap(x), y: snap(y) }
  , [findNearestEndpoint])

  // ── Keyboard ───────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (selectedIds.size > 0)  setPendingDelete('segmento')
    else if (selectedParedId)  setPendingDelete('pared')
  }, [selectedIds, selectedParedId])

  const confirmDelete = useCallback(() => {
    if (selectedIds.size > 0) {
      const ids = [...selectedIds]
      if (ids.length === 1) removeSegmento(ids[0])
      else removeSegmentos(ids)
      setSelectedIds(new Set())
    } else if (selectedParedId) {
      removePared(selectedParedId)
      setSelectedParedId(null)
    }
    setPendingDelete(null)
  }, [selectedIds, selectedParedId, removeSegmento, removeSegmentos, removePared])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawStart(null); setSelectedIds(new Set()); setActiveCircId(null) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedIds.size > 0 || selectedParedId) &&
          document.activeElement?.tagName !== 'INPUT') handleDelete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, selectedParedId, handleDelete])

  // ── Canvas event handlers ──────────────────────────────
  const handleBoxSelect = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids))
    setSelectedParedId(null)
  }, [])

  const handleStageClick = useCallback((isBackground: boolean, rawPos: { x: number; y: number }) => {
    if (tool === 'seleccionar') {
      if (isBackground) { setSelectedIds(new Set()); setSelectedParedId(null) }
      return
    }
    if (tool === 'asignar') return

    if (tool === 'punto') {
      const pos = { x: snap(rawPos.x), y: snap(rawPos.y) }
      addSegmento({ tipo: 'punto', x1: pos.x, y1: pos.y, z1: drawZ, x2: pos.x, y2: pos.y, z2: drawZ,
        canio_id: null, bandeja_id: null, conjunto_ids: activeConjuntoId ? [activeConjuntoId] : [] })
      return
    }

    if (tool === 'vertical') {
      if (continuarCanalizacion) return // requiere click en un segmento existente
      if (conjuntos.length === 0 || activeConjuntoId === null) {
        setAlertaModal({ mensaje: 'Para insertar un tramo vertical necesitás una canalización activa. Podés crear una desde el panel de Canalizaciones.', labelAccion: 'Ir a Canalizaciones', onAccion: () => setShowConjuntosModal(true) })
        return
      }
      const pos = snapPoint(snap(rawPos.x), snap(rawPos.y))
      addSegmento({
        tipo: verticalTipo,
        x1: pos.x, y1: pos.y, z1: verticalZMin,
        x2: pos.x, y2: pos.y, z2: verticalZMax,
        canio_id: null, bandeja_id: null,
        conjunto_ids: [activeConjuntoId],
      })
      return
    }

    const pos = snapPoint(snap(rawPos.x), snap(rawPos.y))
    if (!drawStart) {
      if ((tool === 'canio' || tool === 'bandeja') && (conjuntos.length === 0 || activeConjuntoId === null)) {
        setAlertaModal({ mensaje: 'Para dibujar caños y bandejas necesitás una canalización activa. Podés crear una desde el panel de Canalizaciones.', labelAccion: 'Ir a Canalizaciones', onAccion: () => setShowConjuntosModal(true) })
        return
      }
      if (tool === 'pared' && (tablaParedes.length === 0 || activaArquitecturaId === null)) {
        setAlertaModal({ mensaje: 'Para dibujar paredes necesitás un layout de arquitectura activo. Podés crear uno desde el panel de Paredes.', labelAccion: 'Ir a Paredes', onAccion: () => setShowParedesModal(true) })
        return
      }
      setDrawStart(pos)
    } else {
      if (tool === 'pared') {
        addPared({
          x1: drawStart.x, y1: drawStart.y, z1: drawZ,
          x2: pos.x, y2: pos.y, z2: drawZ,
          nombre: null, color: null,
          tabla_pared_id: activaArquitecturaId,
        })
      } else {
        addSegmento({ tipo: tool, x1: drawStart.x, y1: drawStart.y, z1: drawZ, x2: pos.x, y2: pos.y, z2: drawZ,
          canio_id: null, bandeja_id: null, conjunto_ids: activeConjuntoId ? [activeConjuntoId] : [] })
      }
      setDrawStart(null)
    }
  }, [tool, drawStart, drawZ, activeConjuntoId, activaArquitecturaId, tablaParedes.length,
      conjuntos.length, continuarCanalizacion, verticalTipo, verticalZMin, verticalZMax,
      snapPoint, addSegmento, addPared])

  const handleSplitSegment = useCallback((segId: number, x: number, y: number, z: number) => {
    splitSegmento(segId, x, y, z)
  }, [splitSegmento])

  const handleSegmentClick = useCallback((id: number, e: KonvaEventObject<MouseEvent>) => {
    if (tool === 'dividir') return
    if (tool === 'seleccionar') {
      e.cancelBubble = true
      setSelectedParedId(null)
      if (e.evt.shiftKey) {
        setSelectedIds(prev => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id); else next.add(id)
          return next
        })
      } else {
        setSelectedIds(new Set([id]))
      }
      return
    }
    if (tool === 'asignar') {
      if (!activeCircId) return
      e.cancelBubble = true
      const seg = segmentos.find(s => s.id === id)
      if (!seg || (seg.tipo !== 'canio' && seg.tipo !== 'bandeja')) return
      if (seg.circuitos.some(c => c.id === activeCircId)) {
        quitarCircuito(id, activeCircId)
      } else {
        const t = tableros.find(t => t.circuitos.find(c => c.id === activeCircId))
        const c = t?.circuitos.find(c => c.id === activeCircId)
        if (!c || !t) return
        asignarCircuito(id, activeCircId, { id: c.id, circuito: c.circuito, tablero: { tag: t.tag } })
      }
    }
    if (tool === 'vertical' && continuarCanalizacion) {
      const seg = segmentos.find(s => s.id === id)
      if (!seg || (seg.tipo !== 'canio' && seg.tipo !== 'bandeja')) return
      if (conjuntos.length === 0 || activeConjuntoId === null) {
        setAlertaModal({ mensaje: 'Para insertar un tramo vertical necesitás una canalización activa. Podés crear una desde el panel de Canalizaciones.', labelAccion: 'Ir a Canalizaciones', onAccion: () => setShowConjuntosModal(true) })
        return
      }
      e.cancelBubble = true
      const stage = e.target.getStage()
      const raw = stage?.getRelativePointerPosition()
      if (!raw) return
      const cp = closestPointOnSegment(raw.x, raw.y, seg.x1, seg.y1, seg.x2, seg.y2)
      const pos = { x: snap(cp.x), y: snap(cp.y) }
      addSegmento({
        tipo: seg.tipo as 'canio' | 'bandeja',
        x1: pos.x, y1: pos.y, z1: seg.z1,
        x2: pos.x, y2: pos.y, z2: verticalZMax,
        canio_id: null, bandeja_id: null,
        conjunto_ids: [activeConjuntoId],
      })
    }
  }, [tool, activeCircId, segmentos, tableros, conjuntos.length, continuarCanalizacion, verticalZMax,
      activeConjuntoId, closestPointOnSegment, quitarCircuito, asignarCircuito, addSegmento])

  const changeTool = (t: ToolType) => {
    setTool(t); setDrawStart(null); setSelectedIds(new Set()); setSelectedParedId(null); setActiveCircId(null)
  }

  const activeCirc = tableros.flatMap(t => t.circuitos).find(c => c.id === activeCircId) ?? null

  return (
    <div className="flex flex-col h-[calc(100dvh-48px)] bg-surface-a0 overflow-hidden">
      <RuteoToolbar
        tool={tool} drawZ={drawZ} conjuntos={conjuntos}
        activeConjuntoId={activeConjuntoId} drawStart={drawStart}
        activeCircId={activeCircId} activeCirc={activeCirc} selectedId={selectedId}
        tablasParedesCount={tablaParedes.length}
        activeArquitecturaNombre={tablaParedes.find(tp => tp.id === activaArquitecturaId)?.nombre ?? null}
        verticalZMax={verticalZMax} verticalZMin={verticalZMin}
        continuarCanalizacion={continuarCanalizacion} verticalTipo={verticalTipo}
        onChangeTool={changeTool} onChangeDrawZ={setDrawZ}
        onChangeConjunto={setActiveConjuntoId}
        onOpenConjuntos={() => setShowConjuntosModal(true)}
        onOpenParedes={() => setShowParedesModal(true)}
        onChangeVerticalZMax={setVerticalZMax}
        onChangeVerticalZMin={setVerticalZMin}
        onToggleContinuar={setContinuarCanalizacion}
        onChangeVerticalTipo={setVerticalTipo}
      />
      <div className="flex flex-1 overflow-hidden">
        <RuteoCanvas
          tool={tool} drawStart={drawStart} drawZ={drawZ}
          selectedIds={selectedIds} selectedParedId={selectedParedId} activeCircId={activeCircId}
          isSegVisible={isSegVisible} isParedVisible={isParedVisible}
          getSegColor={getSegColor} snapPoint={snapPoint}
          onStageClick={handleStageClick} onSegmentClick={handleSegmentClick}
          onBoxSelect={handleBoxSelect} onSplitSegment={handleSplitSegment}
          onSelectPared={id => { setSelectedIds(new Set()); setSelectedParedId(id) }}
        />
        <RuteoPanel
          tool={tool} selectedIds={selectedIds}
          activeCircId={activeCircId} asignarTableroId={asignarTableroId}
          setActiveCircId={setActiveCircId} setAsignarTableroId={setAsignarTableroId}
          handleDelete={handleDelete}
          onSetZ={z => editSegmentosZ([...selectedIds], z)}
        />
      </div>
      {showConjuntosModal && <ConjuntosModal onClose={() => setShowConjuntosModal(false)} />}
      {showParedesModal   && <ArquitecturasModal onClose={() => setShowParedesModal(false)} />}
      {pendingDelete && (
        <ConfirmModal
          mensaje={
            pendingDelete === 'segmento'
              ? selectedIds.size > 1 ? `¿Eliminar ${selectedIds.size} segmentos?` : '¿Eliminar este segmento?'
              : '¿Eliminar esta pared?'
          }
          onConfirmar={confirmDelete}
          onCancelar={() => setPendingDelete(null)}
        />
      )}
      {alertaModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={() => setAlertaModal(null)}>
          <div className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] px-6 py-5 flex flex-col gap-4 min-w-[320px] max-w-[90vw]" onClick={e => e.stopPropagation()}>
            <p className="text-[13px] text-font-a0">{alertaModal.mensaje}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAlertaModal(null)}
                className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0"
              >
                Cerrar
              </button>
              <button
                onClick={() => { alertaModal.onAccion(); setAlertaModal(null) }}
                className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-info-a0 bg-info-a0 text-font-a0 hover:opacity-90"
              >
                {alertaModal.labelAccion}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
