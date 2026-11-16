'use client' // Los error boundaries tienen que ser Client Components

import { useEffect } from 'react'

// Error boundary de toda la app: una excepción al renderizar una página (ej. un dato
// inesperado en un cálculo) muestra este aviso en vez de dejar la pantalla en blanco.
// El Navbar vive en el layout, así que sigue disponible para ir a otra página.
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="subcontainer min-h-dvh flex flex-col items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-[16px] font-semibold text-font-a0 m-0">Esta página tuvo un error</h2>
      <p className="text-[13px] text-surface-tonal-a40 max-w-130">
        Los datos del proyecto no se perdieron. Podés reintentar o ir a otra página desde el menú.
      </p>
      <pre className="text-[12px] text-danger-a10 max-w-180 whitespace-pre-wrap">{error.message}</pre>
      <button
        onClick={() => unstable_retry()}
        className="rounded-md border border-surface-tonal-a30 bg-transparent px-3.5 py-1.5 text-[13px] text-font-a0 cursor-pointer hover:bg-surface-tonal-a10"
      >
        Reintentar
      </button>
    </div>
  )
}
