// Bloque de datos del tablero para el unifilar, según el esquema tipo de COPAIPA
// (CTM-003 hoja 2, ver Docs COPAIPA/): gabinete, aislación, grados de protección, norma,
// personas, reserva y conductores internos. A eso se suman los datos propios de un
// tablero industrial (tensión, corriente e Icc de barras, forma de separación, ECT),
// que el ejemplo domiciliario de COPAIPA no trae pero hacen falta para leer el plano.
//
// Los datos que pide CTM-003 se muestran SIEMPRE: si falta uno, la línea sale con "…"
// para que se vea que está incompleto. Los industriales solo si están cargados.
import type { Tablero } from '@/context/types'
import type { IccTablero } from '@/utils/calcularIccTablero'
import type { DatosTableroUnifilar } from './_model'

const o = (v: string | number | null | undefined) => (v == null || v === '' ? '…' : String(v))

export function datosTableroUnifilar(t: Tablero, icc: IccTablero): DatosTableroUnifilar {
  const aislante = /aisl/i.test(t.material_gabinete ?? '')
  const tensiones = [t.tension_tri, t.tension_bi, t.tension_mono].filter(v => v != null)
  const lineas = [
    `Ubicación: ${o(t.ubicacion)}`,
    `Gabinete ${o(t.material_gabinete)}`,
    `Aislación Clase ${o(t.clase_aislacion)}`,
    `Grado Protección Externo: ${o(t.grado_proteccion)}${t.grado_ik ? ` (${t.grado_ik})` : ''}`,
    `Grado Protección para Operación: ${o(t.grado_proteccion_operacion)}`,
    `Norma ${o(t.norma)}`,
    `Apto para Personas ${o(t.apto_personas)}`,
    `Reserva mín. ${t.reserva_pct != null ? `${t.reserva_pct}%` : '…'}`,
    `Los conductores en el interior son ${o(t.conductores_internos)}`,
    // La potencia de disipación solo se pide para gabinetes de material aislante.
    ...(aislante ? [`(Pde >= ${o(t.potencia_disipacion)} W)`] : []),
    // ── Industriales: solo con dato ──
    ...(tensiones.length ? [`Un ${tensiones.join('/')} V${t.frecuencia != null ? ` - ${t.frecuencia} Hz` : ''}`] : []),
    ...(t.esquema_tierra ? [`ECT: ${t.esquema_tierra}`] : []),
    ...(t.corriente_nom != null ? [`In barras: ${t.corriente_nom} A`] : []),
    ...(icc.Icc_max_kA != null ? [`Icc presunta en barras: ${icc.Icc_max_kA.toFixed(2)} kA`] : []),
    ...(t.icw_ka != null ? [`Icw barras: ${t.icw_ka} kA`] : []),
    ...(t.forma_separacion ? [`Forma de separación ${t.forma_separacion}`] : []),
  ]
  return { titulo: t.nombre ? `${t.tag} — ${t.nombre}` : t.tag, lineas }
}
