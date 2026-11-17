'use client'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastTipo = 'error' | 'success' | 'info'
type Accion = { etiqueta: string; onClick: () => void }
type Toast = { id: number; mensaje: string; tipo: ToastTipo; accion?: Accion }

type ToastContextType = {
  showError: (mensaje: string) => void
  showSuccess: (mensaje: string) => void
  // Aviso con un boton (ej. "Deshacer"). Devuelve una funcion para cerrarlo antes de tiempo.
  showAccion: (mensaje: string, accion: Accion, duracionMs: number) => () => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const DURACION_MS = 5000

const estiloPorTipo: Record<ToastTipo, string> = {
  error:   'border-danger-a0 bg-danger-a0/15 text-danger-a10',
  success: 'border-success-a0 bg-success-a0/15 text-success-a10',
  info:    'border-surface-tonal-a30 text-font-a0',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((mensaje: string, tipo: ToastTipo) => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, mensaje, tipo }])
    setTimeout(() => dismiss(id), DURACION_MS)
  }, [dismiss])

  const showError   = useCallback((mensaje: string) => show(mensaje, 'error'), [show])
  const showSuccess = useCallback((mensaje: string) => show(mensaje, 'success'), [show])
  const showAccion  = useCallback((mensaje: string, accion: Accion, duracionMs: number) => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, mensaje, tipo: 'info', accion }])
    setTimeout(() => dismiss(id), duracionMs)
    return () => dismiss(id)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showError, showSuccess, showAccion }}>
      {children}
      <div className="fixed bottom-4 right-4 z-200 flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto max-w-[360px] border rounded-[8px] px-3.5 py-2.5 text-[13px] shadow-[0_4px_20px_rgba(0,0,0,0.4)] bg-surface-a0 flex items-start gap-2 ${estiloPorTipo[t.tipo]}`}
          >
            <span className="flex-1">{t.mensaje}</span>
            {t.accion && (
              <button
                onClick={() => { t.accion!.onClick(); dismiss(t.id) }}
                className="bg-transparent border-none cursor-pointer text-info-a10 font-semibold text-[13px] p-0 shrink-0 hover:underline"
              >
                {t.accion.etiqueta}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              className="bg-transparent border-none cursor-pointer text-inherit opacity-70 hover:opacity-100 leading-none p-0.5 shrink-0"
              aria-label="Cerrar"
            >
              <i className="material-icons text-[16px]">close</i>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
