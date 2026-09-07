/**
 * Tipos compartidos por los adaptadores de importación (DXF, OBJ, STL, …).
 * Todos producen el mismo `ModeloImportado` neutro que consume el resto de la app.
 */

import type { Conductor, Mastil, Vec3 } from "../geometry";

/** Clasificación de una "capa" / grupo / material del archivo importado. */
export interface MapeoCapas {
  captadores: RegExp;
  conductores: RegExp;
  estructura: RegExp;
  terreno: RegExp;
}

export const MAPEO_CAPAS_POR_DEFECTO: MapeoCapas = {
  captadores: /capt|punta|mast|rod|franklin/i,
  conductores: /conduct|malla|guard|cable|down/i,
  estructura: /estruct|struct|edific|build|techo|roof|muro|wall/i,
  terreno: /terr|suelo|ground|nivel|grade/i,
};

export function clasificar(
  nombre: string,
  m: MapeoCapas,
): keyof MapeoCapas | "estructura" {
  if (m.captadores.test(nombre)) return "captadores";
  if (m.conductores.test(nombre)) return "conductores";
  if (m.terreno.test(nombre)) return "terreno";
  if (m.estructura.test(nombre)) return "estructura";
  return "estructura";
}

/** Eje vertical del archivo de origen (CAD = Z arriba, mallas web = Y arriba). */
export type EjeVertical = "Y" | "Z";

/** Unidad lineal del archivo importado. */
export type Unidad = "m" | "cm" | "mm" | "in" | "ft";

/** Metros por unidad. */
export const FACTORES_UNIDAD: Record<Unidad, number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  in: 0.0254,
  ft: 0.3048,
};

export const UNIDADES: { valor: Unidad; etiqueta: string }[] = [
  { valor: "m", etiqueta: "metros" },
  { valor: "cm", etiqueta: "centímetros" },
  { valor: "mm", etiqueta: "milímetros" },
  { valor: "in", etiqueta: "pulgadas" },
  { valor: "ft", etiqueta: "pies" },
];

export interface OpcionesImport {
  /** Unidad del archivo. Se usa salvo que el formato traiga la unidad embebida. */
  unidad: Unidad;
  mapeo: MapeoCapas;
  /** Separación objetivo entre puntos de muestreo de la estructura (m). */
  pasoMuestreo: number;
  /** Eje vertical del archivo. DXF ignora esto (siempre Z). */
  ejeVertical: EjeVertical;
}

export const OPCIONES_IMPORT_POR_DEFECTO: OpcionesImport = {
  unidad: "m",
  mapeo: MAPEO_CAPAS_POR_DEFECTO,
  pasoMuestreo: 1.5,
  ejeVertical: "Z",
};

export function factorEscala(opts: OpcionesImport): number {
  return FACTORES_UNIDAD[opts.unidad] ?? 1;
}

/**
 * Sugiere una unidad a partir del lado mayor del modelo medido en unidades de
 * archivo, buscando la que deje ese lado más cerca de ~30 m (una estructura
 * típica). Devuelve null si ninguna queda dentro de ~2 órdenes de magnitud.
 */
export function sugerirUnidad(ladoMayorEnArchivo: number): Unidad | null {
  if (!isFinite(ladoMayorEnArchivo) || ladoMayorEnArchivo <= 0) return null;
  const ancla = 30;
  let mejor: Unidad | null = null;
  let mejorErr = Infinity;
  for (const u of Object.keys(FACTORES_UNIDAD) as Unidad[]) {
    const metros = ladoMayorEnArchivo * FACTORES_UNIDAD[u];
    const err = Math.abs(Math.log(metros / ancla));
    if (err < mejorErr) {
      mejorErr = err;
      mejor = u;
    }
  }
  return mejorErr <= Math.log(100) ? mejor : null;
}

export interface ModeloImportado {
  /** Formato de origen: "dxf" | "obj" | "stl" | … */
  formato: string;
  mastiles: Mastil[];
  conductores: Conductor[];
  /** Nube de puntos de la estructura a contrastar. */
  puntosEstructura: Vec3[];
  /** Polilíneas / aristas de estructura (para dibujar en 3D/2D). */
  lineasEstructura: Vec3[][];
  terreno: Vec3[][];
  bounds: { min: Vec3; max: Vec3 };
  cotaTierra: number;
  /** Capas (DXF) o grupos/materiales (mallas) encontrados. */
  capasDetectadas: string[];
  /** Unidad efectivamente aplicada. */
  unidadUsada: Unidad;
  /** Unidad leída del propio archivo (DXF $INSUNITS…), o null si no se pudo. */
  unidadDetectada: Unidad | null;
  advertencias: string[];
}

/** Convierte un vértice a metros y a convención Z-arriba. */
export function aZUp(x: number, y: number, z: number, opts: OpcionesImport): Vec3 {
  const s = factorEscala(opts);
  if (opts.ejeVertical === "Y") return [x * s, -z * s, y * s];
  return [x * s, y * s, z * s];
}

export function boundsVacios(): { min: [number, number, number]; max: [number, number, number] } {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}
