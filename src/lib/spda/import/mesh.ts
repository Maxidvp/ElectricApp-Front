/**
 * Adaptadores de malla: OBJ y STL.
 *
 * Semántica:
 *   - STL no tiene metadatos → toda la malla se trata como ESTRUCTURA.
 *   - OBJ: cada objeto/grupo (`o` / `g`) o material (`usemtl`) se usa como "capa"
 *     y se clasifica por nombre con `MAPEO_CAPAS_POR_DEFECTO`.
 *
 * De una malla NO salen conductores (líneas). Si un grupo matchea captación se
 * avisa y se pide definir los captadores a mano.
 *
 * Las mallas suelen venir en Y-arriba y sin unidad: se aplica `escala` y se pasa
 * a Z-arriba según `ejeVertical`.
 *
 * No hay nube de puntos acá — se sacó por completo (ver memoria del proyecto):
 * el contraste protegido/expuesto se lee visualmente por transparencia contra
 * las superficies de protección (`Escena3D`), y el resumen numérico
 * (`Resultados.tsx`) se evalúa directo sobre los vértices reales de `mallas`.
 */

import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Vec3 } from "../geometry";
import {
  aZUp,
  clasificar,
  factorEscala,
  sugerirUnidad,
  MAX_VERTICES_MALLA,
  type MallaRender,
  type ModeloImportado,
  type OpcionesImport,
} from "./tipos";

interface Grupo {
  nombre: string;
  geometry: THREE.BufferGeometry;
}

const MAX_ARISTAS = 6000;
const ANGULO_ARISTA = 20; // grados: umbral de arista "de forma"

/**
 * Suelda los vértices repetidos: pasa la malla a indexada.
 *
 * STL no indexa nada — cada triángulo escribe sus tres vértices, así que un
 * vértice compartido por doce triángulos se guarda doce veces. Medido sobre los
 * archivos reales: 974.730 → 83.239 vértices en el terreno (11,7x) y
 * 115.446 → 18.841 en el edificio (6,1x), de 23,4 MB a 4,9 MB de memoria de
 * GPU. Es exacto, no una simplificación: la geometría resultante es la misma.
 *
 * HAY QUE BORRAR LA NORMAL PRIMERO. `mergeVertices` arma su hash con TODOS los
 * atributos, y STL trae una normal por cara, así que dos copias del mismo punto
 * llegan con normales distintas y no se funden: sin borrarla el terreno baja
 * apenas de 974.730 a 887.680 y el soldado no sirve de nada. La normal se
 * recalcula al dibujar (`computeVertexNormals`), que además es lo correcto:
 * la del archivo es por cara y acá interesa la de la superficie.
 *
 * De paso arregla las aristas de forma: `EdgesGeometry` compara triángulos
 * VECINOS para medir el ángulo entre caras, y sin índices no hay dos triángulos
 * que compartan vértices — todas las aristas parecían de borde.
 */
function soldar(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.index ? geometry : geometry.clone();
  for (const nombre of Object.keys(g.attributes)) {
    if (nombre !== "position") g.deleteAttribute(nombre);
  }
  try {
    const soldada = mergeVertices(g);
    if (g !== geometry) geometry.dispose();
    return soldada;
  } catch {
    return g; // una malla degenerada no debe romper el import
  }
}

/** Recorre los vértices del grupo, acumula bounds globales y devuelve el Z mínimo local. */
function procesarVertices(g: Grupo, opts: OpcionesImport, acc: (p: Vec3) => void): number {
  const pos = g.geometry.getAttribute("position");
  let minZ = Infinity;
  if (!pos) return minZ;
  for (let i = 0; i < pos.count; i++) {
    const p = aZUp(pos.getX(i), pos.getY(i), pos.getZ(i), opts);
    acc(p);
    if (p[2] < minZ) minZ = p[2];
  }
  return minZ;
}

function aristasDeForma(g: Grupo, opts: OpcionesImport): Vec3[][] {
  const lineas: Vec3[][] = [];
  try {
    const edges = new THREE.EdgesGeometry(g.geometry, ANGULO_ARISTA);
    const ep = edges.getAttribute("position");
    for (let i = 0; i + 1 < ep.count && lineas.length < MAX_ARISTAS; i += 2) {
      lineas.push([
        aZUp(ep.getX(i), ep.getY(i), ep.getZ(i), opts),
        aZUp(ep.getX(i + 1), ep.getY(i + 1), ep.getZ(i + 1), opts),
      ]);
    }
    edges.dispose();
  } catch {
    /* sin aristas */
  }
  return lineas;
}

/**
 * Malla real del grupo (posiciones + índices), transformada a metros/Z-arriba.
 * `null` solo si el grupo no tiene geometría.
 *
 * Si supera `MAX_VERTICES_MALLA` se marca `pesada` y no se dibuja como sólido
 * (a esa escala no vale la pena), pero la malla se devuelve igual: el tope es
 * de RENDER. Antes se devolvía `null` y el grupo desaparecía también del
 * cálculo — un edificio de más de 200k vértices quedaba sin contrastar y el
 * resumen igual mostraba "Estructura protegida".
 */
