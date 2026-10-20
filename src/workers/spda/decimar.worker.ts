/// <reference lib="webworker" />
/**
 * Worker de decimación: reduce una malla real con `meshoptimizer`
 * (MeshoptSimplifier, WASM embebido — sin archivo aparte que servir). Corre en
 * un worker porque una malla grande puede tardar, y no se quiere trabar la UI.
 *
 * Se probó primero con `three/examples/jsm/modifiers/SimplifyModifier.js`
 * (edge-collapse simple) y no escaló: con una malla real de ~975k vértices,
 * ni siquiera terminó de quitar el 10% en más de 200 segundos. `meshoptimizer`
 * es la librería que de verdad se usa en producción para esto (Unity, Godot,
 * pipelines de glTF) — pensada específicamente para mallas de este tamaño.
 *
 * Vértices únicos primero (`mergeVertices` de three): el propio README de
 * meshoptimizer insiste en que la malla de entrada no debe tener vértices
 * duplicados o el simplificador puede quedarse "trabado" sin poder simplificar.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer";

export interface MallaPlana {
  nombre: string;
  positions: Float32Array;
  indices: Uint32Array | null;
}

export interface PeticionDecimar {
  id: number;
  mallas: MallaPlana[];
  /** Fracción (0..1) de vértices a QUITAR — no a conservar. */
  fraccionQuitar: number;
}

export interface MallaDecimada extends MallaPlana {
  vOriginal: number;
  vFinal: number;
}

export type RespuestaDecimar =
  | { tipo: "ok"; id: number; mallas: MallaDecimada[]; ms: number }
  | { tipo: "error"; id: number; mensaje: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Suelda vértices duplicados y devuelve posiciones + índices como arrays planos. */
function aIndexadoUnico(m: MallaPlana): { positions: Float32Array; indices: Uint32Array } {
  let g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  if (m.indices) g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g = mergeVertices(g, 1e-4);
  if (!g.getIndex()) g = mergeVertices(g.toNonIndexed(), 1e-4);

  const pos = g.getAttribute("position");
  const idx = g.getIndex()!;
  return {
    positions: pos.array instanceof Float32Array ? pos.array : new Float32Array(pos.array),
    indices: idx.array instanceof Uint32Array ? idx.array : Uint32Array.from(idx.array as ArrayLike<number>),
  };
}

/** Decima una malla indexada y devuelve un buffer de vértices ya compactado (sin huérfanos). */
function decimarMalla(
  nombre: string,
  positions: Float32Array,
  indices: Uint32Array,
  fraccionQuitar: number,
): MallaDecimada {
  const vOriginal = positions.length / 3;
  const indicesOriginales = indices.length;
  const objetivo = Math.max(
    3,
    Math.floor((indicesOriginales * (1 - fraccionQuitar)) / 3) * 3,
  );

  // target_error alto (no "ErrorAbsolute"): que el límite lo ponga la cantidad
  // de índices pedida, no el error — para esta herramienta el usuario elige
  // "cuánto quitar" directamente, no una tolerancia de desviación.
  const [indicesSimplificados] = MeshoptSimplifier.simplify(
    indices,
    positions,
    3,
    objetivo,
    1,
    ["Prune"],
  );

  // compactMesh reindexa denso (0..N-1) y devuelve el remap viejo→nuevo — hace
  // falta para no arrastrar vértices que ya nadie referencia.
  const [remap, vFinal] = MeshoptSimplifier.compactMesh(indicesSimplificados);
  const positionsFinal = new Float32Array(vFinal * 3);
  const MISSING = 2 ** 32 - 1;
  for (let i = 0; i < remap.length; i++) {
    const nuevo = remap[i];
    if (nuevo === MISSING) continue;
    positionsFinal[nuevo * 3] = positions[i * 3];
    positionsFinal[nuevo * 3 + 1] = positions[i * 3 + 1];
    positionsFinal[nuevo * 3 + 2] = positions[i * 3 + 2];
  }

  return { nombre, positions: positionsFinal, indices: indicesSimplificados, vOriginal, vFinal };
}

ctx.onmessage = async (ev: MessageEvent<PeticionDecimar>) => {
  const { id, mallas, fraccionQuitar } = ev.data;
  const t0 = Date.now();
  try {
    await MeshoptSimplifier.ready;
    const salida = mallas.map((m) => {
      const { positions, indices } = aIndexadoUnico(m);
      return decimarMalla(m.nombre, positions, indices, fraccionQuitar);
    });
    const ms = Date.now() - t0;
    const transferibles = salida.flatMap((m) => [m.positions.buffer, m.indices!.buffer]);
    ctx.postMessage({ tipo: "ok", id, mallas: salida, ms } as RespuestaDecimar, transferibles);
  } catch (err) {
    ctx.postMessage({
      tipo: "error",
      id,
      mensaje: err instanceof Error ? err.message : String(err),
    } as RespuestaDecimar);
  }
};
