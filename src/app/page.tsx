'use client'
import { useState } from 'react'
import { useProyectos } from '@/context/ProyectosContext'

// ── Home ───────────────────────────────────────────────────────────

export default function Home() {
  const { proyectos, proyectoActivo, setProyectoActivo, crearProyecto } = useProyectos()

  const [creando,     setCreando]     = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')

  const handleCrear = async () => {
    if (!nuevoNombre.trim()) return
    const nuevo = await crearProyecto({ nombre: nuevoNombre.trim() })
    setProyectoActivo(nuevo)
    setCreando(false)
    setNuevoNombre('')
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
              className={`flex flex-col gap-3 rounded-[10px] border px-5 py-4 transition-[border-color,background,box-shadow] duration-150
                ${isActive
                  ? 'bg-primary-a0/10 border-primary-a30 shadow-[0_0_0_1px_var(--clr-primary-a20),0_6px_20px_rgba(0,0,0,0.3)]'
                  : 'bg-surface-tonal-a0 border-surface-tonal-a20 hover:border-surface-tonal-a30'
                }`}
            >
              <div>
                <div className="text-[15px] font-semibold text-font-a0 leading-snug">{p.nombre}</div>
                {p.descripcion && (
                  <div className="text-xs text-surface-tonal-a40 mt-0.5 leading-relaxed">{p.descripcion}</div>
                )}
              </div>

              <div className="text-[12px] text-surface-tonal-a40">
                {p.tableros.length === 0
                  ? 'Sin tableros'
                  : `${p.tableros.length} tablero${p.tableros.length !== 1 ? 's' : ''}`}
              </div>

              <div className="mt-auto">
                {isActive ? (
                  <span className="flex items-center justify-center gap-1.5 rounded-[6px] py-1.5 bg-primary-a0/15 text-primary-a30 text-[12px] font-semibold">
                    ✓ Proyecto activo
                  </span>
                ) : (
                  <button
                    onClick={() => setProyectoActivo(p)}
                    className="w-full bg-transparent hover:bg-primary-a0/10 border border-primary-a20 rounded-[6px] text-primary-a20 hover:text-primary-a10 text-[12px] font-medium py-1.5 cursor-pointer transition-colors"
                  >
                    Activar proyecto
                  </button>
                )}
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
    </div>
  )
}
