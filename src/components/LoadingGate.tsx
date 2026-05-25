'use client'
import { useProyectos } from '@/context/ProyectosContext'

export default function LoadingGate({ children }: { children: React.ReactNode }) {
  const { loading } = useProyectos()

  if (loading) return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--clr-surface-a0, #0f1117)',
      gap: 20,
    }}>
      <div style={{
        width: 44, height: 44,
        border: '3px solid var(--clr-surface-tonal-a20, #2a2d3a)',
        borderTopColor: 'var(--clr-info-a10, #4a9eff)',
        borderRadius: '50%',
        animation: 'lg-spin 0.8s linear infinite',
      }} />
      <span style={{
        fontSize: 13,
        color: 'var(--clr-surface-tonal-a40, #6b7280)',
        letterSpacing: '0.04em',
      }}>
        Cargando proyecto...
      </span>
      <style>{`@keyframes lg-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return <>{children}</>
}