function mallaRenderDeGrupo(g: Grupo, opts: OpcionesImport): MallaRender | null {
  const pos = g.geometry.getAttribute("position");
  if (!pos || pos.count === 0) return null;

  const positions = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = aZUp(pos.getX(i), pos.getY(i), pos.getZ(i), opts);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  const indexAttr = g.geometry.getIndex();
  const indices = indexAttr ? Uint32Array.from(indexAttr.array as ArrayLike<number>) : null;

  return { nombre: g.nombre, positions, indices, pesada: pos.count > MAX_VERTICES_MALLA };
}

function construir(grupos: Grupo[], formato: string, opts: OpcionesImport): ModeloImportado {
  const lineasEstructura: Vec3[][] = [];
  const mallas: MallaRender[] = [];
  const terreno: Vec3[][] = [];
  const advertencias: string[] = [];
  const capasDetectadas: string[] = [];
  let terrenoMinZ = Infinity;

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const acc = (p: Vec3) => {
    for (let i = 0; i < 3; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  };

  for (const g of grupos) {
    if (!g.geometry.getAttribute("position")) {
      advertencias.push(`Grupo "${g.nombre}" sin geometría, ignorado.`);
      continue;
    }
    g.geometry = soldar(g.geometry);
    capasDetectadas.push(g.nombre);
    const clase = clasificar(g.nombre, opts.mapeo);
    const lns = aristasDeForma(g, opts);
    const minZGrupo = procesarVertices(g, opts, acc);

    if (clase === "terreno") {
      for (const l of lns) terreno.push(l);
      terrenoMinZ = Math.min(terrenoMinZ, minZGrupo);
    } else if (clase === "captadores" || clase === "conductores") {
      advertencias.push(
        `Grupo "${g.nombre}" matchea captación pero es una malla: no se puede usar como captador. Definí mástiles/conductores a mano.`,
      );
      for (const l of lns) lineasEstructura.push(l);
    } else {
      for (const l of lns) lineasEstructura.push(l);
      const malla = mallaRenderDeGrupo(g, opts);
      if (malla) {
        mallas.push(malla);
        if (malla.pesada)
          advertencias.push(
            `Grupo "${g.nombre}" tiene demasiados vértices para dibujarlo como sólido: se ve solo el contorno, pero sí entra en el cálculo.`,
          );
      }
    }
  }

  if (!isFinite(min[0])) {
    min[0] = 0;
    min[1] = 0;
    min[2] = 0;
    max[0] = 1;
    max[1] = 1;
    max[2] = 1;
    advertencias.push("No se pudo determinar la extensión del modelo.");
  }

  advertencias.push(
    "Malla sin sistema de captación: definí mástiles y conductores en el panel.",
  );

  // OBJ/STL no llevan unidad embebida: se usa la elegida y se sugiere por tamaño.
  const escala = factorEscala(opts) || 1;
  const ladoMayorArchivo =
    Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / escala;
  advertencias.push(
    `${formato.toUpperCase()} no lleva unidad: se asumió "${opts.unidad}". Cambiá la unidad y reimportá si no corresponde.`,
  );
  const sugerida = sugerirUnidad(ladoMayorArchivo);
  if (sugerida && sugerida !== opts.unidad) {
    advertencias.push(
      `Por el tamaño del modelo (~${ladoMayorArchivo.toFixed(0)} u de lado) la unidad podría ser "${sugerida}".`,
    );
  }

  return {
    formato,
    mastiles: [],
    conductores: [],
    lineasEstructura,
    mallas,
    terreno,
    bounds: { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] },
    cotaTierra: isFinite(terrenoMinZ) ? terrenoMinZ : min[2],
    capasDetectadas: [...new Set(capasDetectadas)].sort(),
    unidadUsada: opts.unidad,
    unidadDetectada: null,
    advertencias,
  };
}

export function importarOBJ(texto: string, opts: OpcionesImport): ModeloImportado {
  const raiz = new OBJLoader().parse(texto);
  const grupos: Grupo[] = [];
  let i = 0;
  raiz.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const matNombre = Array.isArray(m.material)
      ? m.material[0]?.name
      : (m.material as THREE.Material | undefined)?.name;
    grupos.push({
      nombre: m.name || matNombre || `obj-${++i}`,
      geometry: m.geometry as THREE.BufferGeometry,
    });
  });
  if (!grupos.length) throw new Error("OBJ sin mallas reconocibles.");
  return construir(grupos, "obj", opts);
}

export function importarSTL(datos: ArrayBuffer | string, opts: OpcionesImport): ModeloImportado {
  const geom = new STLLoader().parse(datos as ArrayBuffer);
  return construir([{ nombre: "stl", geometry: geom }], "stl", opts);
}
