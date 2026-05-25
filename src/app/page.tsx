import Link from 'next/link'

const ROUTES = [
  { href: '/cargas',      label: 'Cargas',      desc: 'Tableros, circuitos y formaciones de cable' },
  { href: '/cables',      label: 'Cables',      desc: 'Catálogo de familias y cables'              },
  { href: '/ruteo',       label: 'Ruteo',       desc: 'Plano de rutas, caños y bandejas'           },
  { href: '/ocupaciones', label: 'Ocupaciones', desc: 'Ocupación de caños y bandejas por tramo'    },
  { href: '/locales',     label: 'Locales',     desc: 'Gestión de locales'                          },
  { href: '/importador',  label: 'Importador',  desc: 'Importar segmentos desde archivos externos'  },
]

export default function Home() {
  return (
    <>
      <style>{`
        .home-wrap {
          min-height: 100dvh;
          background: var(--clr-surface-a0);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          gap: 32px;
        }
        .home-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          width: 100%;
          max-width: 680px;
        }
        .home-card {
          display: block;
          text-decoration: none;
          background: var(--clr-surface-tonal-a0);
          border: 1px solid var(--clr-surface-tonal-a20);
          border-radius: 10px;
          padding: 20px 22px;
          transition: border-color 0.15s, background 0.15s;
        }
        .home-card:hover {
          background: var(--clr-surface-tonal-a10);
          border-color: var(--clr-primary-a20);
        }
        .home-card-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--clr-font-a0);
          margin-bottom: 6px;
        }
        .home-card-desc {
          font-size: 12px;
          color: var(--clr-surface-tonal-a40);
          line-height: 1.5;
        }
      `}</style>

      <div className="home-wrap">
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--clr-font-a0)', margin: 0 }}>
            Electric App
          </h1>
          <p style={{ fontSize: 13, color: 'var(--clr-surface-tonal-a40)', marginTop: 6 }}>
            Seleccioná un módulo para comenzar
          </p>
        </div>

        <div className="home-grid">
          {ROUTES.map(r => (
            <Link key={r.href} href={r.href} className="home-card">
              <div className="home-card-title">{r.label}</div>
              <div className="home-card-desc">{r.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
