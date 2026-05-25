'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProyectos } from '@/context/ProyectosContext'

const NAV_LINKS = [
  { href: '/cargas',      label: 'Cargas'      },
  { href: '/ruteo',       label: 'Ruteo'       },
  { href: '/ocupaciones', label: 'Ocupaciones' },
  { href: '/cables',      label: 'Cables'      },
  { href: '/locales',     label: 'Locales'     },
  { href: '/importador',  label: 'Importador'  },
]

export default function Navbar() {
  const { proyectos, proyectoActivo, setProyectoActivo, crearProyecto } = useProyectos()
  const pathname  = usePathname()
  const [open, setOpen]         = useState(false)
  const [creando, setCreando]   = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const dropRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreando(false)
        setNuevoNombre('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (creando) inputRef.current?.focus()
  }, [creando])

  const seleccionar = (p: typeof proyectoActivo) => {
    setProyectoActivo(p)
    setOpen(false)
    setCreando(false)
    setNuevoNombre('')
  }

  const confirmarNuevo = async () => {
    const nombre = nuevoNombre.trim()
    if (!nombre) return
    const nuevo = await crearProyecto({ nombre })
    setProyectoActivo(nuevo)
    setOpen(false)
    setCreando(false)
    setNuevoNombre('')
  }

  return (
    <>
      <style>{`
        .navbar {
          height: 48px;
          background: var(--clr-surface-tonal-a0);
          border-bottom: 1px solid var(--clr-surface-tonal-a20);
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 24px;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .navbar-brand {
          font-size: 14px;
          font-weight: 700;
          color: var(--clr-primary-a30);
          text-decoration: none;
          letter-spacing: 0.03em;
          flex-shrink: 0;
        }
        .navbar-sep {
          width: 1px;
          height: 22px;
          background: var(--clr-surface-tonal-a20);
          flex-shrink: 0;
        }
        .navbar-links {
          display: flex;
          gap: 4px;
          flex: 1;
        }
        .navbar-link {
          font-size: 13px;
          color: var(--clr-surface-tonal-a40);
          text-decoration: none;
          padding: 5px 10px;
          border-radius: 6px;
          transition: color 0.15s, background 0.15s;
        }
        .navbar-link:hover {
          color: var(--clr-font-a0);
          background: var(--clr-surface-tonal-a10);
        }
        .navbar-link.active {
          color: var(--clr-font-a0);
          background: var(--clr-surface-tonal-a10);
        }
        .proyecto-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .proyecto-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--clr-surface-tonal-a10);
          border: 1px solid var(--clr-surface-tonal-a20);
          border-radius: 7px;
          padding: 5px 10px 5px 12px;
          cursor: pointer;
          color: var(--clr-font-a0);
          font-size: 13px;
          min-width: 160px;
          transition: border-color 0.15s;
        }
        .proyecto-btn:hover {
          border-color: var(--clr-primary-a20);
        }
        .proyecto-btn-label {
          flex: 1;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .proyecto-btn-label.sin {
          color: var(--clr-surface-tonal-a40);
          font-style: italic;
        }
        .proyecto-caret {
          color: var(--clr-surface-tonal-a40);
          font-size: 10px;
          flex-shrink: 0;
        }
        .proyecto-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          min-width: 200px;
          background: var(--clr-surface-tonal-a0);
          border: 1px solid var(--clr-surface-tonal-a20);
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          z-index: 200;
        }
        .proyecto-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          color: var(--clr-font-a10);
          font-size: 13px;
          padding: 7px 10px;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.12s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .proyecto-item:hover {
          background: var(--clr-surface-tonal-a10);
        }
        .proyecto-item.selected {
          color: var(--clr-primary-a30);
        }
        .proyecto-item.sin-proyecto {
          color: var(--clr-surface-tonal-a40);
          font-style: italic;
        }
        .proyecto-divider {
          height: 1px;
          background: var(--clr-surface-tonal-a20);
          margin: 4px 0;
        }
        .proyecto-nuevo-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 6px;
        }
        .proyecto-nuevo-input {
          flex: 1;
          background: var(--clr-surface-tonal-a10);
          border: 1px solid var(--clr-surface-tonal-a20);
          border-radius: 5px;
          color: var(--clr-font-a0);
          font-size: 13px;
          padding: 5px 8px;
          outline: none;
        }
        .proyecto-nuevo-input:focus {
          border-color: var(--clr-primary-a20);
        }
        .proyecto-nuevo-ok {
          background: var(--clr-primary-a0);
          border: none;
          border-radius: 5px;
          color: white;
          font-size: 13px;
          padding: 5px 10px;
          cursor: pointer;
          white-space: nowrap;
        }
        .proyecto-nuevo-ok:hover {
          background: var(--clr-primary-a10);
        }
        .proyecto-nuevo-btn {
          width: 100%;
          text-align: left;
          background: none;
          border: none;
          color: var(--clr-primary-a30);
          font-size: 13px;
          padding: 7px 10px;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.12s;
        }
        .proyecto-nuevo-btn:hover {
          background: var(--clr-surface-tonal-a10);
        }
      `}</style>

      <nav className="navbar">
        <Link href="/" className="navbar-brand">⚡ ElectricApp</Link>
        <div className="navbar-sep" />
        <div className="navbar-links">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`navbar-link${pathname === l.href ? ' active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="proyecto-wrap" ref={dropRef}>
          <button className="proyecto-btn" onClick={() => setOpen(o => !o)}>
            <span className={`proyecto-btn-label${!proyectoActivo ? ' sin' : ''}`}>
              {proyectoActivo ? proyectoActivo.nombre : 'Sin proyecto'}
            </span>
            <span className="proyecto-caret">▼</span>
          </button>

          {open && (
            <div className="proyecto-dropdown">
              <button
                className={`proyecto-item sin-proyecto${!proyectoActivo ? ' selected' : ''}`}
                onClick={() => seleccionar(null)}
              >
                Sin proyecto
              </button>

              {proyectos.length > 0 && <div className="proyecto-divider" />}

              {proyectos.map(p => (
                <button
                  key={p.id}
                  className={`proyecto-item${proyectoActivo?.id === p.id ? ' selected' : ''}`}
                  onClick={() => seleccionar(p)}
                >
                  {proyectoActivo?.id === p.id && '✓ '}
                  {p.nombre}
                </button>
              ))}

              <div className="proyecto-divider" />

              {creando ? (
                <div className="proyecto-nuevo-row">
                  <input
                    ref={inputRef}
                    className="proyecto-nuevo-input"
                    placeholder="Nombre del proyecto"
                    value={nuevoNombre}
                    onChange={e => setNuevoNombre(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmarNuevo(); if (e.key === 'Escape') setCreando(false) }}
                  />
                  <button className="proyecto-nuevo-ok" onClick={confirmarNuevo}>OK</button>
                </div>
              ) : (
                <button className="proyecto-nuevo-btn" onClick={() => setCreando(true)}>
                  + Nuevo proyecto
                </button>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  )
}
