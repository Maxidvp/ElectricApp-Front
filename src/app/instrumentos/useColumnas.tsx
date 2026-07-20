'use client'
import { useMemo } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import CeldaEditable from '@/components/CeldaEditable'
import type { LazoInstrumentacion } from '@/context/ProyectosContext'
import { TIPOS_SENAL, type ColMeta } from './types'

type Acciones = {
  actualizarCampo: (id: number, campo: keyof LazoInstrumentacion, valor: string | number | null) => void
  abrirCableModal: (lazo: LazoInstrumentacion) => void
}

const columnHelper = createColumnHelper<LazoInstrumentacion>()

const selectCx = 'w-full h-7 px-1 text-xs rounded-sm text-font-a0 border border-surface-tonal-a20 outline-none cursor-pointer'

function textoEditable(campo: keyof LazoInstrumentacion, actualizarCampo: Acciones['actualizarCampo']) {
  return (info: any) => (
    <CeldaEditable
      valor={info.getValue() ?? ''}
      onGuardar={v => actualizarCampo(info.row.original.id, campo, v.trim() || null)}
    />
  )
}

function numeroEditable(campo: keyof LazoInstrumentacion, actualizarCampo: Acciones['actualizarCampo']) {
  return (info: any) => (
    <CeldaEditable
      valor={info.getValue() !== null && info.getValue() !== undefined ? String(info.getValue()) : ''}
      onGuardar={v => actualizarCampo(info.row.original.id, campo, v.trim() ? Number(v) : null)}
    />
  )
}

export function useColumnas(acciones: Acciones) {
  const { actualizarCampo, abrirCableModal } = acciones

  return useMemo(() => [
    columnHelper.accessor('tag_lazo', {
      header: 'Tag',
      size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => (
        <CeldaEditable
          valor={info.getValue()}
          onGuardar={v => actualizarCampo(info.row.original.id, 'tag_lazo', v.trim() || info.getValue())}
        />
      ),
    }),
    columnHelper.accessor('descripcion', {
      header: 'Descripción',
      size: 200,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('descripcion', actualizarCampo),
    }),
    columnHelper.accessor('tipo_senal', {
      header: 'Señal',
      size: 90,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => (
        <select
          value={info.getValue() ?? ''}
          onChange={e => actualizarCampo(info.row.original.id, 'tipo_senal', e.target.value || null)}
          onClick={e => e.stopPropagation()}
          className={selectCx}
          style={{ background: 'var(--clr-surface-a10)' }}
        >
          <option value="">—</option>
          {TIPOS_SENAL.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
        </select>
      ),
    }),
    columnHelper.accessor('variable_proceso', {
      header: 'Variable de proceso',
      size: 150,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('variable_proceso', actualizarCampo),
    }),
    columnHelper.accessor('protocolo', {
      header: 'Protocolo',
      size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('protocolo', actualizarCampo),
    }),
    columnHelper.accessor('rango_min', {
      header: 'Rango mín.',
      size: 90,
      meta: { colType: 'editable' } as ColMeta,
      cell: numeroEditable('rango_min', actualizarCampo),
    }),
    columnHelper.accessor('rango_max', {
      header: 'Rango máx.',
      size: 90,
      meta: { colType: 'editable' } as ColMeta,
      cell: numeroEditable('rango_max', actualizarCampo),
    }),
    columnHelper.accessor('unidad', {
      header: 'Unidad',
      size: 90,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('unidad', actualizarCampo),
    }),
    columnHelper.accessor('direccion_plc', {
      header: 'Dirección PLC',
      size: 130,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('direccion_plc', actualizarCampo),
    }),
    columnHelper.accessor('ubicacion_campo', {
      header: 'Ubicación en campo',
      size: 150,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('ubicacion_campo', actualizarCampo),
    }),
    columnHelper.accessor('fabricante', {
      header: 'Fabricante',
      size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('fabricante', actualizarCampo),
    }),
    columnHelper.accessor('modelo', {
      header: 'Modelo',
      size: 120,
      meta: { colType: 'editable' } as ColMeta,
      cell: textoEditable('modelo', actualizarCampo),
    }),
    columnHelper.display({
      id: 'cable',
      header: 'Cable',
      size: 220,
      meta: { colType: 'editable' } as ColMeta,
      cell: info => {
        const lazo = info.row.original
        const openModal = (e: React.MouseEvent) => { e.stopPropagation(); abrirCableModal(lazo) }
        if (!lazo.cable) return <span onClick={openModal} className="text-surface-tonal-a40 text-xs cursor-pointer">Sin cable</span>
        return (
          <span onClick={openModal} className="text-xs cursor-pointer underline decoration-dotted">
            {lazo.cantidad_cables ?? 1} × {lazo.cable.nombre}
          </span>
        )
      },
    }),
  ], [actualizarCampo, abrirCableModal])
}
