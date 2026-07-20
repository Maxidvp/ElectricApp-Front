export function getLastTableroId(): number | null {
  if (typeof document === 'undefined') return null
  try {
    const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
    return m ? Number(m[1]) : null
  } catch { return null }
}

// Emitido cada vez que cambia el tablero seleccionado, para que componentes que
// no están en el árbol de la página activa (ej. el Navbar) puedan reaccionar sin
// esperar a una navegación — que es lo único que normalmente los re-renderiza.
export const TABLERO_ID_EVENT = 'ea:tablero-id-changed'

export function setLastTableroId(id: number) {
  if (typeof document === 'undefined') return
  document.cookie = `last_tablero_id=${id};path=/;max-age=31536000`
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TABLERO_ID_EVENT))
}
