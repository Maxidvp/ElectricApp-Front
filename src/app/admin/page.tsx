'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import * as authApi from '@/services/auth'
import type { Usuario } from '@/services/auth'

const ROLES: Usuario['role'][] = ['GRATUITO', 'PAGO', 'ADMIN']

export default function AdminPage() {
  const { usuario } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (usuario?.role !== 'ADMIN') return
    authApi.getUsuarios()
      .then(setUsuarios)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [usuario])

  if (usuario?.role !== 'ADMIN') return <p className="p-6 text-sm text-font-a0">No autorizado</p>

  async function cambiarRole(id: number, role: string) {
    try {
      const actualizado = await authApi.updateUsuarioRole(id, role)
      setUsuarios(prev => prev.map(u => u.id === id ? actualizado : u))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-bold text-font-a0 mb-4">Usuarios</h1>

      {loading && <p className="text-sm text-surface-tonal-a40">Cargando...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && (
        <table className="text-sm text-font-a0 border-collapse">
          <thead>
            <tr className="text-left text-surface-tonal-a40">
              <th className="pr-6 pb-2">Email</th>
              <th className="pr-6 pb-2">Nombre</th>
              <th className="pr-6 pb-2">Rol</th>
              <th className="pr-6 pb-2">Activo</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-t border-surface-tonal-a20">
                <td className="pr-6 py-2">{u.email}</td>
                <td className="pr-6 py-2">{u.nombre ?? '—'}</td>
                <td className="pr-6 py-2">
                  <select
                    value={u.role}
                    onChange={e => cambiarRole(u.id, e.target.value)}
                    className="px-2 py-1 rounded-md bg-surface-tonal-a0 border border-surface-tonal-a20"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="pr-6 py-2">{u.activo ? 'Sí' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
