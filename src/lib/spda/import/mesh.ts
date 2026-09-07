/**
 * Adaptadores de malla: OBJ y STL.
 *
 * Semántica:
 *   - STL no tiene metadatos → toda la malla se trata como ESTRUCTURA.
 *   - OBJ: cada objeto/grupo (`o` / `g`) o material (`usemtl`) se usa como "capa"
 *     y se clasifica con el mismo mapeo de regex que el DXF.
 *
 * De una malla NO salen conductores (líneas). Si un grupo matchea captación se
 * avisa y se pide definir los captadores a mano.
 *
 * Las mallas suelen venir en Y-arriba y sin unidad: se aplica `escala` y se pasa
 * a Z-arriba según `ejeVertical`.
 */

import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import type { Vec3 } from "../geometry";
import {
  aZUp,
  clasificar,
  factorEscala,
  sugerirUnidad,
  type ModeloImportado,
  type OpcionesImport,
} from "./tipos";

interface Grupo {
  nombre: string;
  geometry: THREE.BufferGeometry;
}

const MAX_PUNTOS = 20000;
const MAX_ARISTAS = 6000;
const ANGULO_ARISTA = 20; // grados: umbral de arista "de forma"

function areaTotal(geom: THREE.BufferGeometry): number {
  const pos = geom.getAttribute("position");
  if (!pos) return 0;
  const idx = geom.getIndex();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let area = 0;
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i + 2 < n; i += 3) {
    const ia = idx ? idx.getX(i) : i;
    const ib = idx ? idx.getX(i + 1) : i + 1;
    const ic = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib);
    c.fromBufferAttribute(pos, ic);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    area += ab.cross(ac).length() * 0.5;
  }
  return area;
}

function muestrearSuperficie(g: Grupo, opts: OpcionesImport): Vec3[] {
  const pts: Vec3[] = [];
  const pos = g.geometry.getAttribute("position");
  if (!pos) return pts;

  // Muestreo por área.
  const s = factorEscala(opts);
  const areaM2 = areaTotal(g.geometry) * s * s;
  let objetivo = Math.round(areaM2 / (opts.pasoMuestreo * opts.pasoMuestreo));
  objetivo = Math.max(1, Math.min(MAX_PUNTOS, objetivo || 0));
  try {
    const mesh = new THREE.Mesh(g.geometry);
    const sampler = new MeshSurfaceSampler(mesh).build();
    const p = new THREE.Vector3();
    for (let i = 0; i < objetivo; i++) {
      sampler.sample(p);
      pts.push(aZUp(p.x, p.y, p.z, opts));
    }
  } catch {
    /* geometría degenerada: se cae a solo vértices */
  }

  // Vértices únicos: garantizan que las esquinas (candidatas a estar expuestas)
  // se evalúen aunque el muestreo aleatorio no caiga ahí.
  const vistos = new Set<string>();
  for (let i = 0; i < pos.count && vistos.size < MAX_PUNTOS; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    pts.push(aZUp(x, y, z, opts));
  }
  return pts;
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

function construir(grupos: Grupo[], formato: string, opts: OpcionesImport): ModeloImportado {
  const puntosEstructura: Vec3[] = [];
  const lineasEstructura: Vec3[][] = [];
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
    capasDetectadas.push(g.nombre);
    const clase = clasificar(g.nombre, opts.mapeo);
    const pts = muestrearSuperficie(g, opts);
    const lns = aristasDeForma(g, opts);
    pts.forEach(acc);

    if (clase === "terreno") {
      for (const l of lns) terreno.push(l);
      for (const p of pts) terrenoMinZ = Math.min(terrenoMinZ, p[2]);
    } else if (clase === "captadores" || clase === "conductores") {
      advertencias.push(
        `Grupo "${g.nombre}" matchea captación pero es una malla: no se puede usar como captador. Definí mástiles/conductores a mano.`,
      );
      for (const l of lns) lineasEstructura.push(l);
    } else {
      for (const p of pts) puntosEstructura.push(p);
      for (const l of lns) lineasEstructura.push(l);
    }
  }

  // Techo global de puntos para acotar el tiempo de cálculo.
  let puntos = puntosEstructura;
  if (puntos.length > MAX_PUNTOS) {
    const paso = puntos.length / MAX_PUNTOS;
    const reducidos: Vec3[] = [];
    for (let i = 0; i < puntos.length; i += paso) reducidos.push(puntos[Math.floor(i)]);
    advertencias.push(
      `Modelo grande: se muestreó a ${reducidos.length} puntos (de ${puntos.length}).`,
    );
    puntos = reducidos;
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
    "Malla sin sistema de captación: definí mástiles y conductores en el panel, o cargá un DXF con capas de captación.",
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
    puntosEstructura: puntos,
    lineasEstructura,
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
