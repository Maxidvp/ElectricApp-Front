'use client'
import { useMemo, useEffect, useState, useRef } from 'react'
import { useProyectos } from '@/context/ProyectosContext'
import { COLORS, segContieneItem } from './_constants'
import type { ToolType, ActiveItem } from './_constants'
import { DeferredInput } from './DeferredInput'
import { SubcircuitosModal } from './SubcircuitosModal'
import { calcOcupacionCanio, calcOcupacionBandeja, colorOcupacion } from '@/utils/electricidad'
import { getLastTableroId } from '@/utils/cookies'

interface Props {
  tool: ToolType
  selectedIds: Set<number>
  activeItem: ActiveItem
  asignarTableroId: number | null
  setActiveItem: (item: ActiveItem) => void
  setAsignarTableroId: (id: number | null) => void
  medirCircId: number | null
  medirTableroId: number | null
  localExcluded: Set<number>
  setMedirCircId: (id: number | null) => void
  setMedirTableroId: (id: number | null) => void
  handleDelete: () => void
  onSetZ: (z: number) => void
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
  tool, selectedIds, activeItem, asignarTableroId,
  setActiveItem, setAsignarTableroId,
  medirCircId, medirTableroId, localExcluded, setMedirCircId, setMedirTableroId,
  handleDelete, onSetZ,
}: Props) {
  const {
    tableros, segmentos, canios, bandejas, conjuntos, activeConjuntoId,
    previewSegmento, editSegmento, quitarCircuito, quitarLazo, quitarPuertoRed,
    addSegmentoToConjunto, removeSegmentoFromConjunto,
    getCircuito, actualizarLargo, crearCircuitoAuxiliar,
  } = useProyectos()

  const TIPOS_ILUMINACION = ['IUG', 'IUE']
  const [creando,          setCreando]          = useState<{ parentId: number; role: 'retorno' | 'combinacion' } | null>(null)
  const [subcircEditId,    setSubcircEditId]    = useState<number | null>(null)
  const prevToolRef   = useRef<ToolType>(tool)
  const activeCircRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const prev = prevToolRef.current
    prevToolRef.current = tool
    if (tool === 'asignar' && prev !== 'asignar' && activeItem !== null)
      activeCircRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [tool])

  const conjuntoTableros = useMemo(() => {
    const c = conjuntos.find(c => c.id === activeConjuntoId)
    if (!c) return tableros
    const ids = new Set(c.tableros.map(t => t.id))
    return tableros.filter(t => ids.has(t.id))
  }, [tableros, conjuntos, activeConjuntoId])

  useEffect(() => {
    if (conjuntoTableros.length === 0) { setAsignarTableroId(null); return }
    if (!conjuntoTableros.some(t => t.id === asignarTableroId)) {
      const lastId = getLastTableroId()
      const preferido = lastId != null && conjuntoTableros.some(t => t.id === lastId) ? lastId : conjuntoTableros[0].id
      setAsignarTableroId(preferido)
    }
  }, [conjuntoTableros])

  useEffect(() => {
    if (conjuntoTableros.length === 0) { setMedirTableroId(null); return }
    if (!conjuntoTableros.some(t => t.id === medirTableroId))
      setMedirTableroId(conjuntoTableros[0].id)
  }, [conjuntoTableros])

  const medirTablero     = conjuntoTableros.find(t => t.id === medirTableroId)
  const medirCircuitos   = (medirTablero?.circuitos ?? []).filter(c => c.parent_id === null)
  const medirCircIds     = useMemo(() => {
    if (medirCircId === null) return new Set<number>()
    const hijoIds = tableros.flatMap(t => t.circuitos)
      .filter(c => c.parent_id === medirCircId)
      .map(c => c.id)
    return new Set([medirCircId, ...hijoIds])
  }, [medirCircId, tableros])
  const medirSegs        = useMemo(() =>
    medirCircId === null ? [] : segmentos.filter(s =>
      s.conjuntos.some(c => c.id === activeConjuntoId) &&
      s.circuitos.some(c => medirCircIds.has(c.id))
    ),
    [segmentos, medirCircId, medirCircIds, activeConjuntoId]
  )
  const medirTotal       = medirSegs
    .filter(s => !localExcluded.has(s.id))
    .reduce((sum, s) => sum + Math.hypot(s.x2 - s.x1, s.y2 - s.y1, s.z2 - s.z1) / 100, 0)
  const medirExcludedCnt = medirSegs.filter(s => localExcluded.has(s.id)).length
  const medirActiveCount = medirSegs.length - medirExcludedCnt
  const medirRounded     = Math.round(medirTotal * 100) / 100
  const medirSavedLargo  = medirCircId !== null ? (getCircuito(medirCircId)?.Largo ?? null) : null
  const medirAlreadySame = medirSavedLargo !== null && medirSavedLargo === medirRounded
  const canSaveLargo     = medirActiveCount > 0 && !medirAlreadySame
  const saveHint         = medirActiveCount === 0 ? 'Sin segmentos activos'
    : medirAlreadySame ? 'El valor ya está guardado'
    : null

  const selectedId       = selectedIds.size === 1 ? [...selectedIds][0] : null
  const selectedSeg      = segmentos.find(s => s.id === selectedId) ?? null
  const canalSegmentos   = segmentos.filter(s => s.tipo === 'canio' || s.tipo === 'bandeja')
  const getF             = (id: number) => getCircuito(id)?.formacion
  // Los ids de puertos_red se taggean como negativos (-id-1) para no colisionar
  // con ids de lazos: ambas tablas tienen secuencias de auto-incremento propias.
  const lazoCableMap     = useMemo(() => new Map(tableros.flatMap(t => t.lazos).map(l => [l.id, { cable: l.cable, cantidad_cables: l.cantidad_cables }])), [tableros])
  const puertoCableMap   = useMemo(() => new Map(tableros.flatMap(t => t.puertos_red).map(p => [p.id, { cable: p.cable, cantidad_cables: p.cantidad_cables }])), [tableros])
  const getCableSimple   = (id: number) => id >= 0 ? lazoCableMap.get(id) : puertoCableMap.get(-id - 1)
  const cablesSimples    = selectedSeg ? [
    ...selectedSeg.lazos.map(l => ({ id: l.id })),
    ...selectedSeg.puertos_red.map(p => ({ id: -p.id - 1 })),
  ] : []
  const ocupacion        = selectedSeg?.tipo === 'canio' && selectedSeg.canio?.diametro_interno
    ? calcOcupacionCanio(selectedSeg.canio.diametro_interno, selectedSeg.circuitos, getF, cablesSimples, getCableSimple)
    : selectedSeg?.tipo === 'bandeja' && selectedSeg.bandeja?.ancho
    ? calcOcupacionBandeja(selectedSeg.bandeja.ancho, selectedSeg.circuitos, getF, cablesSimples, getCableSimple)
    : null
  const selectedSegIdx   = selectedSeg ? canalSegmentos.findIndex(s => s.id === selectedSeg.id) + 1 : 0
  const updateProp       = (field: string, value: unknown) => { if (selectedId) editSegmento(selectedId, { [field]: value } as never) }
  const handleQuitarCircuito = (id: number) => { if (selectedId) quitarCircuito(selectedId, id) }
  const handleQuitarLazo     = (id: number) => { if (selectedId) quitarLazo(selectedId, id) }
  const handleQuitarPuerto   = (id: number) => { if (selectedId) quitarPuertoRed(selectedId, id) }
  const asignarTablero   = conjuntoTableros.find(t => t.id === asignarTableroId)
  const asignarCategoria = asignarTablero?.categoria ?? 'POTENCIA'
  const asignarCircuitos = asignarTablero?.circuitos ?? []
  const asignarLazos     = asignarTablero?.lazos ?? []
  const asignarPuertos   = asignarTablero?.puertos_red ?? []
  // Ids con al menos un segmento asignado, para marcar en el panel de Asignar
  // los circuitos/lazos/puertos que todavía no fueron ruteados.
  const circuitosRuteadosIds = useMemo(() => new Set(segmentos.flatMap(s => s.circuitos.map(c => c.id))), [segmentos])
  const lazosRuteadosIds     = useMemo(() => new Set(segmentos.flatMap(s => s.lazos.map(l => l.id))), [segmentos])
  const puertosRuteadosIds   = useMemo(() => new Set(segmentos.flatMap(s => s.puertos_red.map(p => p.id))), [segmentos])
  const SinRutear = () => (
    <span
      className="ml-1.5 w-1.5 h-1.5 rounded-full bg-warning-a10 shrink-0 inline-block align-middle"
      title="No asignado a ningún segmento"
    />
  )
  const activeNombre     = (() => {
    if (!activeItem) return null
    if (activeItem.tipo === 'circuito') return tableros.flatMap(t => t.circuitos).find(c => c.id === activeItem.id)?.circuito ?? null
    if (activeItem.tipo === 'lazo')     return tableros.flatMap(t => t.lazos).find(l => l.id === activeItem.id)?.tag_lazo ?? null
    return tableros.flatMap(t => t.puertos_red).find(p => p.id === activeItem.id)?.puerto ?? null
  })()

  if (tool === 'medir') return (
    <div className={cx.panel}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3.5 py-3 text-xs text-surface-tonal-a40 border-b border-surface-tonal-a10 leading-relaxed">
          {medirCircId
            ? <>Circuito activo. Clickeá un segmento para incluirlo o excluirlo.</>
            : 'Seleccioná un circuito para medir su largo.'}
        </div>
        {conjuntoTableros.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2.5 py-2 border-b border-surface-tonal-a10">
            {conjuntoTableros.map(t => (
              <button key={t.id}
                onClick={() => setMedirTableroId(t.id)}
                className={`px-2.5 py-0.75 rounded-xl border text-[11px] cursor-pointer transition-[background,color] ${
                  medirTableroId === t.id
                    ? 'bg-surface-tonal-a20 text-font-a0 border-surface-tonal-a30'
                    : 'border-surface-tonal-a20 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
                }`}
              >{t.tag}</button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 flex flex-col gap-0.75">
          {medirCircuitos.length === 0
            ? <span className="text-xs text-surface-tonal-a40 py-2 px-1">Sin circuitos</span>
            : medirCircuitos.map(c => (
                <button key={c.id}
                  onClick={() => setMedirCircId(medirCircId === c.id ? null : c.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-[background,color,border-color] ${
                    medirCircId === c.id
                      ? 'bg-[rgba(33,73,138,0.25)] border-info-a10 text-font-a0 font-medium'
                      : 'border-transparent bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
                  }`}
                >
                  {c.circuito}
                  {TIPOS_ILUMINACION.includes(c.tipo ?? '') && medirCircId === c.id && medirCircIds.size > 1 && (
                    <span className="ml-1.5 text-[10px] text-surface-tonal-a30">+retornos</span>
                  )}
                </button>
              ))}
        </div>
        {medirCircId !== null && (
          <div className="px-3.5 py-3 border-t border-surface-tonal-a20 flex flex-col gap-2">
            <div className="flex justify-between text-[11px] text-surface-tonal-a40">
              <span>{medirSegs.length - medirExcludedCnt} seg. activos</span>
              {medirExcludedCnt > 0 && <span>{medirExcludedCnt} excluidos</span>}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[22px] font-semibold tabular-nums text-font-a0">{medirTotal.toFixed(2)}</span>
              <span className="text-[12px] text-surface-tonal-a40">m</span>
            </div>
            <button
              onClick={() => canSaveLargo && actualizarLargo(medirCircId, medirRounded)}
              disabled={!canSaveLargo}
              className={`w-full py-1.5 rounded-md border text-xs transition-opacity ${
                canSaveLargo
                  ? 'border-primary-a0 bg-primary-a0 text-font-a0 cursor-pointer hover:opacity-90'
                  : 'border-surface-tonal-a20 bg-transparent text-surface-tonal-a30 cursor-default opacity-50'
              }`}
            >Guardar como Largo</button>
            {saveHint && (
              <span className="text-[11px] text-surface-tonal-a40 text-center">{saveHint}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (tool === 'asignar') return (
    <>
    <div className={cx.panel}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3.5 py-3 text-xs text-surface-tonal-a40 border-b border-surface-tonal-a10 leading-relaxed">
          {activeItem
            ? <>Activo: <strong>{activeNombre}</strong><br /><span>Click en un caño o bandeja para asignar o quitar</span></>
            : 'Seleccioná un circuito, lazo o puerto para activarlo'}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-warning-a10 shrink-0 inline-block" />
            <span>Sin asignar a ningún segmento</span>
          </div>
        </div>
        {conjuntoTableros.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2.5 py-2 border-b border-surface-tonal-a10">
            {conjuntoTableros.map(t => (
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
          {asignarCategoria === 'CONTROL' ? (
            asignarLazos.length === 0
              ? <span className="text-xs text-surface-tonal-a40 py-2 px-1">Sin lazos</span>
              : asignarLazos.map(l => {
                  const isActiveL = activeItem?.tipo === 'lazo' && activeItem.id === l.id
                  return (
                    <button key={l.id}
                      ref={isActiveL ? activeCircRef : null}
                      onClick={() => setActiveItem(isActiveL ? null : { id: l.id, tipo: 'lazo' })}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-[background,color,border-color] ${
                        isActiveL
                          ? 'bg-[rgba(33,73,138,0.25)] border-info-a10 text-font-a0 font-medium'
                          : 'border-transparent bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
                      }`}
                    >{l.tag_lazo}{!lazosRuteadosIds.has(l.id) && <SinRutear />}</button>
                  )
                })
          ) : asignarCategoria === 'DATOS' ? (
            asignarPuertos.length === 0
              ? <span className="text-xs text-surface-tonal-a40 py-2 px-1">Sin puertos</span>
              : asignarPuertos.map(p => {
                  const isActiveP = activeItem?.tipo === 'puerto_red' && activeItem.id === p.id
                  return (
                    <button key={p.id}
                      ref={isActiveP ? activeCircRef : null}
                      onClick={() => setActiveItem(isActiveP ? null : { id: p.id, tipo: 'puerto_red' })}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-[background,color,border-color] ${
                        isActiveP
                          ? 'bg-[rgba(33,73,138,0.25)] border-info-a10 text-font-a0 font-medium'
                          : 'border-transparent bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
                      }`}
                    >{p.puerto}{!puertosRuteadosIds.has(p.id) && <SinRutear />}</button>
                  )
                })
          ) : (
            asignarCircuitos.filter(c => c.parent_id === null).length === 0
            ? <span className="text-xs text-surface-tonal-a40 py-2 px-1">Sin circuitos</span>
            : asignarCircuitos.filter(c => c.parent_id === null).map(c => {
                const hijos    = asignarCircuitos.filter(h => h.parent_id === c.id)
                const esIlum   = TIPOS_ILUMINACION.includes(c.tipo ?? '')
                const isActiveC = activeItem?.tipo === 'circuito' && activeItem.id === c.id
                const isActive = isActiveC || (activeItem?.tipo === 'circuito' && hijos.some(h => h.id === activeItem.id))
                return (
                  <div key={c.id} className="flex flex-col">
                    <div className="flex items-center gap-0.5">
                      <button
                        ref={isActiveC ? activeCircRef : null}
                        onClick={() => setActiveItem(isActiveC ? null : { id: c.id, tipo: 'circuito' })}
                        className={`flex-1 min-w-0 text-left px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-[background,color,border-color] ${
                          isActiveC
                            ? 'bg-[rgba(33,73,138,0.25)] border-info-a10 text-font-a0 font-medium'
                            : isActive
                            ? 'border-surface-tonal-a20 bg-surface-tonal-a10 text-font-a10'
                            : 'border-transparent bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
                        }`}
                      >
                        {c.circuito}
                        {esIlum && <span className="ml-1.5 text-[10px] text-surface-tonal-a30">{c.tipo}</span>}
                        {!circuitosRuteadosIds.has(c.id) && <SinRutear />}
                      </button>
                      {esIlum && (
                        <button
                          onClick={() => setSubcircEditId(c.id)}
                          title="Editar subcircuitos"
                          className="shrink-0 px-1.5 py-1.5 text-[13px] leading-none text-surface-tonal-a30 hover:text-font-a0 bg-transparent border-none cursor-pointer"
                        >⋯</button>
                      )}
                    </div>
                    {esIlum && (
                      <div className="ml-4 flex flex-col gap-0.5 mt-0.5">
                        {hijos.map(h => {
                          const isActiveH = activeItem?.tipo === 'circuito' && activeItem.id === h.id
                          return (
                            <button key={h.id}
                              ref={isActiveH ? activeCircRef : null}
                              onClick={() => setActiveItem(isActiveH ? null : { id: h.id, tipo: 'circuito' })}
                              className={`w-full text-left px-2 py-1 rounded border text-[11px] cursor-pointer transition-[background,color,border-color] ${
                                isActiveH
                                  ? 'bg-[rgba(33,73,138,0.25)] border-info-a10 text-font-a0 font-medium'
                                  : 'border-transparent bg-transparent text-font-a30 hover:bg-surface-tonal-a10 hover:text-font-a0'
                              }`}
                            >
                              {h.role === 'retorno' ? '↩' : '⟷'} {h.circuito}
                              {!circuitosRuteadosIds.has(h.id) && <SinRutear />}
                            </button>
                          )
                        })}
                        {(['retorno', 'combinacion'] as const).map(role => {
                          const busy = creando?.parentId === c.id && creando?.role === role
                          return (
                            <button key={role}
                              disabled={busy}
                              onClick={async () => {
                                setCreando({ parentId: c.id, role })
                                try {
                                  const nuevo = await crearCircuitoAuxiliar(c.id, role)
                                  setActiveItem({ id: nuevo.id, tipo: 'circuito' })
                                } finally {
                                  setCreando(null)
                                }
                              }}
                              className="text-left px-2 py-0.75 text-[11px] text-surface-tonal-a30 hover:text-font-a0 cursor-pointer bg-transparent border-none disabled:cursor-default disabled:opacity-60"
                            >
                              {busy ? `creando ${role}…` : `+ ${role}`}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
          )}
        </div>
      </div>
    </div>
    {subcircEditId !== null && (() => {
      const parent = asignarCircuitos.find(c => c.id === subcircEditId)
      return parent ? (
        <SubcircuitosModal
          parentId={subcircEditId}
          parentNombre={parent.circuito}
          onCerrar={() => setSubcircEditId(null)}
        />
      ) : null
    })()}
    </>
  )

  if (selectedIds.size > 1) return (
    <div className={cx.panel}>
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-surface-tonal-a20">
        <span className="text-[13px] font-medium text-font-a0">{selectedIds.size} segmentos</span>
        <button
          onClick={handleDelete}
          className="px-2 py-0.75 border border-danger-a0 rounded-sm bg-transparent text-danger-a10 text-xs cursor-pointer hover:bg-danger-a0 hover:text-font-a0"
        >Eliminar</button>
      </div>
      <div className="px-3.5 py-3 flex flex-col gap-1.5">
        <label className={cx.sectionLabel}>Altura Z (m)</label>
        <DeferredInput
          className={cx.sectionInput}
          type="number" step="0.01" value={0}
          onPreview={() => {}}
          onCommit={v => onSetZ(Math.round(v * 100))}
        />
        <span className="text-[11px] text-surface-tonal-a40">Aplica z1 y z2 a todos los seleccionados</span>
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
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[13px] font-medium text-font-a0 capitalize">{selectedSeg.tipo}</span>
          {selectedSegIdx > 0 && <span className="text-[11px] text-surface-tonal-a40 font-mono">#{selectedSegIdx}</span>}
        </div>
        <button
          onClick={handleDelete}
          className="px-2 py-0.75 border border-danger-a0 rounded-sm bg-transparent text-danger-a10 text-xs cursor-pointer hover:bg-danger-a0 hover:text-font-a0"
        >Eliminar</button>
      </div>

      {(selectedSeg.tipo === 'canio' || selectedSeg.tipo === 'bandeja') && (
        <div className="px-3.5 py-2.5 border-b border-surface-tonal-a10 flex gap-1.5">
          {(['canio', 'bandeja'] as const).map(t => (
            <button key={t}
              onClick={() => {
                if (selectedSeg.tipo !== t)
                  editSegmento(selectedSeg.id, { tipo: t, canio_id: null, bandeja_id: null })
              }}
              className={`flex-1 py-1 rounded-md border text-xs cursor-pointer transition-[background,color,border-color] ${
                selectedSeg.tipo === t
                  ? 'border-surface-tonal-a30 bg-surface-tonal-a20 text-font-a0'
                  : 'border-surface-tonal-a20 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0'
              }`}
            >{t === 'canio' ? 'Caño' : 'Bandeja'}</button>
          ))}
        </div>
      )}

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
                  onClick={() => handleQuitarCircuito(c.id)}
                  className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-sm leading-none px-0.5 hover:text-danger-a10"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(selectedSeg.tipo === 'canio' || selectedSeg.tipo === 'bandeja') && selectedSeg.lazos.length > 0 && (
        <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
          <label className={cx.sectionLabel}>Lazos asignados</label>
          <div className="flex flex-col gap-1">
            {selectedSeg.lazos.map(l => (
              <div key={l.id} className="flex items-center justify-between px-2 py-1 bg-surface-tonal-a10 rounded-sm text-xs text-font-a10">
                <div><span>{l.tag_lazo}</span><span className="text-[11px] text-surface-tonal-a40"> · {l.tablero.tag}</span></div>
                <button
                  onClick={() => handleQuitarLazo(l.id)}
                  className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-sm leading-none px-0.5 hover:text-danger-a10"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(selectedSeg.tipo === 'canio' || selectedSeg.tipo === 'bandeja') && selectedSeg.puertos_red.length > 0 && (
        <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
          <label className={cx.sectionLabel}>Puertos de red asignados</label>
          <div className="flex flex-col gap-1">
            {selectedSeg.puertos_red.map(p => (
              <div key={p.id} className="flex items-center justify-between px-2 py-1 bg-surface-tonal-a10 rounded-sm text-xs text-font-a10">
                <div><span>{p.puerto}</span><span className="text-[11px] text-surface-tonal-a40"> · {p.tablero.tag}</span></div>
                <button
                  onClick={() => handleQuitarPuerto(p.id)}
                  className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-sm leading-none px-0.5 hover:text-danger-a10"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {ocupacion && (
        <div className="px-3.5 py-3 border-b border-surface-tonal-a10 flex flex-col gap-1.5">
          <label className={cx.sectionLabel}>Ocupación</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-surface-tonal-a20 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.min(ocupacion.pct, 100)}%`,
                  background: colorOcupacion(ocupacion.pct, selectedSeg?.tipo === 'bandeja' ? 'bandeja' : 'canio'),
                }}
              />
            </div>
            <span className="text-[12px] font-medium tabular-nums" style={{
              color: colorOcupacion(ocupacion.pct, selectedSeg?.tipo === 'bandeja' ? 'bandeja' : 'canio'),
            }}>
              {ocupacion.pct.toFixed(1)}%
            </span>
          </div>
          <span className="text-[11px] text-surface-tonal-a40">
            {'areaOcupada' in ocupacion
              ? `${ocupacion.areaOcupada.toFixed(1)} / ${ocupacion.areaTotal.toFixed(1)} mm²`
              : `${ocupacion.anchoOcupado.toFixed(1)} / ${ocupacion.anchoTotal.toFixed(1)} mm`}
          </span>
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
