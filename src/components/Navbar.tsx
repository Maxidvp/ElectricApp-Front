'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProyectos } from '@/context/ProyectosContext'

const NAV_LINKS = [
  { href: '/tableros',    label: 'Tableros'    },
  { href: '/cargas',      label: 'Cargas'      },
  { href: '/caidas',          label: 'Caídas'          },
  { href: '/cortocircuitos',  label: 'Cortocircuitos'  },
  { href: '/ruteo',       label: 'Ruteo'       },
  { href: '/ocupaciones', label: 'Ocupaciones' },
  { href: '/cables',      label: 'Cables'      },
  { href: '/locales',     label: 'Locales'     },
  { href: '/importador',  label: 'Importador'  },
]

export default function Navbar() {
  const { proyectos, proyectoActivo, setProyectoActivo, crearProyecto } = useProyectos()
  const pathname  = usePathname()
  const [open, setOpen]               = useState(false)
  const [creando, setCreando]         = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const dropRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false); setCreando(false); setNuevoNombre('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => { if (creando) inputRef.current?.focus() }, [creando])

  const seleccionar = (p: typeof proyectoActivo) => {
    setProyectoActivo(p); setOpen(false); setCreando(false); setNuevoNombre('')
  }

  const confirmarNuevo = async () => {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    const nuevo = await crearProyecto({ nombre })
    setProyectoActivo(nuevo); setOpen(false); setCreando(false); setNuevoNombre('')
  }

  return (
    <nav className="h-12 bg-surface-tonal-a0 border-b border-surface-tonal-a20 flex items-center px-5 gap-6 sticky top-0 z-[100]">
      <Link href="/" className="text-sm font-bold text-primary-a30 no-underline tracking-[0.03em] shrink-0">
        ⚡ ElectricApp
      </Link>

      <div className="w-px h-[22px] bg-surface-tonal-a20 shrink-0" />

      <div className="flex gap-1 flex-1">
        {NAV_LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-[13px] no-underline py-[5px] px-[10px] rounded-md transition-colors ${
              pathname === l.href
                ? 'text-font-a0 bg-surface-tonal-a10'
                : 'text-surface-tonal-a40 hover:text-font-a0 hover:bg-surface-tonal-a10'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <div className="relative shrink-0" ref={dropRef}>
        <button
          className="flex items-center gap-2 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[7px] py-[5px] pr-[10px] pl-3 cursor-pointer text-font-a0 text-[13px] min-w-[160px] transition-colors hover:border-primary-a20"
          onClick={() => setOpen(o => !o)}
        >
          <span className={`flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis ${!proyectoActivo ? 'text-surface-tonal-a40 italic' : ''}`}>
            {proyectoActivo ? proyectoActivo.nombre : 'Sin proyecto'}
          </span>
          <span className="text-surface-tonal-a40 text-[10px] shrink-0">▼</span>
        </button>

        {open && (
          <div className="absolute right-0 top-[calc(100%+6px)] min-w-[200px] bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-lg p-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] z-[200]">
            <button
              className={`flex items-center gap-2 w-full text-left bg-transparent border-none text-[13px] py-[7px] px-[10px] rounded-[5px] cursor-pointer transition-colors hover:bg-surface-tonal-a10 italic ${!proyectoActivo ? 'text-primary-a30' : 'text-surface-tonal-a40'}`}
              onClick={() => seleccionar(null)}
            >
              Sin proyecto
            </button>

            {proyectos.length > 0 && <div className="h-px bg-surface-tonal-a20 my-1" />}

            {proyectos.map(p => (
              <button
                key={p.id}
                className={`flex items-center gap-2 w-full text-left bg-transparent border-none text-[13px] py-[7px] px-[10px] rounded-[5px] cursor-pointer transition-colors hover:bg-surface-tonal-a10 whitespace-nowrap overflow-hidden text-ellipsis ${proyectoActivo?.id === p.id ? 'text-primary-a30' : 'text-font-a10'}`}
                onClick={() => seleccionar(p)}
              >
                {proyectoActivo?.id === p.id && '✓ '}
                {p.nombre}
              </button>
            ))}

            <div className="h-px bg-surface-tonal-a20 my-1" />

            {creando ? (
              <div className="flex items-center gap-[6px] px-[6px] py-1">
                <input
                  ref={inputRef}
                  className="flex-1 bg-surface-tonal-a10 border border-surface-tonal-a20 rounded-[5px] text-font-a0 text-[13px] py-[5px] px-2 outline-none focus:border-primary-a20"
                  placeholder="Nombre del proyecto"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmarNuevo(); if (e.key === 'Escape') setCreando(false) }}
                />
                <button
                  className="bg-primary-a0 border-none rounded-[5px] text-white text-[13px] py-[5px] px-[10px] cursor-pointer whitespace-nowrap hover:bg-primary-a10"
                  onClick={confirmarNuevo}
                >OK</button>
              </div>
            ) : (
              <button
                className="w-full text-left bg-transparent border-none text-primary-a30 text-[13px] py-[7px] px-[10px] rounded-[5px] cursor-pointer transition-colors hover:bg-surface-tonal-a10"
                onClick={() => setCreando(true)}
              >
                + Nuevo proyecto
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
