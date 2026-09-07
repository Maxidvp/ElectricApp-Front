'use client'
import { useEffect, useReducer, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useProyectos } from '@/context/ProyectosContext'
import { useAuth } from '@/context/AuthContext'
import { getLastTableroId, TABLERO_ID_EVENT } from '@/utils/cookies'
import CambiarPasswordModal from '@/components/CambiarPasswordModal'

// `categoria: null` = siempre visible, no depende del tablero seleccionado.
type NavCategoria = 'POTENCIA' | 'CONTROL' | 'DATOS' | null

const NAV_LINKS: { href: string; label: string; categoria: NavCategoria; adminOnly?: boolean }[] = [
  { href: '/proyectos',      label: 'Proyecto',       categoria: null },
  { href: '/tableros',       label: 'Tableros',       categoria: null },
  { href: '/locales',        label: 'Locales',        categoria: null },
  { href: '/cargas',         label: 'Cargas',         categoria: 'POTENCIA' },
  { href: '/instrumentos',   label: 'Instrumentos',   categoria: 'CONTROL' },
  { href: '/rack',           label: 'Rack',           categoria: 'DATOS' },
  { href: '/ampacidad',      label: 'Ampacidad',      categoria: 'POTENCIA' },
  { href: '/caidas',         label: 'Caídas',         categoria: 'POTENCIA' },
  { href: '/cortocircuitos', label: 'Cortocircuitos', categoria: 'POTENCIA' },
  { href: '/unifilares',     label: 'Unifilares',     categoria: 'POTENCIA' },
  { href: '/ruteo',          label: 'Ruteo',          categoria: null },
  { href: '/ocupaciones',    label: 'Ocupaciones',    categoria: null },
  { href: '/caneros',        label: 'Cañeros',        categoria: null },
  { href: '/importador',     label: 'Importador',     categoria: null },
  { href: '/nec_panel_tag',  label: 'NEC Panel',      categoria: 'POTENCIA' },
  { href: '/cables',         label: 'Cables',         categoria: null },
  { href: '/protecciones',  label: 'Protecciones',   categoria: null },
  { href: '/spda',          label: 'SPDA',           categoria: null },
  { href: '/admin',         label: 'Admin',          categoria: null, adminOnly: true },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { tableros } = useProyectos()
  const { usuario, logout } = useAuth()

  const [menuAbierto, setMenuAbierto] = useState(false)
  const [modalPasswordAbierto, setModalPasswordAbierto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuAbierto) return
    const cerrarSiEsAfuera = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', cerrarSiEsAfuera)
    return () => document.removeEventListener('mousedown', cerrarSiEsAfuera)
  }, [menuAbierto])

  // El cambio de tablero se persiste en una cookie leída por cada página (no en
  // el contexto), así que este componente no se entera solo con el re-render
  // normal de React — necesita escuchar el evento que dispara setLastTableroId
  // para actualizarse aunque el usuario no haya navegado a otra ruta.
  const [, forceUpdate] = useReducer(x => x + 1, 0)
  useEffect(() => {
    window.addEventListener(TABLERO_ID_EVENT, forceUpdate)
    return () => window.removeEventListener(TABLERO_ID_EVENT, forceUpdate)
  }, [])

  const tableroIdSeleccionado = getLastTableroId()
  const tableroSeleccionado = tableros.find(t => t.id === tableroIdSeleccionado) ?? tableros[0]
  // Sin categoria asignada (tableros legado) o sin tablero aún: se asume POTENCIA.
  const categoriaActiva: 'POTENCIA' | 'CONTROL' | 'DATOS' =
    tableroSeleccionado?.categoria === 'CONTROL' || tableroSeleccionado?.categoria === 'DATOS'
      ? tableroSeleccionado.categoria
      : 'POTENCIA'

  const linksVisibles = NAV_LINKS.filter(l =>
    (l.categoria === null || l.categoria === categoriaActiva) &&
    (!l.adminOnly || usuario?.role === 'ADMIN')
  )

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <nav className="h-12 bg-surface-tonal-a0 border-b border-surface-tonal-a20 flex items-center px-5 gap-6 sticky top-0 z-[100]">
      <Link href="/" className="text-sm font-bold text-primary-a30 no-underline tracking-[0.03em] shrink-0">
        ⚡ ElectricApp
      </Link>

      <div className="w-px h-[22px] bg-surface-tonal-a20 shrink-0" />

      <div className="flex gap-1 flex-1">
        {linksVisibles.map(l => (
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

      {usuario && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuAbierto(v => !v)}
            className="flex items-center gap-1.5 text-[13px] text-surface-tonal-a40 hover:text-font-a0 py-[5px] px-[10px] rounded-md hover:bg-surface-tonal-a10 transition-colors cursor-pointer border-none bg-transparent"
          >
            {usuario.email}
            <span className={`text-[10px] transition-transform ${menuAbierto ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {menuAbierto && (
            <div className="absolute right-0 top-full mt-1 min-w-[180px] bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.4)] py-1 flex flex-col z-[150]">
              <button
                onClick={() => { setModalPasswordAbierto(true); setMenuAbierto(false) }}
                className="text-left text-[13px] text-font-a0 hover:bg-surface-tonal-a10 px-[14px] py-2 cursor-pointer border-none bg-transparent transition-colors"
              >
                Cambiar contraseña
              </button>
              <button
                onClick={handleLogout}
                className="text-left text-[13px] text-danger-a10 hover:bg-surface-tonal-a10 px-[14px] py-2 cursor-pointer border-none bg-transparent transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      )}

      {modalPasswordAbierto && <CambiarPasswordModal onCerrar={() => setModalPasswordAbierto(false)} />}

    </nav>
  )
}
