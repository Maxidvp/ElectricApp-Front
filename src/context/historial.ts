import { useRef } from 'react'

// Deshacer / rehacer de uso diario (Ctrl+Z / Ctrl+Y). No tiene nada que ver con los
// checkpoints, que guardan revisiones enteras del proyecto.
//
// Cómo funciona: cada edición registra un Paso con su acción inversa. Deshacer manda al
// servidor el valor anterior por la misma ruta de siempre, como si el usuario lo hubiera
// tipeado — no hay estado especial en la base.
//
// Límites (aceptados a propósito):
//   - La pila vive en memoria: se pierde al recargar y al cambiar de proyecto, y es de
//     esta pestaña.
//   - Un paso solo se aplica si el dato sigue como lo dejó esa edición. Si cambió después
//     (otro participante, u otra edición que no pasó por el historial), el paso devuelve
//     false y se descarta con un aviso, en vez de pisar un valor más nuevo.
//   - Los borrados se deshacen pidiéndole al servidor que restaure la fila (borrado
//     lógico — ver borrarConDeshacer en ProyectosContext). El servidor elimina de verdad
//     lo borrado hace más de un día.
//   - Ruteo, grupos diferenciales, altas, duplicados y reordenamientos todavía no
//     registran pasos.

export type Paso = {
  descripcion: string
  // Devuelven false si no se pudo aplicar (el paso se descarta).
  deshacer: () => Promise<boolean> | boolean
  rehacer: () => Promise<boolean> | boolean
}

const MAX_PASOS = 100

export function useHistorial(avisar: { ok: (m: string) => void; error: (m: string) => void }) {
  const hechos = useRef<Paso[]>([])
  const deshechos = useRef<Paso[]>([])
  const ocupado = useRef(false)

  function registrar(paso: Paso) {
    hechos.current.push(paso)
    if (hechos.current.length > MAX_PASOS) hechos.current.shift()
    deshechos.current = []
  }

  // `este`: deshacer ese paso en particular aunque no sea el último (el botón "Deshacer"
  // del aviso de un borrado tiene que deshacer ESE borrado, no la última edición).
  async function mover(desde: Paso[], hacia: Paso[], accion: 'deshacer' | 'rehacer', este?: Paso) {
    if (ocupado.current) return
    const i = este ? desde.lastIndexOf(este) : desde.length - 1
    if (i < 0) return
    const [paso] = desde.splice(i, 1)
    ocupado.current = true
    try {
      if (await paso[accion]() === false) {
        avisar.error(`No se pudo ${accion} "${paso.descripcion}": el dato cambió después o ya no está disponible.`)
        return
      }
      hacia.push(paso)
      avisar.ok(`${accion === 'deshacer' ? 'Deshecho' : 'Rehecho'}: ${paso.descripcion}`)
    } finally {
      ocupado.current = false
    }
  }

  return {
    registrar,
    deshacer: () => mover(hechos.current, deshechos.current, 'deshacer'),
    deshacerPaso: (paso: Paso) => mover(hechos.current, deshechos.current, 'deshacer', paso),
    rehacer: () => mover(deshechos.current, hechos.current, 'rehacer'),
    limpiar: () => { hechos.current = []; deshechos.current = [] },
  }
}

export type Historial = ReturnType<typeof useHistorial>

// ¿El dato sigue teniendo el valor que dejó la edición? Los objetos anidados (formación,
// protección) no se comparan: el servidor los reemplaza por su propia copia al
// responder, así que la referencia nunca coincide; para ellos manda su campo *_id.
export function sigueIgual(actual: Record<string, unknown>, esperado: Record<string, unknown>) {
  return Object.keys(esperado).every(k => {
    const a = actual[k], e = esperado[k]
    if ((a !== null && typeof a === 'object') || (e !== null && typeof e === 'object')) return true
    return a === e
  })
}
