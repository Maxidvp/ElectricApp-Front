/// <reference lib="webworker" />
/**
 * Worker de exportación CAD: carga el kernel OpenCascade (WASM, vía replicad)
 * y construye el volumen protegido como sólidos B-rep reales, exportados a
 * STEP. Corre en un worker porque cargar/inicializar el WASM y correr los
 * booleanos puede tardar unos segundos — no se quiere trabar la UI.
 */

import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import { exportarSTEP } from "@/lib/spda/exportCad/replicadModelo";
import type { ConstruccionExport } from "@/lib/spda/exportCad/geometria";

// El sufijo `?url` de Vite no existe en Next: el WASM se sirve directo desde
// public/ (copiado ahí por scripts/copy-replicad-wasm.mjs en postinstall) y se
// referencia por una URL fija.
const wasmUrl = "/wasm/replicad_single.wasm";

export interface PeticionExportCad {
  id: number;
  construccion: ConstruccionExport;
  /** Si viene, cada pieza se parte por el plano horizontal a esa altura. */
  alturaSeccion?: number;
}

export type RespuestaExportCad =
  | { tipo: "ok"; id: number; bytes: ArrayBuffer; nombre: string }
  | { tipo: "error"; id: number; mensaje: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let ocListo: Promise<void> | null = null;
function asegurarOC(): Promise<void> {
  if (!ocListo) {
    ocListo = initOC({ locateFile: () => wasmUrl }).then((oc) => {
      replicad.setOC(oc);
    });
  }
  return ocListo;
}

ctx.onmessage = async (ev: MessageEvent<PeticionExportCad>) => {
  const { id, construccion, alturaSeccion } = ev.data;
  try {
    await asegurarOC();
    const blob = exportarSTEP(construccion, alturaSeccion);
    const bytes = await blob.arrayBuffer();
    const nombre = "sdpa-volumen-protegido.step";
    ctx.postMessage({ tipo: "ok", id, bytes, nombre } as RespuestaExportCad, [bytes]);
  } catch (err) {
    ctx.postMessage({
      tipo: "error",
      id,
      mensaje: err instanceof Error ? err.message : String(err),
    } as RespuestaExportCad);
  }
};
