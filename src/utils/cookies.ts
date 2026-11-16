// Persistencia del tablero seleccionado entre recargas de página. La selección
// "viva" es estado de ProyectosContext (tableroSeleccionadoId / seleccionarTablero,
// o el hook useTableroSeleccionado): los componentes NO leen esta cookie directo.
export function getLastTableroId(): number | null {
  if (typeof document === 'undefined') return null
  try {
    const m = document.cookie.match(/(?:^|;\s*)last_tablero_id=(\d+)/)
    return m ? Number(m[1]) : null
  } catch { return null }
}

export function setLastTableroId(id: number) {
  if (typeof document === 'undefined') return
  document.cookie = `last_tablero_id=${id};path=/;max-age=31536000`
}
