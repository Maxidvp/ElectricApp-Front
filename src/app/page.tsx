'use client'
import { useState } from 'react'
import { useProyectos, type ProyectoMeta } from '@/context/ProyectosContext'
import { useCables } from '@/context/CablesContext'
import type { FormatoFormacion } from '@/services/proyectos'

// ── Estilos compartidos ────────────────────────────────────────────

const cx = {
  input:   'h-[34px] border border-surface-tonal-a30 rounded-[7px] px-[10px] text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 focus:shadow-[0_0_0_3px_rgba(64,119,209,0.2)]',
  label:   'text-xs text-font-a20',
  field:   'flex flex-col gap-[5px]',
  section: 'border border-surface-tonal-a20 rounded-[10px] overflow-hidden',
  hdr:     'flex items-center gap-2 px-[14px] py-2 bg-surface-tonal-a0 border-b border-surface-tonal-a20 text-xs font-medium text-font-a20',
  grid:    'p-3 grid gap-[10px] bg-surface-a10',
}

// ── Vista de edición de proyecto ───────────────────────────────────

type Seccion = 'general' | 'cables' | 'expresiones'

const FORMATOS: { id: FormatoFormacion; label: string; desc: string }[] = [
  { id: 'ingles',    label: 'Sistema inglés',    desc: 'Ej: 4C#10 AWG (3P-N)+1C#10 AWG (G)' },
  { id: 'extendida', label: 'Expresión extendida', desc: 'A IMPLEMENTAR' },
  { id: 'copaipa',   label: 'Expresión COPAIPA',   desc: 'A IMPLEMENTAR' },
  { id: 'resumida',  label: 'Expresión resumida',  desc: 'A IMPLEMENTAR' },
]

