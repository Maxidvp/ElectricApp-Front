// Catálogo de transformadores de distribución trifásicos típicos, serie
// 13,2 kV / 400V Dyn11, ONAN, bobinado de cobre — norma IRAM 2250:2013
// (serie de potencias y valores tal como los publican fabricantes/distribuidores
// argentinos, ej. IDEALCO). Sirve para autocompletar el formulario de "fuente de
// alimentación" tipo TRANSFORMADOR; los valores quedan editables después de aplicarlos.
export type TransformadorCatalogo = {
  id: string
  nombre: string
  potencia_nominal: number   // kVA
  tension_primaria: number   // kV
  tension_secundaria: number // V
  ukr_porcentaje: number     // %
  perdidas_cobre_w: number   // W, referidas a 75 °C
  grupo_conexion: string
}

export const CATALOGO_TRANSFORMADORES: TransformadorCatalogo[] = [
  { id: 'iram-100',  nombre: '100 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 100,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 4, perdidas_cobre_w: 1750,  grupo_conexion: 'Dyn11' },
  { id: 'iram-160',  nombre: '160 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 160,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 4, perdidas_cobre_w: 2500,  grupo_conexion: 'Dyn11' },
  { id: 'iram-200',  nombre: '200 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 200,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 4, perdidas_cobre_w: 3000,  grupo_conexion: 'Dyn11' },
  { id: 'iram-250',  nombre: '250 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 250,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 4, perdidas_cobre_w: 3500,  grupo_conexion: 'Dyn11' },
  { id: 'iram-315',  nombre: '315 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 315,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 4, perdidas_cobre_w: 4250,  grupo_conexion: 'Dyn11' },
  { id: 'iram-400',  nombre: '400 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 400,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 4, perdidas_cobre_w: 5000,  grupo_conexion: 'Dyn11' },
  { id: 'iram-500',  nombre: '500 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 500,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 4, perdidas_cobre_w: 6000,  grupo_conexion: 'Dyn11' },
  { id: 'iram-630',  nombre: '630 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 630,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 4, perdidas_cobre_w: 7250,  grupo_conexion: 'Dyn11' },
  { id: 'iram-800',  nombre: '800 kVA — 13,2 kV/400 V Dyn11',  potencia_nominal: 800,  tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 5, perdidas_cobre_w: 8750,  grupo_conexion: 'Dyn11' },
  { id: 'iram-1000', nombre: '1000 kVA — 13,2 kV/400 V Dyn11', potencia_nominal: 1000, tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 5, perdidas_cobre_w: 10500, grupo_conexion: 'Dyn11' },
  { id: 'iram-1250', nombre: '1250 kVA — 13,2 kV/400 V Dyn11', potencia_nominal: 1250, tension_primaria: 13.2, tension_secundaria: 400, ukr_porcentaje: 5, perdidas_cobre_w: 13800, grupo_conexion: 'Dyn11' },
]
