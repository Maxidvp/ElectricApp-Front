'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const PUBLIC_PATHS = ['/login']

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (!loading && !usuario && !isPublic) router.replace('/login')
  }, [loading, usuario, isPublic, pathname])

  if (loading) return null
  if (!usuario && !isPublic) return null
  return <>{children}</>
}
