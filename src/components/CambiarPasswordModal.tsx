'use client'
import { useState } from 'react'
import * as authApi from '@/services/auth'

type Props = {
  onCerrar: () => void
}

const inputCx = 'h-[34px] px-3 rounded-[7px] text-[13px] bg-surface-a0 border border-surface-tonal-a30 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10'

export default function CambiarPasswordModal({ onCerrar }: Props) {
  const [passwordActual, setPasswordActual] = useState('')
  const [passwordNuevo, setPasswordNuevo] = useState('')
  const [passwordConfirmar, setPasswordConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (passwordNuevo.length < 8) return setError('La contraseña nueva debe tener al menos 8 caracteres')
    if (passwordNuevo !== passwordConfirmar) return setError('Las contraseñas nuevas no coinciden')

    setGuardando(true)
    try {
      await authApi.changePassword(passwordActual, passwordNuevo)
      setExito(true)
      setTimeout(onCerrar, 1200)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={onCerrar}>
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-surface-a0 border border-surface-tonal-a20 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] px-6 py-5 flex flex-col gap-4 w-[320px] max-w-[90vw]"
      >
        <p className="text-[14px] font-semibold text-font-a0">Cambiar contraseña</p>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-font-a20">Contraseña actual</label>
          <input
            type="password"
            className={inputCx}
            value={passwordActual}
            onChange={e => setPasswordActual(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-font-a20">Contraseña nueva</label>
          <input
            type="password"
            className={inputCx}
            value={passwordNuevo}
            onChange={e => setPasswordNuevo(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-font-a20">Confirmar contraseña nueva</label>
          <input
            type="password"
            className={inputCx}
            value={passwordConfirmar}
            onChange={e => setPasswordConfirmar(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        {error && <p className="text-xs text-danger-a10">{error}</p>}
        {exito && <p className="text-xs text-info-a10">Contraseña actualizada ✓</p>}

        <div className="flex gap-2 justify-end mt-1">
          <button
            type="button"
            onClick={onCerrar}
            className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border border-surface-tonal-a30 bg-transparent text-font-a20 hover:bg-surface-tonal-a10 hover:text-font-a0"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || exito}
            className="h-[32px] px-4 rounded-[7px] text-[13px] cursor-pointer border-none bg-primary-a0 hover:bg-primary-a10 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
