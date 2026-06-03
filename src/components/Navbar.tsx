'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/tableros',    label: 'Tableros'    },
  { href: '/locales',     label: 'Locales'     },
  { href: '/cargas',      label: 'Cargas'      },
  { href: '/caidas',          label: 'Caídas'          },
  { href: '/cortocircuitos',  label: 'Cortocircuitos'  },
  { href: '/ruteo',       label: 'Ruteo'       },
  { href: '/ocupaciones', label: 'Ocupaciones' },
  { href: '/importador',  label: 'Importador'  },
  { href: '/cables',      label: 'Cables'      },
]

export default function Navbar() {
  const pathname = usePathname()

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

    </nav>
  )
}
