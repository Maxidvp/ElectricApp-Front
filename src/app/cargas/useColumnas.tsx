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
  setPendingTipo:       (val: { id: number; nuevoTipo: string | null } | null) => void
  setCircuitoEditando:  (id: number | null) => void
  setFormacionSeleccionada: (data: FormacionData | null) => void
  setModalAbierto:      (open: boolean) => void
}

const columnHelper = createColumnHelper<CircuitoRow>()

export function useColumnas(tensionesDisponibles: TensionOpt[], acciones: Acciones) {
  const {
    renombrarCircuito, actualizarDescripcion, actualizarTipo,
    actualizarTipoTension, actualizarFase, actualizarPotencia,
    actualizarFP, actualizarLargo,
    setPendingTipo, setCircuitoEditando, setFormacionSeleccionada, setModalAbierto,
  } = acciones

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
        const { id, tipo } = info.row.original
        return (
          <select
            value={tipo ?? ''}
            onChange={e => {
              const nuevo = e.target.value || null
              if (nuevo === 'ALIMENTADOR' || tipo === 'ALIMENTADOR')
                setPendingTipo({ id, nuevoTipo: nuevo })
              else
                actualizarTipo(id, nuevo)
            }}
            onClick={e => e.stopPropagation()}
            className="w-full h-7 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer"
            style={{ background: 'var(--clr-surface-a10)' }}
          >
            <option value="">—</option>
            {TIPOS_CIRCUITO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )
      },
    }),
    columnHelper.display({
      id: 'tension',
      header: 'Tensión (V)',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const { id, tipo_tension, es_alimentador } = info.row.original
        if (es_alimentador) {
          const v = tensionesDisponibles.find(t => t.tipo === tipo_tension)?.value
          return <span className="text-xs text-font-a20 block text-right pr-1">{v ?? '—'}</span>
        }
        if (tensionesDisponibles.length === 0) return <span className="text-surface-tonal-a40 text-xs">—</span>
        if (tensionesDisponibles.length === 1) return <span className="text-xs">{tensionesDisponibles[0].value}</span>
        return (
          <select
            value={tipo_tension ?? ''}
            onChange={e => actualizarTipoTension(id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            className="w-full h-7 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer"
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
        const { id, tipo_tension, fase, es_alimentador } = info.row.original
        if (es_alimentador)  return <span className="text-xs text-font-a20 block text-center">—</span>
        if (!tipo_tension)   return <span className="text-surface-tonal-a40 text-xs">—</span>
        if (tipo_tension === 'tri') return <span className="text-xs text-font-a20">RST</span>
        const opciones = tipo_tension === 'mono' ? ['R', 'S', 'T'] : ['RS', 'ST', 'TR']
        return (
          <select
            value={fase ?? ''}
            onChange={e => actualizarFase(id, e.target.value || null)}
            onClick={e => e.stopPropagation()}
            className="w-full h-7 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer"
            style={{ background: 'var(--clr-surface-a10)' }}
          >
            <option value="">—</option>
            {opciones.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        )
      },
    }),
    columnHelper.accessor('potencia', {
      header: 'Potencia (kW)',
      size: 110,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        if (info.row.original.es_alimentador) {
          const v = info.getValue()
          return <span className="text-xs text-font-a20 block text-right pr-1">{v != null ? v.toFixed(2) : '—'}</span>
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
    columnHelper.accessor('FP', {
      header: 'FP',
      size: 70,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        if (info.row.original.es_alimentador) {
          const v = info.getValue()
          return <span className="text-xs text-font-a20 block text-right pr-1">{v != null ? v.toFixed(2) : '—'}</span>
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
      size: 110,
      meta: { colType: 'result' } as ColMeta,
      cell: info => {
        const v = info.getValue()
        if (v === null) return <span className="text-surface-tonal-a40 text-xs">—</span>
        return <span className="text-xs">{v.toFixed(2)}</span>
      },
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
            Nfases: '3', cable_neutro_id: '', Nneutro: '1',
            familia_tierra_id: '', cable_tierra_id: '', disposicion: '',
          })
          setModalAbierto(true)
        }
        if (!fd) return <span onClick={openModal} className="text-surface-tonal-a40 text-xs cursor-pointer">Sin formación</span>
        return <span className="cursor-pointer underline decoration-dotted" onClick={openModal}>{info.getValue()}</span>
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
  ], [tensionesDisponibles, renombrarCircuito, actualizarDescripcion, actualizarTipo,
      actualizarTipoTension, actualizarFase, actualizarPotencia, actualizarFP, actualizarLargo,
      setPendingTipo, setCircuitoEditando, setFormacionSeleccionada, setModalAbierto])
}
