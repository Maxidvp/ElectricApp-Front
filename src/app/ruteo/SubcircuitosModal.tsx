'use client'
import { useState } from 'react'
import FormacionModal from '@/components/FormacionModal'
import ConfirmModal   from '@/components/ConfirmModal'
import { useProyectos } from '@/context/ProyectosContext'
import { useCables } from '@/context/CablesContext'
import type { Circuito, Formacion } from '@/context/types'
import type { FormacionData } from '@/app/cargas/types'

interface Props {
  parentId:     number
  parentNombre: string
  onCerrar:     () => void
}

const FASE_LABELS: Record<string, [string, string, string]> = {
  RST:    ['R',  'S',  'T'],
  L1L2L3: ['L1', 'L2', 'L3'],
  ABC:    ['A',  'B',  'C'],
  UVW:    ['U',  'V',  'W'],
}

function formacionToData(f: Formacion): FormacionData {
  return {
    familia_id:        String(f.cable.familia_id),
    cable_fase_id:     String(f.cable_id),
    cond_por_fase:     String(f.cond_por_fase),
    Nfases:            String(f.Nfases),
    familia_neutro_id: String(f.cable_neutro?.familia_id ?? ''),
    cable_neutro_id:   String(f.cable_neutro_id ?? ''),
    Nneutro:           String(f.Nneutro),
    familia_tierra_id: String(f.cable_tierra?.familia_id ?? ''),
    cable_tierra_id:   String(f.cable_tierra_id ?? ''),
    disposicion:       f.disposicion ?? '',
  }
}

// Precarga de formación para un ramal sin cable asignado todavía: 1 fase + 1
// neutro + 1 tierra (un ramal monofásico siempre los tiene; la tierra se puede
// quitar a mano si no aplica), con la sección más chica disponible — un ramal
// cuelga de un circuito troncal más grueso, así que arrancar por el calibre
// más chico es la base más razonable. Recuerda el último ajuste manual del
// usuario (a nivel módulo, como `globalClipboard` en FormacionModal) para
// precargar el próximo ramal con eso en vez de volver a calcular el default.
let lastRamalFormacion: FormacionData | null = null

async function computeDefaultRamalFormacion(
  parent: Circuito | undefined,
  familiasFiltradas: { id: number }[],
  getCablesDeFamilia: (familiaId: number) => Promise<{ id: number; seccion_f: string; diametro: number | null }[]>,
): Promise<FormacionData | undefined> {
  if (lastRamalFormacion) return lastRamalFormacion
  const familiaId = parent?.formacion?.cable.familia_id ?? familiasFiltradas[0]?.id
  if (!familiaId) return undefined
  const cables = await getCablesDeFamilia(familiaId)
  if (cables.length === 0) return undefined
  // Ordenar por diámetro físico, no por seccion_f: en AWG el número de calibre es
  // inverso al tamaño real (14 AWG es más chico que 1 AWG), así que parsear
  // seccion_f como número daría el cable más grueso en vez del más fino.
  const masChico = [...cables].sort((a, b) => (a.diametro ?? Infinity) - (b.diametro ?? Infinity))[0]
  return {
    familia_id:        String(familiaId),
    cable_fase_id:     String(masChico.id),
    cond_por_fase:     '1',
    Nfases:            '1',
    familia_neutro_id: '',
    cable_neutro_id:   String(masChico.id),
    Nneutro:           '1',
    familia_tierra_id: String(familiaId),
    cable_tierra_id:   String(masChico.id),
    disposicion:       '',
  }
}

