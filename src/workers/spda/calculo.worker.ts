/// <reference lib="webworker" />
/**
 * Worker de cálculo: mantiene la UI fluida mientras corre el método de la
 * esfera rodante sobre los vértices reales de la malla importada y
 * (opcionalmente) extrae la envolvente de protección por marching cubes.
 *
 * "evaluar" corre sobre `modelo.mallas` (vértices reales) — antes corría sobre
 * una nube de puntos muestreada aparte; se sacó esa nube por completo (ver
 * memoria del proyecto) a favor de mostrar protegido/expuesto como un truco
 * visual de transparencia en `Escena3D` en vez de colorear por margen —
 * `evaluar` ahora solo alimenta el resumen numérico (`Resultados.tsx`), no
 * ningún color.
 */

import type { SistemaCaptacion, Vec3 } from "@/lib/spda/geometry";
import {
  campoEscalar,
  evaluarModelo,
  type ConfigCalculo,
  type ResultadoModelo,
} from "@/lib/spda/rollingSphere";
import { marchingCubes, type MallaISO } from "@/lib/spda/marchingCubes";

export type PeticionWorker =
  | {
      tipo: "evaluar";
      id: number;
      /** [x,y,z, x,y,z, …] — se manda TRANSFERIDO, el emisor pierde el buffer. */
      posiciones: Float32Array;
      sistema: SistemaCaptacion;
      cfg: ConfigCalculo;
    }
  | {
      tipo: "envolvente";
      id: number;
      bounds: { min: Vec3; max: Vec3 };
      dims: [number, number, number];
      sistema: SistemaCaptacion;
      cfg: ConfigCalculo;
    };

export type RespuestaWorker =
  | { tipo: "progreso"; id: number; fase: string; frac: number }
  | { tipo: "evaluar:ok"; id: number; resultado: ResultadoModelo }
  | { tipo: "envolvente:ok"; id: number; malla: MallaISO }
  | { tipo: "error"; id: number; mensaje: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/**
 * Reporta progreso solo cuando cambia el ENTERO de porcentaje. `evaluarModelo`
 * llama cada 64 puntos, que con una malla real (200k vértices) son ~3000
 * mensajes: cada uno escribe en el store y re-renderiza el panel entero
 * mientras el canvas 3D está corriendo al lado. Con el filtro quedan ~100, que
 * es todo lo que una barra de progreso puede mostrar igual.
 */
function progresoPorcentual(id: number, fase: string): (frac: number) => void {
  let ultimo = -1;
  return (frac) => {
    const pct = Math.round(frac * 100);
    if (pct === ultimo) return;
    ultimo = pct;
    ctx.postMessage({ tipo: "progreso", id, fase, frac } as RespuestaWorker);
  };
}

ctx.onmessage = (ev: MessageEvent<PeticionWorker>) => {
  const msg = ev.data;
  try {
    if (msg.tipo === "evaluar") {
      const resultado = evaluarModelo(
        msg.posiciones,
        msg.sistema,
        msg.cfg,
        progresoPorcentual(msg.id, "evaluar"),
      );
      ctx.postMessage({ tipo: "evaluar:ok", id: msg.id, resultado } as RespuestaWorker);
    } else if (msg.tipo === "envolvente") {
      const field = campoEscalar(
        msg.bounds,
        msg.dims,
        msg.sistema,
        msg.cfg,
        progresoPorcentual(msg.id, "envolvente"),
      );
      const malla = marchingCubes(field, msg.dims, msg.bounds, 0);
      ctx.postMessage({ tipo: "envolvente:ok", id: msg.id, malla } as RespuestaWorker, [
        malla.positions.buffer,
        malla.indices.buffer,
      ]);
    }
  } catch (err) {
    ctx.postMessage({
      tipo: "error",
      id: msg.id,
      mensaje: err instanceof Error ? err.message : String(err),
    } as RespuestaWorker);
  }
};
