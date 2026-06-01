import Link from 'next/link'

const ROUTES = [
  { href: '/cargas',      label: 'Cargas',      desc: 'Tableros, circuitos y formaciones de cable' },
  { href: '/caidas',       label: 'Caídas',       desc: 'Caída de tensión por circuito'               },
  { href: '/ruteo',       label: 'Ruteo',       desc: 'Plano de rutas, caños y bandejas'            },
  { href: '/ocupaciones', label: 'Ocupaciones', desc: 'Ocupación de caños y bandejas por tramo'     },
  { href: '/importador',  label: 'Importador',  desc: 'Importar segmentos desde archivos externos'  },
  { href: '/locales',     label: 'Locales',     desc: 'Gestión de locales'                          },
  { href: '/cables',      label: 'Cables',      desc: 'Catálogo de familias y cables'               },
]

export default function Home() {
  return (
    <div className="min-h-dvh bg-surface-a0 flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <h1 className="text-[22px] font-semibold text-font-a0 m-0">Electric App</h1>
        <p className="text-[13px] text-surface-tonal-a40 mt-1.5">Seleccioná un módulo para comenzar</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 w-full max-w-170">
        {ROUTES.map(r => (
          <Link
            key={r.href} href={r.href}
            className="block no-underline bg-surface-tonal-a0 border border-surface-tonal-a20 rounded-[10px] px-5.5 py-5 transition-[border-color,background] duration-150 hover:bg-surface-tonal-a10 hover:border-primary-a20"
          >
            <div className="text-[15px] font-semibold text-font-a0 mb-1.5">{r.label}</div>
            <div className="text-xs text-surface-tonal-a40 leading-relaxed">{r.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