export function SubcircuitosModal({ parentId, parentNombre, onCerrar }: Props) {
  const {
    tableros, proyectoActivo,
    renombrarCircuito, eliminarCircuito, actualizarFormacion, actualizarFase, reordenarSubcircuitos,
  } = useProyectos()
  const { familiasFiltradas, getCablesDeFamilia } = useCables()

  const [f1, f2, f3] = FASE_LABELS[proyectoActivo?.nomenclatura_fases ?? 'RST'] ?? FASE_LABELS.RST

  const hijos: Circuito[] = tableros
    .flatMap(t => t.circuitos)
    .filter(c => c.parent_id === parentId)
    .sort((a, b) => a.orden - b.orden)

  const [editandoId,    setEditandoId]    = useState<number | null>(null)
  const [editandoNombre, setEditandoNombre] = useState('')
  const [formacionCirc, setFormacionCirc] = useState<Circuito | null>(null)
  const [ramalDefault,  setRamalDefault]  = useState<FormacionData | undefined>(undefined)
  const [confirmarElim, setConfirmarElim] = useState<number | null>(null)

  const abrirFormacion = async (h: Circuito) => {
    if (h.role === 'ramal' && !h.formacion) {
      const parent = tableros.flatMap(t => t.circuitos).find(c => c.id === parentId)
      setRamalDefault(await computeDefaultRamalFormacion(parent, familiasFiltradas, getCablesDeFamilia))
    } else {
      setRamalDefault(undefined)
    }
    setFormacionCirc(h)
  }

  const commitNombre = (id: number) => {
    const trimmed = editandoNombre.trim()
    if (trimmed) renombrarCircuito(id, trimmed)
    setEditandoId(null)
  }

  const mover = (id: number, dir: -1 | 1) => {
    const idx = hijos.findIndex(h => h.id === id)
    if (idx === -1) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= hijos.length) return
    const reordenado = [...hijos]
    ;[reordenado[idx], reordenado[newIdx]] = [reordenado[newIdx], reordenado[idx]]
    reordenarSubcircuitos(reordenado.map(h => h.id))
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]"
      onClick={onCerrar}
    >
      <div
        className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] p-5 flex flex-col gap-4 w-[420px] max-w-[95vw] max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-font-a0">
            Subcircuitos de <span className="text-info-a10">{parentNombre}</span>
          </h2>
          <button
            onClick={onCerrar}
            className="text-surface-tonal-a40 hover:text-font-a0 bg-transparent border-none text-xl leading-none cursor-pointer"
          >×</button>
        </div>

        {/* Lista */}
        {hijos.length === 0 ? (
          <p className="text-[12px] text-surface-tonal-a40 py-2">Sin subcircuitos creados.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {hijos.map((h, i) => (
              <div
                key={h.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-tonal-a10 border border-surface-tonal-a20"
              >
                {/* Flechas orden */}
                <div className="flex flex-col">
                  <button
                    disabled={i === 0}
                    onClick={() => mover(h.id, -1)}
                    className="text-[10px] text-surface-tonal-a40 hover:text-font-a0 disabled:opacity-25 bg-transparent border-none cursor-pointer leading-tight px-0.5"
                  >▲</button>
                  <button
                    disabled={i === hijos.length - 1}
                    onClick={() => mover(h.id, 1)}
                    className="text-[10px] text-surface-tonal-a40 hover:text-font-a0 disabled:opacity-25 bg-transparent border-none cursor-pointer leading-tight px-0.5"
                  >▼</button>
                </div>

                {/* Badge role */}
                <span className="text-[10px] text-surface-tonal-a30 w-14 shrink-0">
                  {h.role === 'retorno' ? '↩ ret.' : h.role === 'combinacion' ? '⟷ comb.' : '↳ ram.'}
                </span>

                {/* Fase (solo ramales) */}
                {h.role === 'ramal' && (
                  <select
                    value={h.fase ?? ''}
                    onChange={e => actualizarFase(h.id, e.target.value || null)}
                    className="shrink-0 h-6 px-1 text-[11px] rounded border border-surface-tonal-a30 bg-surface-tonal-a20 text-font-a0 outline-none cursor-pointer"
                  >
                    <option value="">—</option>
                    <option value="R">{f1}</option>
                    <option value="S">{f2}</option>
                    <option value="T">{f3}</option>
                  </select>
                )}

                {/* Nombre editable */}
                {editandoId === h.id ? (
                  <input
                    autoFocus
                    value={editandoNombre}
                    onChange={e => setEditandoNombre(e.target.value)}
                    onBlur={() => commitNombre(h.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitNombre(h.id)
                      if (e.key === 'Escape') setEditandoId(null)
                    }}
                    className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-surface-tonal-a20 border border-info-a10 rounded outline-none text-font-a0"
                  />
                ) : (
                  <span
                    className="flex-1 min-w-0 text-xs text-font-a0 cursor-text truncate hover:text-info-a10"
                    title="Click para renombrar"
                    onClick={() => { setEditandoId(h.id); setEditandoNombre(h.circuito) }}
                  >
                    {h.circuito}
                  </span>
                )}

                {/* Botón formación */}
                <button
                  onClick={() => abrirFormacion(h)}
                  className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border cursor-pointer bg-transparent transition-[color,border-color] ${
                    h.formacion
                      ? 'border-success-a10 text-success-a10 hover:border-success-a0'
                      : 'border-surface-tonal-a30 text-surface-tonal-a40 hover:text-font-a0 hover:border-surface-tonal-a40'
                  }`}
                >
                  {h.formacion ? 'Cable ✓' : 'Cable'}
                </button>

                {/* Eliminar */}
                <button
                  onClick={() => setConfirmarElim(h.id)}
                  className="shrink-0 text-danger-a10 hover:text-danger-a0 bg-transparent border-none cursor-pointer text-base leading-none px-0.5"
                  title="Eliminar subcircuito"
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FormacionModal anidado */}
      {formacionCirc && (
        <FormacionModal
          formacionInicial={formacionCirc.formacion ? formacionToData(formacionCirc.formacion) : ramalDefault}
          tipoTension={formacionCirc.tipo_tension}
          onGuardar={(data, cables) => {
            if (formacionCirc.role === 'ramal') lastRamalFormacion = data
            actualizarFormacion(formacionCirc.id, {
              cable_id:        Number(data.cable_fase_id),
              cond_por_fase:   Number(data.cond_por_fase),
              Nfases:          Number(data.Nfases),
              Nneutro:         Number(data.Nneutro),
              cable_neutro_id: data.cable_neutro_id ? Number(data.cable_neutro_id) : null,
              cable_tierra_id: data.cable_tierra_id ? Number(data.cable_tierra_id) : null,
              disposicion:     data.disposicion || null,
            }, cables)
            setFormacionCirc(null)
          }}
          onCerrar={() => setFormacionCirc(null)}
        />
      )}

      {/* ConfirmModal eliminación */}
      {confirmarElim !== null && (
        <ConfirmModal
          mensaje="¿Eliminar este subcircuito? Los segmentos asignados quedarán sin él."
          labelConfirmar="Eliminar"
          onConfirmar={() => { eliminarCircuito(confirmarElim); setConfirmarElim(null) }}
          onCancelar={() => setConfirmarElim(null)}
        />
      )}
    </div>
  )
}
