/// <reference lib="webworker" />
/**
 * Worker de importación STEP: lee un B-rep real con OpenCascade (el mismo
 * kernel WASM que ya usa la exportación) y lo tesela a mallas para el visor.
 *
 * A diferencia de OBJ/STL, STEP **declara su unidad** en la cabecera y OpenCascade
 * la aplica al leer, entregando siempre milímetros sin importar en qué unidad se
 * haya modelado. Por eso acá no hay selector de unidad ni heurística que adivine:
 * se divide por 1000 y listo. Ese es el motivo de fondo para soportar STEP —
 * con STL, una unidad mal adivinada no cambia el tamaño sino que manda la pieza
 * a kilómetros, porque las coordenadas de relevamiento están lejos del origen.
 *
 * Corre en un worker porque inicializar el WASM y teselar tardan segundos.
 */

import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";

// Igual que en `exportCad.worker.ts`: el WASM se sirve desde public/ (lo copia
// scripts/copy-replicad-wasm.mjs en postinstall).
const wasmUrl = "/wasm/replicad_single.wasm";

export interface PeticionImportStep {
  id: number;
  bytes: ArrayBuffer;
  nombre: string;
}

export interface MallaStep {
  nombre: string;
  /** Metros, Z-arriba — ya convertidos desde los milímetros que entrega OpenCascade. */
  positions: Float32Array;
  indices: Uint32Array;
  /** Caras del B-rep que aportó este sólido (no triángulos): las caras reales del CAD. */
  caras: number;
  /** Cuántas de esas caras son planas — las que sirven para delimitar. */
  carasPlanas: number;
}

export type RespuestaImportStep =
  | {
      tipo: "ok";
      id: number;
      mallas: MallaStep[];
      /** Unidad declarada en la cabecera del archivo, solo informativa. */
      unidadArchivo: string | null;
      advertencias: string[];
    }
  | { tipo: "error"; id: number; mensaje: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let ocListo: Promise<void> | null = null;
function asegurarOC(): Promise<void> {
  if (!ocListo) {
    ocListo = initOC({ locateFile: () => wasmUrl })
      .then((oc) => {
        replicad.setOC(oc);
      })
      // Una promesa rechazada quedaría cacheada y todo import posterior fallaría
      // con el mismo error sin reintentar (mismo cuidado que en el de export).
      .catch((err) => {
        ocListo = null;
        throw err;
      });
  }
  return ocListo;
}

/**
 * Unidad declarada en el archivo, solo para mostrarla. La conversión la hace
 * OpenCascade: esto es para que el usuario pueda confirmar que el archivo dice
 * lo que él cree.
 *
 * Se leen dos trozos, principio y FINAL, en vez del archivo entero. El final
 * importa porque ahí es donde OpenCascade escribe el
 * `GEOMETRIC_REPRESENTATION_CONTEXT` con las unidades: en un STEP de terreno de
 * 238 KB el `SI_UNIT` estaba en el byte 238.346, y mirando solo la cabecera no
 * aparecía nunca. Y se leen por trozos porque un terreno puede pesar cientos de
 * MB: convertir todo eso a string para buscar una línea es memoria tirada.
 */
const TROZO_CABECERA = 64 * 1024;
const TROZO_FINAL = 512 * 1024;

function unidadDeclarada(bytes: ArrayBuffer): string | null {
  const dec = new TextDecoder("latin1");
  const cabeza = dec.decode(bytes.slice(0, Math.min(TROZO_CABECERA, bytes.byteLength)));
  const cola = dec.decode(bytes.slice(Math.max(0, bytes.byteLength - TROZO_FINAL)));
  const texto = `${cabeza}\n${cola}`;

  const conversion = texto.match(/CONVERSION_BASED_UNIT\s*\(\s*'([^']+)'/i);
  if (conversion) return conversion[1].toLowerCase();
  const si = texto.match(/SI_UNIT\s*\(\s*(\.[A-Z]+\.|\$)\s*,\s*\.METRE\./i);
  if (!si) return null;
  const prefijos: Record<string, string> = {
    ".MILLI.": "mm",
    ".CENTI.": "cm",
    ".DECI.": "dm",
    ".KILO.": "km",
    $: "m",
  };
  return prefijos[si[1].toUpperCase()] ?? si[1];
}

interface FormaMallable {
  mesh(opts?: { tolerance?: number; angularTolerance?: number }): {
    vertices: number[];
    triangles: number[];
  };
  readonly boundingBox: { bounds: [number[], number[]] };
  readonly faces: Iterable<{ geomType: string }>;
}

function mallaDeForma(forma: FormaMallable, nombre: string): MallaStep | null {
  const [mn, mx] = forma.boundingBox.bounds;
  const diagonal = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  // Tolerancia proporcional al tamaño (en mm). Las caras planas se teselan
  // exactas igual: esto solo manda en las curvas, y una tolerancia fija sería
  // absurdamente fina para un edificio de 25 m y grosera para una pieza chica.
  const tolerance = Math.min(100, Math.max(0.1, diagonal / 1000));
  const { vertices, triangles } = forma.mesh({ tolerance, angularTolerance: 0.3 });
  if (!vertices?.length || !triangles?.length) return null;

  // OpenCascade entrega milímetros (convirtió desde la unidad del archivo).
  const positions = new Float32Array(vertices.length);
  for (let i = 0; i < vertices.length; i++) positions[i] = vertices[i] / 1000;

  let caras = 0;
  let carasPlanas = 0;
  for (const f of forma.faces) {
    caras++;
    if (f.geomType === "PLANE") carasPlanas++;
  }

  return { nombre, positions, indices: Uint32Array.from(triangles), caras, carasPlanas };
}

ctx.onmessage = async (ev: MessageEvent<PeticionImportStep>) => {
  const { id, bytes, nombre } = ev.data;
  try {
    await asegurarOC();
    const unidadArchivo = unidadDeclarada(bytes);
    const forma = await replicad.importSTEP(new Blob([bytes]));

    // Un STEP casi siempre es un compound con un sólido por objeto: se parte en
    // esos sólidos para que cada uno entre como una malla propia, igual que los
    // grupos de un OBJ. Si no hay sólidos (un archivo de solo superficies) se
    // tesela la forma entera.
    const advertencias: string[] = [];
    let solidos: FormaMallable[] = [];
    try {
      solidos = (forma as unknown as { solids: FormaMallable[] }).solids ?? [];
    } catch {
      solidos = [];
    }

    const mallas: MallaStep[] = [];
    if (solidos.length > 0) {
      solidos.forEach((s, i) => {
        const m = mallaDeForma(s, solidos.length === 1 ? nombre : `${nombre} · sólido ${i + 1}`);
        if (m) mallas.push(m);
      });
    } else {
      const m = mallaDeForma(forma as unknown as FormaMallable, nombre);
      if (m) mallas.push(m);
      advertencias.push(
        "El archivo no trae sólidos cerrados (solo superficies): entra como una malla sola.",
      );
    }

    if (mallas.length === 0) throw new Error("El STEP no produjo geometría teselable.");

    const transferibles = mallas.flatMap((m) => [m.positions.buffer, m.indices.buffer]);
    ctx.postMessage(
      { tipo: "ok", id, mallas, unidadArchivo, advertencias } as RespuestaImportStep,
      transferibles,
    );
  } catch (err) {
    ctx.postMessage({
      tipo: "error",
      id,
      mensaje: err instanceof Error ? err.message : String(err),
    } as RespuestaImportStep);
  }
};
