'use client'
import { useMemo, useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'
import type { Tablero } from '@/context/types'
import type { Canio, Bandeja, Segmento } from '@/services/ruteo'
import { calcOcupacionCanio, calcOcupacionBandeja, colorOcupacion as ocupacionColor, type CableSimpleInfo } from '@/utils/electricidad'

// ── Tipos ──────────────────────────────────────────────────────

type AjusteItem = {
  seg:      Segmento
  segIdx:   number
  oldLabel: string
  newLabel: string
  newId:    number
  direction: 'up' | 'down'
}

// ── Lógica de ajuste automático ────────────────────────────────

/**
 * Para cada segmento fuera de la zona verde de ocupación, busca en el catálogo
 * ordenado (de menor a mayor) el tamaño más económico que devuelve la ocupación
 * al rango aceptable.
 *
 * Zonas válidas:
 *   Caños   → [10%, 25%]   (muy por debajo de 40% NEC para facilitar tendido)
 *   Bandejas → [20%, 80%]
 *
 * Estrategia de búsqueda:
 *   - Muy chico (pct > límite superior): recorre el catálogo hacia arriba tomando
 *     el primer tamaño que baja la ocupación al rango. El primero que cumple es
 *     el más pequeño posible que resuelve el problema — la elección más económica.
 *   - Muy grande (pct < límite inferior): recorre el catálogo hacia abajo
 *     registrando el último tamaño que todavía mantiene la ocupación en verde.
 *     Así se obtiene el mínimo tamaño posible sin entrar en zona roja — maximiza
 *     la reducción sin sobrecargar.
 */
// Caño con diámetro interno cargado — es el único dato que necesita el cálculo
// de ocupación, por eso los caños sin este dato quedan afuera del catálogo de ajuste.
type CanioConDiametro = Canio & { diametro_interno: number }

// Lazos y puertos de red no tienen "formación" — llevan un único cable simple.
// Se identifican con el mismo esquema de id tagueado usado en RuteoPanel: los
// puertos_red se marcan negativos (-id-1) para no colisionar con ids de lazos.
function segCablesSimples(seg: Segmento) {
  return [
    ...seg.lazos.map(l => ({ id: l.id })),
    ...seg.puertos_red.map(p => ({ id: -p.id - 1 })),
  ]
}

function computeAjustes(
  rows:           Segmento[],
  canios:         Canio[],
  bandejas:       Bandeja[],
  canalSegmentos: Segmento[],
  getFormacion:   (circId: number) => any,
  getCableSimple: (id: number) => CableSimpleInfo | null | undefined,
): AjusteItem[] {
  const sortedCanios: CanioConDiametro[] = canios
    .filter((c): c is CanioConDiametro => c.diametro_interno != null)
    .sort((a, b) => a.diametro_interno - b.diametro_interno)
  const sortedBandejas = [...bandejas].sort((a, b) => a.ancho - b.ancho)
  const result: AjusteItem[] = []

  for (const seg of rows) {
    if (seg.circuitos.length === 0 && seg.lazos.length === 0 && seg.puertos_red.length === 0) continue
    const segIdx = canalSegmentos.findIndex(s => s.id === seg.id) + 1
    const cablesSimples = segCablesSimples(seg)

    if (seg.tipo === 'canio' && seg.canio && seg.canio.diametro_interno != null) {
      const canioActual = seg.canio.nombre ?? 'Caño'
      const { pct } = calcOcupacionCanio(seg.canio.diametro_interno, seg.circuitos, getFormacion, cablesSimples, getCableSimple)
      if (pct >= 10 && pct <= 25) continue  // ya está en zona verde
      const idx = sortedCanios.findIndex(c => c.id === seg.canio_id)
      if (idx === -1) continue  // el caño actual no está en el catálogo

      if (pct > 25) {
        // Muy chico: avanzar hasta el primer tamaño donde pct ≤ 25
        for (let j = idx + 1; j < sortedCanios.length; j++) {
          const { pct: p } = calcOcupacionCanio(sortedCanios[j].diametro_interno, seg.circuitos, getFormacion, cablesSimples, getCableSimple)
          if (p <= 25) {
            result.push({ seg, segIdx, oldLabel: canioActual, newLabel: sortedCanios[j].nombre ?? 'Caño', newId: sortedCanios[j].id, direction: 'up' })
            break
          }
        }
      } else {
        // Muy grande (pct < 10): bajar al más chico donde pct siga dentro de [10, 25].
        // Se guarda el último candidato válido encontrado mientras se itera hacia abajo;
        // cuando un tamaño supera el 25% se corta porque los siguientes serán aún menores.
        let target: CanioConDiametro | null = null
        for (let j = idx - 1; j >= 0; j--) {
          const { pct: p } = calcOcupacionCanio(sortedCanios[j].diametro_interno, seg.circuitos, getFormacion, cablesSimples, getCableSimple)
          if (p > 25) break        // se pasaría al lado muy chico, detener
          if (p >= 10) target = sortedCanios[j]  // verde, seguir intentando achicarlo más
        }
        if (target) result.push({ seg, segIdx, oldLabel: canioActual, newLabel: target.nombre ?? 'Caño', newId: target.id, direction: 'down' })
      }
    }

    if (seg.tipo === 'bandeja' && seg.bandeja) {
      const { pct } = calcOcupacionBandeja(seg.bandeja.ancho, seg.circuitos, getFormacion, cablesSimples, getCableSimple)
      if (pct >= 20 && pct <= 80) continue  // ya está en zona verde
      const idx = sortedBandejas.findIndex(b => b.id === seg.bandeja_id)
      if (idx === -1) continue
      const oldLabel = `${seg.bandeja.nombre ?? 'Bandeja'} — ${seg.bandeja.ancho} mm`

      if (pct > 80) {
        // Muy chica: avanzar hasta el primer ancho donde pct ≤ 80
        for (let j = idx + 1; j < sortedBandejas.length; j++) {
          const { pct: p } = calcOcupacionBandeja(sortedBandejas[j].ancho, seg.circuitos, getFormacion, cablesSimples, getCableSimple)
          if (p <= 80) {
            result.push({ seg, segIdx, oldLabel, newLabel: `${sortedBandejas[j].nombre ?? 'Bandeja'} — ${sortedBandejas[j].ancho} mm`, newId: sortedBandejas[j].id, direction: 'up' })
            break
          }
        }
      } else {
        // Muy grande (pct < 20): mismo patrón que caños, busca el más angosto posible en verde
        let target: Bandeja | null = null
        for (let j = idx - 1; j >= 0; j--) {
          const { pct: p } = calcOcupacionBandeja(sortedBandejas[j].ancho, seg.circuitos, getFormacion, cablesSimples, getCableSimple)
          if (p > 80) break
          if (p >= 20) target = sortedBandejas[j]
        }
        if (target) result.push({ seg, segIdx, oldLabel, newLabel: `${target.nombre ?? 'Bandeja'} — ${target.ancho} mm`, newId: target.id, direction: 'down' })
      }
    }
  }
  return result
}

// ── Panel de asignación (circuitos / lazos / puertos según categoría) ────────

function AsignablesPanel({
  tableros, asignadosCircuitos, asignadosLazos, asignadosPuertos, segmentoSeleccionado,
  onAsignarCircuito, onAsignarLazo, onAsignarPuerto,
}: {
  tableros: Tablero[]
  asignadosCircuitos: { id: number }[]
  asignadosLazos: { id: number }[]
  asignadosPuertos: { id: number }[]
  segmentoSeleccionado: boolean
  onAsignarCircuito: (id: number) => void
  onAsignarLazo: (id: number) => void
  onAsignarPuerto: (id: number) => void
}) {
  const [tableroId, setTableroId] = useState<number | null>(null)

  // Si el tablero elegido ya no está en la lista (cambió el conjunto) o todavía
  // no se eligió ninguno, cae al primero — sin necesitar un efecto para sincronizarlo.
  const tablero = tableros.find(t => t.id === tableroId) ?? tableros[0] ?? null
  const categoria = tablero?.categoria ?? 'POTENCIA'
  const items = categoria === 'CONTROL' ? tablero?.lazos ?? []
    : categoria === 'DATOS' ? tablero?.puertos_red ?? []
    : tablero?.circuitos ?? []
  const asignados = categoria === 'CONTROL' ? asignadosLazos
    : categoria === 'DATOS' ? asignadosPuertos
    : asignadosCircuitos
  const onAsignar = categoria === 'CONTROL' ? onAsignarLazo
    : categoria === 'DATOS' ? onAsignarPuerto
    : onAsignarCircuito
  const label = (item: any) => categoria === 'CONTROL' ? item.tag_lazo : categoria === 'DATOS' ? item.puerto : item.circuito
  const vacioLabel = categoria === 'CONTROL' ? 'Este tablero no tiene lazos'
    : categoria === 'DATOS' ? 'Este tablero no tiene puertos'
    : 'Este tablero no tiene circuitos'

  return (
    <div>
      <div className="flex gap-1.5 px-3 pt-3 pb-2 flex-wrap">
        {tableros.map(t => (
          <button
            key={t.id}
            onClick={() => setTableroId(t.id)}
            className={`px-3.5 py-1.25 rounded-full border text-xs cursor-pointer transition-[opacity,background] duration-150 ${
              (tableroId ?? tableros[0]?.id) === t.id
                ? 'bg-info-a0 border-info-a10 opacity-100 font-medium'
                : 'bg-transparent border-surface-tonal-a30 text-font-a0 opacity-55 hover:opacity-85'
            }`}
          >
            {t.tag}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.25 px-3 pb-2.5 min-h-11 items-center">
        {items.length === 0
          ? <span className="text-xs text-surface-tonal-a40">{vacioLabel}</span>
          : items.map((item: any) => {
              const asignado = asignados.some(a => a.id === item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => onAsignar(item.id)}
                  disabled={!segmentoSeleccionado || asignado}
                  title={
                    !segmentoSeleccionado ? 'Seleccioná un tramo primero'
                    : asignado ? 'Ya asignado'
                    : 'Asignar al tramo seleccionado'
                  }
                  className={`px-3 py-1 rounded-[14px] border text-xs cursor-pointer transition-[background,border-color,opacity] duration-120 ${
                    asignado
                      ? 'bg-success-a0 border-success-a10 text-success-a20 cursor-default'
                      : !segmentoSeleccionado
                      ? 'bg-transparent border-surface-tonal-a30 text-font-a10 opacity-35'
                      : 'bg-transparent border-surface-tonal-a30 text-font-a10 hover:bg-info-a0 hover:border-info-a10'
                  }`}
                >
                  {label(item)}
                </button>
              )
            })
        }
      </div>
    </div>
  )
}

// ── Barra de ocupación ─────────────────────────────────────────

function OcupacionBar({ pct, tipo }: { pct: number; tipo: 'canio' | 'bandeja' }) {
  const color = ocupacionColor(pct, tipo)
  return (
    <div className="flex items-center justify-center gap-2">
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
    asignarLazo, quitarLazo, asignarPuertoRed, quitarPuertoRed,
  } = useProyectos()

  const [selectedId,       setSelectedId]       = useState<number | null>(null)
  const [showAdd,          setShowAdd]          = useState(false)
  const [filtroTipo,       setFiltroTipo]       = useState<'todos' | 'canio' | 'bandeja'>('todos')
  const [ajustesPendientes, setAjustesPendientes] = useState<AjusteItem[] | null>(null)

  const activeConjunto     = conjuntos.find(c => c.id === activeConjuntoId)
  const conjuntoTableroIds = new Set(activeConjunto?.tableros.map(t => t.id) ?? [])
  const conjuntoTableros   = tableros.filter(t => conjuntoTableroIds.has(t.id))

  const selectedSeg    = segmentos.find(s => s.id === selectedId) ?? null
  const canalSegmentos = segmentos.filter(s => s.tipo === 'canio' || s.tipo === 'bandeja')
  const rows = canalSegmentos.filter(s =>
    (activeConjuntoId === null || s.conjuntos.some(c => c.id === activeConjuntoId)) &&
    (filtroTipo === 'todos' || s.tipo === filtroTipo)
  )

  const getF = (id: number) => getCircuito(id)?.formacion
  // Mismo esquema de id tagueado que RuteoPanel: puertos_red se guardan con id
  // negativo (-id-1) para no colisionar con ids de lazos (secuencias independientes).
  const lazoCableMap   = useMemo(() => new Map(tableros.flatMap(t => t.lazos).map(l => [l.id, { cable: l.cable, cantidad_cables: l.cantidad_cables }])), [tableros])
  const puertoCableMap = useMemo(() => new Map(tableros.flatMap(t => t.puertos_red).map(p => [p.id, { cable: p.cable, cantidad_cables: p.cantidad_cables }])), [tableros])
  const getCableSimple = (id: number) => id >= 0 ? lazoCableMap.get(id) : puertoCableMap.get(-id - 1)

  const handleAjusteClick = () => {
    setAjustesPendientes(computeAjustes(rows, canios, bandejas, canalSegmentos, getF, getCableSimple))
  }

  const handleConfirmAjuste = (ajustes: AjusteItem[]) => {
    for (const a of ajustes) {
      if (a.seg.tipo === 'canio')
        editSegmento(a.seg.id, { canio_id: a.newId })
      else
        editSegmento(a.seg.id, { bandeja_id: a.newId })
    }
    setAjustesPendientes(null)
  }

  const handleAsignar = (circId: number) => {
    if (!selectedId) return
    const t = tableros.find(t => t.circuitos.find(c => c.id === circId))
    const c = t?.circuitos.find(c => c.id === circId)
    if (!c || !t) return
    asignarCircuito(selectedId, circId, { id: c.id, circuito: c.circuito, tablero: { tag: t.tag } })
  }

  const handleAsignarLazo = (lazoId: number) => {
    if (!selectedId) return
    const t = tableros.find(t => t.lazos.find(l => l.id === lazoId))
    const l = t?.lazos.find(l => l.id === lazoId)
    if (!l || !t) return
    asignarLazo(selectedId, lazoId, { id: l.id, tag_lazo: l.tag_lazo, tablero: { tag: t.tag } })
  }

  const handleAsignarPuerto = (puertoId: number) => {
    if (!selectedId) return
    const t = tableros.find(t => t.puertos_red.find(p => p.id === puertoId))
    const p = t?.puertos_red.find(p => p.id === puertoId)
    if (!p || !t) return
    asignarPuertoRed(selectedId, puertoId, { id: p.id, puerto: p.puerto, tablero: { tag: t.tag } })
  }

  const handleQuitar       = (segId: number, circId: number)   => quitarCircuito(segId, circId)
  const handleQuitarLazo   = (segId: number, lazoId: number)   => quitarLazo(segId, lazoId)
  const handleQuitarPuerto = (segId: number, puertoId: number) => quitarPuertoRed(segId, puertoId)

  const handleChangeTipo = (segId: number, nuevoTipo: string) => {
    editSegmento(segId, {
      tipo: nuevoTipo,
      ...(nuevoTipo !== 'canio'   && { canio_id:   null }),
      ...(nuevoTipo !== 'bandeja' && { bandeja_id: null }),
    })
  }

  const handleChangeCanio   = (segId: number, canioId: number | null)   => editSegmento(segId, { canio_id: canioId })
  const handleChangeBandeja = (segId: number, bandejaId: number | null) => editSegmento(segId, { bandeja_id: bandejaId })

  const inlineSelect = 'px-1.5 py-[3px] bg-surface-tonal-a10 border border-info-a10 rounded-[5px] text-font-a0 text-xs cursor-pointer w-full outline-none focus:border-primary-a20 text-center'

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
        <AsignablesPanel
          tableros={conjuntoTableros}
          asignadosCircuitos={selectedSeg?.circuitos ?? []}
          asignadosLazos={selectedSeg?.lazos ?? []}
          asignadosPuertos={selectedSeg?.puertos_red ?? []}
          segmentoSeleccionado={!!selectedId}
          onAsignarCircuito={handleAsignar}
          onAsignarLazo={handleAsignarLazo}
          onAsignarPuerto={handleAsignarPuerto}
        />
      </div>

      {/* ── Scrollable content ─── */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

        {/* Filtro tipo + botón ajuste */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {(['todos', 'canio', 'bandeja'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium border cursor-pointer transition-colors ${
                  filtroTipo === t
                    ? 'bg-primary-a0 border-primary-a0 text-font-a0'
                    : 'bg-transparent border-surface-tonal-a20 text-surface-tonal-a40 hover:border-surface-tonal-a30 hover:text-font-a20'
                }`}
              >
                {t === 'todos' ? 'Todos' : t === 'canio' ? 'Caños' : 'Bandejas'}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            onClick={handleAjusteClick}
            className="px-3.5 py-1.25 rounded-md border border-warning-a10 bg-transparent text-warning-a10 text-[12px] font-medium cursor-pointer transition-colors hover:bg-[rgba(255,200,50,0.08)]"
          >
            ⚡ Ajustar automáticamente
          </button>
        </div>

        <div className="datatable-container" style={{ maxWidth: '100%', minWidth: 0 }}>
          <table className="datatable">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Tipo</th>
                <th>Caño / Bandeja</th>
                <th>Asignados</th>
                <th>Ocupado / Total</th>
                <th>Ocupación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(seg => {
                const segIdx = canalSegmentos.findIndex(s => s.id === seg.id) + 1
                const isSelected = seg.id === selectedId
                const cablesSimples = segCablesSimples(seg)
                const calcC = seg.tipo === 'canio'   && seg.canio?.diametro_interno
                  ? calcOcupacionCanio(seg.canio.diametro_interno, seg.circuitos, getF, cablesSimples, getCableSimple) : null
                const calcB = seg.tipo === 'bandeja' && seg.bandeja?.ancho
                  ? calcOcupacionBandeja(seg.bandeja.ancho, seg.circuitos, getF, cablesSimples, getCableSimple) : null

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
                      <div className="flex flex-wrap justify-center gap-1">
                        {seg.circuitos.length === 0 && seg.lazos.length === 0 && seg.puertos_red.length === 0
                          ? <span className="text-surface-tonal-a40 text-xs">—</span>
                          : <>
                              {seg.circuitos.map(sc => (
                                <span key={`c${sc.id}`} className="inline-flex items-center gap-0.75 px-1.75 py-0.5 rounded-sm bg-surface-tonal-a10 text-[11px] text-font-a10 border border-surface-tonal-a20">
                                  {sc.circuito}
                                  {isSelected && (
                                    <button
                                      className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-[13px] leading-none px-px hover:text-danger-a10"
                                      onClick={e => { e.stopPropagation(); handleQuitar(seg.id, sc.id) }}
                                      title="Quitar"
                                    >×</button>
                                  )}
                                </span>
                              ))}
                              {seg.lazos.map(l => (
                                <span key={`l${l.id}`} className="inline-flex items-center gap-0.75 px-1.75 py-0.5 rounded-sm bg-surface-tonal-a10 text-[11px] text-font-a10 border border-surface-tonal-a20">
                                  {l.tag_lazo}
                                  {isSelected && (
                                    <button
                                      className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-[13px] leading-none px-px hover:text-danger-a10"
                                      onClick={e => { e.stopPropagation(); handleQuitarLazo(seg.id, l.id) }}
                                      title="Quitar"
                                    >×</button>
                                  )}
                                </span>
                              ))}
                              {seg.puertos_red.map(p => (
                                <span key={`p${p.id}`} className="inline-flex items-center gap-0.75 px-1.75 py-0.5 rounded-sm bg-surface-tonal-a10 text-[11px] text-font-a10 border border-surface-tonal-a20">
                                  {p.puerto}
                                  {isSelected && (
                                    <button
                                      className="bg-transparent border-none text-surface-tonal-a40 cursor-pointer text-[13px] leading-none px-px hover:text-danger-a10"
                                      onClick={e => { e.stopPropagation(); handleQuitarPuerto(seg.id, p.id) }}
                                      title="Quitar"
                                    >×</button>
                                  )}
                                </span>
                              ))}
                            </>
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
                      {calcC ? <OcupacionBar pct={calcC.pct} tipo="canio" />
                       : calcB ? <OcupacionBar pct={calcB.pct} tipo="bandeja" />
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

      {ajustesPendientes !== null && (
        <ConfirmAjusteModal
          ajustes={ajustesPendientes}
          onConfirm={handleConfirmAjuste}
          onClose={() => setAjustesPendientes(null)}
        />
      )}

      {showAdd && (
        <AddModal canios={canios} bandejas={bandejas} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}

// ── Modal de confirmación de ajuste ────────────────────────────

function ConfirmAjusteModal({ ajustes, onConfirm, onClose }: {
  ajustes:   AjusteItem[]
  onConfirm: (selected: AjusteItem[]) => void
  onClose:   () => void
}) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set(ajustes.map(a => a.seg.id)))

  const toggle = (id: number) =>
    setChecked(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const selected  = ajustes.filter(a => checked.has(a.seg.id))
  const agrandar  = ajustes.filter(a => a.direction === 'up')
  const achicar   = ajustes.filter(a => a.direction === 'down')

  const rowCx = 'flex items-center gap-2 text-[12px] text-font-a10 px-2 py-1.25 bg-surface-tonal-a10 rounded-md'

  const CheckRow = ({ a, color }: { a: AjusteItem; color: string }) => (
    <label key={a.seg.id} className={`${rowCx} cursor-pointer select-none ${!checked.has(a.seg.id) ? 'opacity-40' : ''}`}>
      <input
        type="checkbox"
        checked={checked.has(a.seg.id)}
        onChange={() => toggle(a.seg.id)}
        className="cursor-pointer accent-[var(--clr-primary-a0)] shrink-0"
      />
      <span className="text-surface-tonal-a40 font-mono text-[11px] shrink-0">#{a.segIdx}</span>
      <span className="flex-1 truncate">{a.oldLabel}</span>
      <span className="text-surface-tonal-a40 shrink-0">→</span>
      <span style={{ color }} className="truncate">{a.newLabel}</span>
    </label>
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={onClose}>
      <div className="bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[10px] px-6 py-5 w-[500px] max-w-[95vw] max-h-[80vh] flex flex-col gap-4" onClick={e => e.stopPropagation()}>

        <div className="text-[15px] font-semibold text-font-a0">
          Ajuste automático
          {ajustes.length > 0 && <span className="ml-2 text-[13px] font-normal text-font-a20">— {ajustes.length} segmento{ajustes.length !== 1 ? 's' : ''}</span>}
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
          {ajustes.length === 0 && (
            <p className="text-[13px] text-font-a20 text-center py-6">
              Todos los segmentos visibles están en zona verde. No hay cambios necesarios.
            </p>
          )}

          {agrandar.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-font-a20 uppercase tracking-[0.05em]">▲ Agrandar — muy chicos ({agrandar.length})</span>
              {agrandar.map(a => <CheckRow key={a.seg.id} a={a} color="var(--clr-success-a10)" />)}
            </div>
          )}

          {achicar.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-font-a20 uppercase tracking-[0.05em]">▼ Achicar — muy grandes ({achicar.length})</span>
              {achicar.map(a => <CheckRow key={a.seg.id} a={a} color="var(--clr-warning-a10)" />)}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.75 rounded-md border border-surface-tonal-a30 bg-transparent text-font-a20 text-[13px] cursor-pointer hover:bg-surface-tonal-a10 hover:text-font-a0"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(selected); onClose() }}
            disabled={selected.length === 0}
            className="px-4.5 py-1.75 rounded-md border border-primary-a0 bg-primary-a0 text-font-a0 text-[13px] cursor-pointer transition-colors hover:bg-primary-a10 disabled:opacity-40 disabled:cursor-default"
          >
            Aplicar {selected.length} cambio{selected.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
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
  const [tipo, setTipo]           = useState<'canio' | 'bandeja'>('canio')
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

  const fieldLabel  = 'text-[11px] font-medium text-font-a20 uppercase tracking-[0.04em]'
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
