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
import '../../styles/ruteo.css'

const snap = (v: number) => Math.round(v / GRID) * GRID

export default function RuteoPage() {
  const [tool,             setTool]             = useState<ToolType>('seleccionar')
  const [drawStart,        setDrawStart]        = useState<{ x: number; y: number } | null>(null)
  const [selectedId,       setSelectedId]       = useState<number | null>(null)
  const [selectedParedId,  setSelectedParedId]  = useState<number | null>(null)
  const [drawZ,            setDrawZ]            = useState(0)
  const [activeCircId,     setActiveCircId]     = useState<number | null>(null)
  const [asignarTableroId, setAsignarTableroId] = useState<number | null>(null)
  const [showConjuntosModal, setShowConjuntosModal] = useState(false)
  const [showParedesModal,   setShowParedesModal]   = useState(false)

  const {
    tableros, segmentos, conjuntos, paredes,
    activeConjuntoId, setActiveConjuntoId,
    tablaParedes, activaArquitecturaId,
    addSegmento, removeSegmento,
    asignarCircuito, quitarCircuito,
    addPared, removePared,
  } = useProyectos()

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
    if (activeConjuntoId === null) return true
    const conjunto = conjuntos.find(c => c.id === activeConjuntoId)
    if (!conjunto) return false
    return conjunto.arquitecturas.some(tp => tp.id === p.tabla_pared_id)
  }, [activeConjuntoId, conjuntos])

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
    if (selectedId)           { removeSegmento(selectedId);      setSelectedId(null) }
    else if (selectedParedId) { removePared(selectedParedId);    setSelectedParedId(null) }
  }, [selectedId, selectedParedId, removeSegmento, removePared])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawStart(null); setSelectedId(null); setActiveCircId(null) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId &&
          document.activeElement?.tagName !== 'INPUT') handleDelete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, handleDelete])

  // ── Canvas event handlers ──────────────────────────────
  const handleStageClick = useCallback((isBackground: boolean, rawPos: { x: number; y: number }) => {
    if (tool === 'seleccionar') {
      if (isBackground) { setSelectedId(null); setSelectedParedId(null) }
      return
    }
    if (tool === 'asignar') return

    if (tool === 'punto') {
      const pos = { x: snap(rawPos.x), y: snap(rawPos.y) }
      addSegmento({ tipo: 'punto', x1: pos.x, y1: pos.y, z1: drawZ, x2: pos.x, y2: pos.y, z2: drawZ,
        canio_id: null, bandeja_id: null, conjunto_ids: activeConjuntoId ? [activeConjuntoId] : [] })
      return
    }

    const pos = snapPoint(snap(rawPos.x), snap(rawPos.y))
    if (!drawStart) {
      if (tool === 'pared' && tablaParedes.length === 0) {
        setShowParedesModal(true)
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
  }, [tool, drawStart, drawZ, activeConjuntoId, activaArquitecturaId, tablaParedes.length, snapPoint, addSegmento, addPared])

  const handleSegmentClick = useCallback((id: number, e: KonvaEventObject<MouseEvent>) => {
    if (tool === 'seleccionar') {
      e.cancelBubble = true; setSelectedParedId(null); setSelectedId(id); return
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
  }, [tool, activeCircId, segmentos, tableros, quitarCircuito, asignarCircuito])

  const changeTool = (t: ToolType) => {
    setTool(t); setDrawStart(null); setSelectedId(null); setSelectedParedId(null); setActiveCircId(null)
  }

  const activeCirc = tableros.flatMap(t => t.circuitos).find(c => c.id === activeCircId) ?? null

  return (
    <div className="ruteo-layout">
      <RuteoToolbar
        tool={tool} drawZ={drawZ} conjuntos={conjuntos}
        activeConjuntoId={activeConjuntoId} drawStart={drawStart}
        activeCircId={activeCircId} activeCirc={activeCirc} selectedId={selectedId}
        tablasParedesCount={tablaParedes.length}
        onChangeTool={changeTool} onChangeDrawZ={setDrawZ}
        onChangeConjunto={setActiveConjuntoId}
        onOpenConjuntos={() => setShowConjuntosModal(true)}
        onOpenParedes={() => setShowParedesModal(true)}
      />
      <div className="ruteo-content">
        <RuteoCanvas
          tool={tool} drawStart={drawStart} drawZ={drawZ}
          selectedId={selectedId} selectedParedId={selectedParedId} activeCircId={activeCircId}
          isSegVisible={isSegVisible} isParedVisible={isParedVisible}
          getSegColor={getSegColor} snapPoint={snapPoint}
          onStageClick={handleStageClick} onSegmentClick={handleSegmentClick}
          onSelectPared={id => { setSelectedId(null); setSelectedParedId(id) }}
        />
        <RuteoPanel
          tool={tool} selectedId={selectedId}
          activeCircId={activeCircId} asignarTableroId={asignarTableroId}
          setActiveCircId={setActiveCircId} setAsignarTableroId={setAsignarTableroId}
          handleDelete={handleDelete}
        />
      </div>
      {showConjuntosModal && <ConjuntosModal onClose={() => setShowConjuntosModal(false)} />}
      {showParedesModal   && <ArquitecturasModal onClose={() => setShowParedesModal(false)} />}
    </div>
  )
}
