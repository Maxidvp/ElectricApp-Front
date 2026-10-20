/**
 * Tipos compartidos por los adaptadores de importación (OBJ, STL).
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
  return "estructura"; // default: todo lo que no matchee otra capa es estructura
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
  /** Eje vertical del archivo de origen (CAD = Z arriba, mallas web = Y arriba). */
  ejeVertical: EjeVertical;
}

// Milímetros y Z-arriba por el mismo motivo: los archivos que entran acá salen
// de AutoCAD/Civil3D, donde esa es la convención de trabajo habitual, y ni OBJ
// ni STL declaran unidad ni eje. Un desfasaje de unidad no es cosmético — un
// modelo real en mm interpretado como m queda 1000x más grande y ya reventó la
// memoria una vez. El default de eje anterior ("Y", la convención de mallas
// web/juegos) hacía que el MISMO archivo entrara derecho por "Importar suelo"
// (que forzaba Z) y acostado por "Importar edificaciones".
export const OPCIONES_IMPORT_POR_DEFECTO: OpcionesImport = {
  unidad: "mm",
  mapeo: MAPEO_CAPAS_POR_DEFECTO,
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

/**
 * Malla real (con caras) de un grupo de estructura, ya en metros y Z-arriba —
 * es la geometría que se dibuja como sólido (`Escena3D`/`ModeloSolido`) y la
 * que se evalúa contra la esfera rodante. Solo la producen los formatos con
 * caras reales (OBJ/STL).
 */
export interface MallaRender {
  nombre: string;
  /** [x,y,z, x,y,z, …] en metros, Z-arriba — mismo sistema que el resto. */
  positions: Float32Array;
  /** Índices de triángulos, o null si la geometría no viene indexada. */
  indices: Uint32Array | null;
  /**
   * `true` si supera `MAX_VERTICES_MALLA` y NO se dibuja como sólido (se ve
   * solo el contorno). Ojo: es una decisión de RENDER, no de cálculo — estos
   * vértices se evalúan igual. Antes se descartaba la malla entera, y el
   * edificio más grande del modelo quedaba sin contrastar mientras la pantalla
   * decía "Estructura protegida".
   */
  pesada?: boolean;
}

/**
 * Tope de vértices para dibujar una malla como sólido.
 *
 * Estaba en 200.000, calibrado cuando la malla entraba SIN INDEXAR: ahí un STL
 * de 325k triángulos declaraba 975k vértices y quedaba afuera por goleada.
 * Ahora se suelda al importar (ver `soldar` en `mesh.ts`) y ese mismo archivo
 * son 83k vértices reales, así que el tope viejo dejaba fuera modelos que la
 * GPU dibuja sin despeinarse.
 *
 * 1.500.000 con geometría indexada son ~18 MB de posiciones más 18 MB de
 * normales: nada para una GPU de esta década, y el raycast de los clicks va por
 * BVH (`three-mesh-bvh` en `Escena3D`), que no depende del tamaño de la malla.
 * Por encima de esto lo que corresponde no es dejar de dibujar sino decimar
 * para el visor conservando la malla completa para el cálculo — el worker ya
 * existe (`decimar.worker.ts`), falta cablearlo acá.
 */
export const MAX_VERTICES_MALLA = 1_500_000;

export interface ModeloImportado {
  /** Formato de origen: "obj" | "stl" */
  formato: string;
  mastiles: Mastil[];
  conductores: Conductor[];
  /** Polilíneas / aristas de estructura (para dibujar en 3D/2D). */
  lineasEstructura: Vec3[][];
  /** Mallas reales con caras, para mostrar como sólido (solo OBJ/STL). */
  mallas: MallaRender[];
  terreno: Vec3[][];
  bounds: { min: Vec3; max: Vec3 };
  cotaTierra: number;
  /** Grupos/materiales (OBJ) o nombre único (STL) encontrados. */
  capasDetectadas: string[];
  /** Unidad efectivamente aplicada. */
  unidadUsada: Unidad;
  /** Unidad leída del propio archivo. OBJ/STL nunca la declaran: siempre null hoy, queda el campo por si se suma un formato que sí la traiga. */
  unidadDetectada: Unidad | null;
  advertencias: string[];
}

/** Convierte un vértice a metros y a convención Z-arriba. */
export function aZUp(x: number, y: number, z: number, opts: OpcionesImport): Vec3 {
  const s = factorEscala(opts);
  if (opts.ejeVertical === "Y") return [x * s, -z * s, y * s];
  return [x * s, y * s, z * s];
}

