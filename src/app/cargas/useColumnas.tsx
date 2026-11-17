'use client'
import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import CeldaEditable from '@/components/CeldaEditable'
import type { CircuitoRow, ColMeta, FormacionData } from './types'
import { TIPOS_CIRCUITO } from './types'

type TensionOpt = { tipo: string; value: number }

type Acciones = {
  renombrarCircuito:    (id: number, nombre: string) => void
  actualizarDescripcion:(id: number, desc: string | null) => void
  actualizarTipo:       (id: number, tipo: string | null) => void
  actualizarTipoTension:(id: number, tipo: string | null) => void
  actualizarFase:       (id: number, fase: string | null) => void
  actualizarPotencia:   (id: number, val: number | null) => void
  actualizarFP:         (id: number, val: number | null) => void
  actualizarLargo:      (id: number, val: number | null) => void
  actualizarDatosCarga: (id: number, datos: { factor_simultaneidad?: number | null; cantidad_puntos?: number | null; potencia_unitaria?: number | null }) => void
  setPendingTipo:       (val: { id: number; tipoPrevio: string | null; nuevoTipo: string | null } | null) => void
  setAlimentadorPicker: (val: { id: number } | null) => void
  setCircuitoEditando:  (id: number | null) => void
  setFormacionSeleccionada: (data: FormacionData | null) => void
  setModalAbierto:      (open: boolean) => void
  irATablero:           (id: number) => void
}

const columnHelper = createColumnHelper<CircuitoRow>()

const FASE_LABELS: Record<string, [string, string, string]> = {
  RST:    ['R',  'S',  'T'],
  L1L2L3: ['L1', 'L2', 'L3'],
  ABC:    ['A',  'B',  'C'],
  UVW:    ['U',  'V',  'W'],
}

function getFaseLabels(nom: string): [string, string, string] {
  return FASE_LABELS[nom] ?? FASE_LABELS.RST
}

