'use client'
import { useState } from 'react'
import { useProyectos, type ProyectoMeta } from '@/context/ProyectosContext'

export default function Home() {
  const {
    proyectos, proyectoActivo, setProyectoActivo,
    crearProyecto, actualizarProyecto, eliminarProyecto,
  } = useProyectos()

  const [editandoId,  setEditandoId]  = useState<number | null>(null)
  const [editNombre,  setEditNombre]  = useState('')
  const [editDesc,    setEditDesc]    = useState('')
  const [confirmId,   setConfirmId]   = useState<number | null>(null)
  const [creando,     setCreando]     = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')

  const iniciarEdicion = (p: ProyectoMeta) => {
    setEditandoId(p.id)
    setEditNombre(p.nombre)
    setEditDesc(p.descripcion ?? '')
  }

  const guardarEdicion = async () => {
    if (!editandoId || !editNombre.trim()) return
    await actualizarProyecto(editandoId, { nombre: editNombre.trim(), descripcion: editDesc.trim() || null })
    setEditandoId(null)
  }

  const cancelarEdicion = () => setEditandoId(null)

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
          const isActive  = proyectoActivo?.id === p.id
          const isEditing = editandoId === p.id

          return (
            <div
              key={p.id}
              onClick={() => { if (!isEditing && !isActive) setProyectoActivo(p) }}
              className={`relative flex flex-col gap-3 rounded-[10px] border px-5 py-4 transition-[border-color,background] duration-150 select-none
                ${isEditing ? 'cursor-default' : 'cursor-pointer'}
                ${isActive
                  ? 'bg-surface-tonal-a10 border-primary-a20'
                  : 'bg-surface-tonal-a0 border-surface-tonal-a20 hover:bg-surface-tonal-a10 hover:border-surface-tonal-a30'
                }`}
            >
              {isActive && !isEditing && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold text-primary-a30 bg-primary-a0/15 px-2 py-0.5 rounded-full">
                  activo
                </span>
              )}

              {isEditing ? (
                <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(); if (e.key === 'Escape') cancelarEdicion() }}
                    placeholder="Nombre"
                    className="w-full bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[6px] text-font-a0 text-[13px] py-[5px] px-2.5 outline-none focus:border-primary-a20"
                  />
                  <input
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(); if (e.key === 'Escape') cancelarEdicion() }}
                    placeholder="Descripción (opcional)"
                    className="w-full bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[6px] text-font-a0 text-[13px] py-[5px] px-2.5 outline-none focus:border-primary-a20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={guardarEdicion}
                      className="flex-1 bg-primary-a0 hover:bg-primary-a10 border-none rounded-[6px] text-white text-[12px] py-1.5 cursor-pointer transition-colors"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={cancelarEdicion}
                      className="flex-1 bg-transparent hover:bg-surface-tonal-a20 border border-surface-tonal-a30 rounded-[6px] text-font-a10 text-[12px] py-1.5 cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                      onClick={() => iniciarEdicion(p)}
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
                </>
              )}
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

      {/* Modal de confirmación de eliminación */}
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