function EditarProyecto({ proyecto, onVolver }: { proyecto: ProyectoMeta; onVolver: () => void }) {
  const { actualizarProyecto, agregarFamiliaProyecto, quitarFamiliaProyecto, proyectoActivo } = useProyectos()
  const { familias: todasLasFamilias } = useCables()

  const [seccion,   setSeccion]   = useState<Seccion>('general')
  const [nombre,    setNombre]    = useState(proyecto.nombre)
  const [desc,      setDesc]      = useState(proyecto.descripcion ?? '')
  const [dirty,     setDirty]     = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardado,  setGuardado]  = useState(false)

  const handleGuardar = async () => {
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      await actualizarProyecto(proyecto.id, { nombre: nombre.trim(), descripcion: desc.trim() || null })
      setDirty(false)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2000)
    } finally {
      setGuardando(false)
    }
  }

  const familiaIds = proyectoActivo?.familia_ids ?? proyecto.familia_ids ?? []

  const formatoActivo: FormatoFormacion = (proyectoActivo?.formato_formacion ?? proyecto.formato_formacion ?? 'ingles') as FormatoFormacion

  const secciones: { id: Seccion; label: string }[] = [
    { id: 'general',     label: 'General' },
    { id: 'cables',      label: 'Cables' },
    { id: 'expresiones', label: 'Expresiones' },
  ]

  return (
    <div className="min-h-dvh bg-surface-a10 flex flex-col">

      {/* Header */}
      <div className="bg-surface-tonal-a0 border-b border-surface-tonal-a20 px-5 py-3 flex items-center gap-3">
        <button
          onClick={onVolver}
          className="flex items-center gap-1.5 text-[13px] text-surface-tonal-a40 hover:text-font-a0 bg-transparent border-none cursor-pointer transition-colors px-0"
        >
          ← Proyectos
        </button>
        <span className="text-surface-tonal-a30">|</span>
        <span className="text-[14px] font-semibold text-font-a0">{proyecto.nombre}</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-44 shrink-0 bg-surface-tonal-a0 border-r border-surface-tonal-a20 flex flex-col pt-3 gap-0.5 px-2">
          {secciones.map(s => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={`w-full text-left px-3 py-2 rounded-[7px] text-[13px] cursor-pointer border-none transition-colors ${
                seccion === s.id
                  ? 'bg-info-a0/20 text-info-a10 font-medium'
                  : 'bg-transparent text-font-a20 hover:bg-surface-tonal-a10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg flex flex-col gap-5">

            {seccion === 'general' && (<>
              <div className={cx.section}>
                <div className={cx.hdr}>Información del proyecto</div>
                <div className={`${cx.grid} grid-cols-1`}>
                  <div className={cx.field}>
                    <label className={cx.label}>
                      Nombre <span className="text-danger-a10 ml-0.5">*</span>
                    </label>
                    <input
                      className={cx.input}
                      value={nombre}
                      onChange={e => { setNombre(e.target.value); setDirty(true); setGuardado(false) }}
                      placeholder="Nombre del proyecto"
                    />
                  </div>
                  <div className={cx.field}>
                    <label className={cx.label}>Descripción</label>
                    <input
                      className={cx.input}
                      value={desc}
                      onChange={e => { setDesc(e.target.value); setDirty(true); setGuardado(false) }}
                      placeholder="Descripción opcional"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleGuardar}
                  disabled={!dirty || guardando || !nombre.trim()}
                  className="h-[34px] px-5 rounded-[7px] text-[13px] font-medium cursor-pointer border-none transition-colors bg-primary-a0 hover:bg-primary-a10 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {guardando ? 'Guardando…' : guardado ? 'Guardado ✓' : 'Guardar'}
                </button>
              </div>
            </>)}

            {seccion === 'expresiones' && (
              <div className={cx.section}>
                <div className={cx.hdr}>Formato de expresión de formaciones</div>
                <div className="p-3 flex flex-col gap-2 bg-surface-a10">
                  {FORMATOS.map(f => {
                    const activo = formatoActivo === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => actualizarProyecto(proyecto.id, { nombre: proyecto.nombre, descripcion: proyecto.descripcion, formato_formacion: f.id })}
                        className={`w-full text-left flex flex-col gap-0.5 px-3 py-2.5 rounded-[7px] border cursor-pointer transition-colors ${
                          activo
                            ? 'border-info-a10 bg-info-a0/10'
                            : 'border-surface-tonal-a20 bg-surface-tonal-a0 hover:bg-surface-tonal-a10'
                        }`}
                      >
                        <span className={`text-[13px] font-medium ${activo ? 'text-info-a10' : 'text-font-a0'}`}>
                          {activo ? '● ' : '○ '}{f.label}
                        </span>
                        <span className="text-[11px] text-surface-tonal-a40 font-mono">{f.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {seccion === 'cables' && (
              <div className={cx.section}>
                <div className={cx.hdr}>Cables del proyecto</div>
                <div className="p-3 flex flex-col gap-2 bg-surface-a10">
                  {todasLasFamilias.length === 0 && (
                    <p className="text-xs text-surface-tonal-a40 py-2">No hay familias de cables cargadas.</p>
                  )}
                  {todasLasFamilias.map(f => {
                    const asignada = familiaIds.includes(f.id)
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-[7px] border border-surface-tonal-a20 bg-surface-tonal-a0">
                        <span className="text-[13px] text-font-a0">{f.nombre}</span>
                        <button
                          onClick={() => asignada ? quitarFamiliaProyecto(f.id) : agregarFamiliaProyecto(f.id)}
                          className={`h-[28px] px-3 rounded-[6px] text-[12px] font-medium cursor-pointer border-none transition-colors ${
                            asignada
                              ? 'bg-danger-a0/15 text-danger-a10 hover:bg-danger-a0/25'
                              : 'bg-info-a0/15 text-info-a10 hover:bg-info-a0/25'
                          }`}
                        >
                          {asignada ? '− Quitar' : '+ Agregar'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  )
}

// ── Home ───────────────────────────────────────────────────────────

export default function Home() {
  const {
    proyectos, proyectoActivo, setProyectoActivo,
    crearProyecto, eliminarProyecto,
  } = useProyectos()

  const [editandoId,   setEditandoId]   = useState<number | null>(null)
  const [confirmId,    setConfirmId]    = useState<number | null>(null)
  const [creando,      setCreando]      = useState(false)
  const [nuevoNombre,  setNuevoNombre]  = useState('')

  const proyectoEditando = editandoId !== null ? proyectos.find(p => p.id === editandoId) ?? null : null

  if (proyectoEditando) {
    return <EditarProyecto proyecto={proyectoEditando} onVolver={() => setEditandoId(null)} />
  }

  const handleCrear = async () => {
    if (!nuevoNombre.trim()) return
    const nuevo = await crearProyecto({ nombre: nuevoNombre.trim() })
    setProyectoActivo(nuevo)
    setCreando(false)
    setNuevoNombre('')
  }

  const confirmarEliminar = async () => {
    if (!confirmId) return
    if (proyectoActivo?.id === confirmId) setProyectoActivo(null)
    await eliminarProyecto(confirmId)
    setConfirmId(null)
  }

  return (
    <div className="min-h-dvh bg-surface-a0 flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <h1 className="text-[22px] font-semibold text-font-a0 m-0">Electric App</h1>
        <p className="text-[13px] text-surface-tonal-a40 mt-1.5">Seleccioná un proyecto para comenzar</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 w-full max-w-200">

        {proyectos.map(p => {
          const isActive = proyectoActivo?.id === p.id

          return (
            <div
              key={p.id}
              onClick={() => { if (!isActive) setProyectoActivo(p) }}
              className={`relative flex flex-col gap-3 rounded-[10px] border px-5 py-4 transition-[border-color,background] duration-150 select-none cursor-pointer
                ${isActive
                  ? 'bg-surface-tonal-a10 border-primary-a20'
                  : 'bg-surface-tonal-a0 border-surface-tonal-a20 hover:bg-surface-tonal-a10 hover:border-surface-tonal-a30'
                }`}
            >
              {isActive && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold text-primary-a30 bg-primary-a0/15 px-2 py-0.5 rounded-full">
                  activo
                </span>
              )}

              <div>
                <div className="text-[15px] font-semibold text-font-a0 pr-12 leading-snug">{p.nombre}</div>
                {p.descripcion && (
                  <div className="text-xs text-surface-tonal-a40 mt-0.5 leading-relaxed">{p.descripcion}</div>
                )}
              </div>

              <div className="text-[12px] text-surface-tonal-a40">
                {p.tableros.length === 0
                  ? 'Sin tableros'
                  : `${p.tableros.length} tablero${p.tableros.length !== 1 ? 's' : ''}`}
              </div>

              <div className="flex gap-2 mt-auto" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setEditandoId(p.id)}
                  className="flex-1 bg-transparent hover:bg-surface-tonal-a20 border border-surface-tonal-a30 rounded-[6px] text-font-a10 text-[12px] py-1.5 cursor-pointer transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => setConfirmId(p.id)}
                  className="flex-1 bg-transparent hover:bg-danger-a0/10 border border-surface-tonal-a30 hover:border-danger-a10 rounded-[6px] text-surface-tonal-a40 hover:text-danger-a10 text-[12px] py-1.5 cursor-pointer transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          )
        })}

        {/* Tarjeta nueva */}
        {creando ? (
          <div className="flex flex-col gap-2 rounded-[10px] border border-surface-tonal-a20 bg-surface-tonal-a0 px-5 py-4">
            <input
              autoFocus
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCrear(); if (e.key === 'Escape') { setCreando(false); setNuevoNombre('') } }}
              placeholder="Nombre del proyecto"
              className="w-full bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[6px] text-font-a0 text-[13px] py-[5px] px-2.5 outline-none focus:border-primary-a20"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCrear}
                className="flex-1 bg-primary-a0 hover:bg-primary-a10 border-none rounded-[6px] text-white text-[12px] py-1.5 cursor-pointer transition-colors"
              >
                Crear
              </button>
              <button
                onClick={() => { setCreando(false); setNuevoNombre('') }}
                className="flex-1 bg-transparent hover:bg-surface-tonal-a20 border border-surface-tonal-a30 rounded-[6px] text-font-a10 text-[12px] py-1.5 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreando(true)}
            className="flex flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-surface-tonal-a30 bg-transparent px-5 py-4 min-h-[100px] text-surface-tonal-a40 hover:text-font-a10 hover:border-surface-tonal-a40 transition-colors cursor-pointer"
          >
            <span className="text-[22px] leading-none">+</span>
            <span className="text-[12px]">Nuevo proyecto</span>
          </button>
        )}
      </div>

      {/* Modal eliminación */}
      {confirmId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmId(null)}>
          <div className="bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[12px] p-6 w-[320px] flex flex-col gap-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)]" onClick={e => e.stopPropagation()}>
            <div>
              <div className="text-[15px] font-semibold text-font-a0">¿Eliminar proyecto?</div>
              <div className="text-[13px] text-surface-tonal-a40 mt-1">
                Se eliminarán todos los tableros y circuitos asociados. Esta acción no se puede deshacer.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmarEliminar}
                className="flex-1 bg-danger-a0 hover:opacity-85 border-none rounded-[7px] text-white text-[13px] py-2 cursor-pointer transition-opacity"
              >
                Eliminar
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 bg-transparent hover:bg-surface-tonal-a20 border border-surface-tonal-a30 rounded-[7px] text-font-a10 text-[13px] py-2 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
