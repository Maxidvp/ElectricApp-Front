// Parámetros de sitio (altitud y temperatura ambiente) que se cargan en la página
// de Ampacidad. Hoy viven en localStorage del navegador — no en el proyecto —, así
// que Verificación y Memoria los leen de acá para usar exactamente los mismos.
import type { ParametrosSitio } from '@/utils/ampacidad'

export const LS_ALTITUD = 'ea_ampacidad_altitud'
export const LS_TEMP_AMBIENTE = 'ea_ampacidad_temp_ambiente'
export const SITIO_DEFAULT: ParametrosSitio = { altitud: 0, tempAmbiente: 35 }

export function leerParametrosSitio(): ParametrosSitio {
  try {
    const alt = parseFloat(localStorage.getItem(LS_ALTITUD) ?? '')
    const temp = parseFloat(localStorage.getItem(LS_TEMP_AMBIENTE) ?? String(SITIO_DEFAULT.tempAmbiente))
    return { altitud: isNaN(alt) ? SITIO_DEFAULT.altitud : alt, tempAmbiente: isNaN(temp) ? null : temp }
  } catch {
    return SITIO_DEFAULT
  }
}