export function useColumnas(tensionesDisponibles: TensionOpt[], acciones: Acciones, nomenclatura = 'RST') {
  const {
    renombrarCircuito, actualizarDescripcion, actualizarTipo,
    actualizarTipoTension, actualizarFase, actualizarPotencia,
    actualizarFP, actualizarLargo, actualizarDatosCarga,
    setPendingTipo, setAlimentadorPicker, setCircuitoEditando, setFormacionSeleccionada, setModalAbierto,
    irATablero,
  } = acciones

  const [f1, f2, f3] = getFaseLabels(nomenclatura)
  const sep = nomenclatura === 'RST' ? '' : '-'

  return useMemo(() => [
    columnHelper.accessor('circuito', {
      header: 'Circuito',
      size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => (
        <CeldaEditable
          valor={info.getValue()}
          onGuardar={v => renombrarCircuito(info.row.original.id, v)}
        />
      ),
    }),
    columnHelper.accessor('descripcion', {
      header: 'Descripción',
      size: 200,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => (
        <CeldaEditable
          valor={info.getValue() ?? ''}
          onGuardar={v => actualizarDescripcion(info.row.original.id, v.trim() || null)}
        />
      ),
    }),
    columnHelper.accessor('tipo', {
      header: 'Tipo',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, tipo, tablero_destino, acometida_destino } = info.row.original
        return (
          <div className="flex flex-col gap-px">
            <select
              value={tipo ?? ''}
              onChange={e => {
                const nuevo = e.target.value || null
                if (nuevo === 'ALIMENTADOR') setAlimentadorPicker({ id })
                else if (nuevo === 'ACOMETIDA' || tipo === 'ACOMETIDA' || tipo === 'ALIMENTADOR')
                  setPendingTipo({ id, tipoPrevio: tipo, nuevoTipo: nuevo })
                else
                  actualizarTipo(id, nuevo)
              }}
              onClick={e => e.stopPropagation()}
              className="w-full h-6 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer text-center"
              style={{ background: 'var(--clr-surface-a10)' }}
            >
              <option value="">—</option>
              {TIPOS_CIRCUITO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {tipo === 'ALIMENTADOR' && tablero_destino && (
              <span
                onClick={e => { e.stopPropagation(); irATablero(tablero_destino.id) }}
                className="text-[10px] text-info-a10 underline decoration-dotted cursor-pointer truncate block text-center"
                title={`Ir a ${tablero_destino.nombre || tablero_destino.tag}${acometida_destino ? ` — llega a la acometida ${acometida_destino}` : ''}`}
              >
                → {tablero_destino.nombre || tablero_destino.tag}{acometida_destino ? ` · ${acometida_destino}` : ''}
              </span>
            )}
          </div>
        )
      },
    }),
    columnHelper.display({
      id: 'tension',
      header: 'Tensión (V)',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, tipo_tension, es_acometida } = info.row.original
        if (es_acometida) {
          const v = tensionesDisponibles.find(t => t.tipo === tipo_tension)?.value
          return <span className="text-xs text-font-a20">{v ?? '—'}</span>
        }
        if (tensionesDisponibles.length === 0) return <span className="text-surface-tonal-a40 text-xs">—</span>
        if (tensionesDisponibles.length === 1) return <span className="text-xs">{tensionesDisponibles[0].value}</span>
        return (
          <select
            value={tipo_tension ?? ''}
            onChange={e => actualizarTipoTension(id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            className="w-full h-6 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer text-center"
            style={{ background: 'var(--clr-surface-a10)' }}
          >
            <option value="">—</option>
            {tensionesDisponibles.map(t => <option key={t.tipo} value={t.tipo}>{t.value}</option>)}
          </select>
        )
      },
    }),
    columnHelper.display({
      id: 'fase',
      header: 'Fase',
      size: 80,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, tipo_tension, fase, es_acometida } = info.row.original
        // La acometida trifásica usa las tres fases igual que un circuito terminal
        // trifásico — mostrar RST también acá, antes de caer al "—" genérico.
        if (tipo_tension === 'tri') return <span className="text-xs text-font-a20">{f1}{sep}{f2}{sep}{f3}</span>
        if (es_acometida)  return <span className="text-xs text-font-a20">—</span>
        if (!tipo_tension)   return <span className="text-surface-tonal-a40 text-xs">—</span>
        const opciones = tipo_tension === 'mono'
          ? [{ v: 'R', lbl: f1 }, { v: 'S', lbl: f2 }, { v: 'T', lbl: f3 }]
          : [{ v: 'RS', lbl: `${f1}${sep}${f2}` }, { v: 'ST', lbl: `${f2}${sep}${f3}` }, { v: 'TR', lbl: `${f3}${sep}${f1}` }]
        return (
          <select
            value={fase ?? ''}
            onChange={e => actualizarFase(id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            className="w-full h-6 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer text-center"
            style={{ background: 'var(--clr-surface-a10)' }}
          >
            <option value="">—</option>
            {opciones.map(({ v, lbl }) => <option key={v} value={v}>{lbl}</option>)}
          </select>
        )
      },
    }),
    // ── Planilla de Análisis de Cargas (CTM-002): cantidad de bocas/tomas, potencia
    // unitaria, potencia instalada, Fs y potencia simultánea ──
    columnHelper.accessor('cantidad_puntos', {
      header: 'Cant.',
      size: 60,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { es_acometida, tipo, tablero_destino_id, id } = info.row.original
        if (es_acometida || (tipo === 'ALIMENTADOR' && tablero_destino_id != null)) return <span className="text-xs text-font-a20">—</span>
        return (
          <CeldaEditable
            valor={info.getValue() != null ? String(info.getValue()) : ''}
            onGuardar={v => { const n = Number(v.trim().replace(',', '.')); actualizarDatosCarga(id, { cantidad_puntos: v.trim() && !isNaN(n) ? n : null }) }}
          />
        )
      },
    }),
    columnHelper.accessor('potencia_unitaria', {
      header: 'P unit. (W)',
      size: 80,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { es_acometida, tipo, tablero_destino_id, id, cantidad_puntos, potencia } = info.row.original
        if (es_acometida || (tipo === 'ALIMENTADOR' && tablero_destino_id != null)) return <span className="text-xs text-font-a20">—</span>
        const v = info.getValue()
        // Aviso si cantidad × potencia unitaria no da la potencia instalada cargada.
        const noCoincide = v != null && cantidad_puntos != null && potencia != null && Math.abs(cantidad_puntos * v / 1000 - potencia) > 0.0005
        return (
          <span title={noCoincide ? `${cantidad_puntos} × ${v} W = ${(cantidad_puntos! * v! / 1000).toFixed(3)} kW, distinto de la potencia instalada cargada (${potencia} kW)` : undefined}
            className="flex items-center gap-1">
            <CeldaEditable
              valor={v != null ? String(v) : ''}
              onGuardar={t => { const n = Number(t.trim().replace(',', '.')); actualizarDatosCarga(id, { potencia_unitaria: t.trim() && !isNaN(n) ? n : null }) }}
            />
            {noCoincide && <span className="text-[11px]" style={{ color: 'var(--clr-warning-a10)' }}>⚠</span>}
          </span>
        )
      },
    }),
    columnHelper.accessor('potencia', {
      header: 'P inst. (kW)',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { es_acometida, tipo, tablero_destino_id } = info.row.original
        const vinculado = tipo === 'ALIMENTADOR' && tablero_destino_id != null
        if (es_acometida || vinculado) {
          const v = info.getValue()
          return <span className="text-xs text-font-a20">{v != null ? v.toFixed(2) : '—'}</span>
        }
        return (
          <CeldaEditable
            valor={info.getValue() !== null ? String(info.getValue()) : ''}
            onGuardar={v => {
              const s = v.trim()
              if (!s) return actualizarPotencia(info.row.original.id, null)
              const isHp = /hp$/i.test(s)
              const num  = Number(s.replace(/hp$/i, '').trim())
              actualizarPotencia(info.row.original.id, isNaN(num) ? null : isHp ? num * 0.7457 : num)
            }}
          />
        )
      },
    }),
    columnHelper.accessor('fs', {
      header: 'Fs',
      size: 60,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { es_acometida, id, fsCargado } = info.row.original
        const v = info.getValue()
        // Acometida: no tiene Fs propio, se muestra el resultante (Σ simultánea / Σ instalada).
        if (es_acometida) return <span className="text-xs text-font-a20" title="Fs resultante: potencia simultánea / instalada">{v != null ? v.toFixed(2) : '—'}</span>
        return (
          <CeldaEditable
            valor={fsCargado != null ? String(fsCargado) : ''}
            onGuardar={t => {
              const n = Number(t.trim().replace(',', '.'))
              if (!t.trim()) return actualizarDatosCarga(id, { factor_simultaneidad: null })
              if (n > 0 && n <= 1) actualizarDatosCarga(id, { factor_simultaneidad: n })
            }}
          />
        )
      },
    }),
    columnHelper.accessor('potenciaSimultanea', {
      header: 'P simult. (kW)',
      size: 100,
      meta: { colType: 'result' } as ColMeta,
      cell: info => <span className="text-xs text-font-a20">{info.getValue() != null ? info.getValue()!.toFixed(2) : '—'}</span>,
    }),
    columnHelper.accessor('FP', {
      header: 'FP',
      size: 70,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { es_acometida, tipo, tablero_destino_id } = info.row.original
        const vinculado = tipo === 'ALIMENTADOR' && tablero_destino_id != null
        if (es_acometida || vinculado) {
          const v = info.getValue()
          return <span className="text-xs text-font-a20">{v != null ? v.toFixed(2) : '—'}</span>
        }
        return (
          <CeldaEditable
            valor={info.getValue() !== null ? String(info.getValue()) : ''}
            onGuardar={v => actualizarFP(info.row.original.id, v.trim() ? Number(v) : null)}
          />
        )
      },
    }),
    columnHelper.accessor('corriente', {
      header: 'Corriente (A)',
      size: 120,
      meta: { colType: 'result' } as ColMeta,
      cell: info => {
        const row = info.row.original
        if (row.es_acometida && row.corrientesFase) {
          const { R, S, T } = row.corrientesFase
          const fmt = (n: number) => n.toFixed(1)
          return (
            <span className="text-xs font-mono">
              {fmt(R)}/{fmt(S)}/{fmt(T)}
            </span>
          )
        }
        const v = info.getValue()
        if (v === null) return <span className="text-surface-tonal-a40 text-xs">—</span>
        return <span className="text-xs">{v.toFixed(2)}</span>
      },
    }),
    columnHelper.accessor('Largo', {
      header: 'Largo (m)',
      size: 90,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => (
        <CeldaEditable
          valor={info.getValue() !== null ? String(info.getValue()) : ''}
          onGuardar={v => actualizarLargo(info.row.original.id, v.trim() ? Number(v) : null)}
        />
      ),
    }),
    columnHelper.accessor('formacion', {
      header: 'Formación',
      size: 180,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const fd = info.row.original.formacionData
        const openModal = (e: React.MouseEvent) => {
          e.stopPropagation()
          setCircuitoEditando(info.row.original.id)
          setFormacionSeleccionada(fd ?? {
            familia_id: '', cable_fase_id: '', cond_por_fase: '1',
            Nfases: '3', familia_neutro_id: '', cable_neutro_id: '', Nneutro: '1',
            familia_tierra_id: '', cable_tierra_id: '', disposicion: '',
          })
          setModalAbierto(true)
        }
        if (!fd) return <span onClick={openModal} className="text-surface-tonal-a40 text-xs cursor-pointer">Sin formación</span>
        return <span className="cursor-pointer underline decoration-dotted" onClick={openModal}>{info.getValue()}</span>
      },
    }),
  ], [tensionesDisponibles, nomenclatura, renombrarCircuito, actualizarDescripcion, actualizarTipo,
      actualizarTipoTension, actualizarFase, actualizarPotencia, actualizarFP, actualizarLargo, actualizarDatosCarga,
      setPendingTipo, setCircuitoEditando, setFormacionSeleccionada, setModalAbierto])
}
