'use client'

export default function LocalesPage() {
  return (
    <>
      <style>{`
        .locales-wrap {
          padding: 28px 36px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .locales-header {
          margin-bottom: 24px;
        }
        .locales-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--clr-font-a0);
          margin: 0 0 4px 0;
        }
        .locales-subtitle {
          font-size: 13px;
          color: var(--clr-surface-tonal-a40);
        }
      `}</style>

      <div className="locales-wrap">
        <div className="locales-header">
          <h1 className="locales-title">Locales</h1>
          <p className="locales-subtitle">Gestión de locales</p>
        </div>
      </div>
    </>
  )
}
