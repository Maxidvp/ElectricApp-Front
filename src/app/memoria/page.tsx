import { redirect } from 'next/navigation'

// La memoria general se mudó a /memorias/general (ver /memorias); se conserva esta
// ruta para los enlaces viejos.
export default function Memoria() {
  redirect('/memorias/general')
}
