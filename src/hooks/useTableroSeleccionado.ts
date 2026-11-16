import { useProyectos } from '@/context/ProyectosContext'
import type { Tablero } from '@/context/types'

// Tablero activo de una página, entre los `candidatos` que esa página admite (ej.
// solo los de potencia). La selección es global (ProyectosContext): cambiarla en una
// página la cambia en todas y en el Navbar. Si el tablero seleccionado no está entre
// los candidatos (otra categoría, otro proyecto), se usa el primero.
export function useTableroSeleccionado(candidatos: Tablero[]) {
  const { tableroSeleccionadoId, seleccionarTablero } = useProyectos()
  const tablero = candidatos.find(t => t.id === tableroSeleccionadoId) ?? candidatos[0]
  return { tablero, idEfectivo: tablero?.id ?? null, seleccionarTablero }
}
