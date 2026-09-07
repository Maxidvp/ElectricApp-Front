/// <reference lib="webworker" />
/**
 * Worker de cálculo: mantiene la UI fluida mientras corre el método de la esfera
 * rodante sobre la nube de puntos del modelo y (opcionalmente) extrae la
 * envolvente de protección por marching cubes.
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
      puntos: Vec3[];
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

ctx.onmessage = (ev: MessageEvent<PeticionWorker>) => {
  const msg = ev.data;
  try {
    if (msg.tipo === "evaluar") {
      const resultado = evaluarModelo(msg.puntos, msg.sistema, msg.cfg, (frac) =>
        ctx.postMessage({ tipo: "progreso", id: msg.id, fase: "evaluar", frac } as RespuestaWorker),
      );
      ctx.postMessage({ tipo: "evaluar:ok", id: msg.id, resultado } as RespuestaWorker);
    } else if (msg.tipo === "envolvente") {
      const field = campoEscalar(msg.bounds, msg.dims, msg.sistema, msg.cfg, (frac) =>
        ctx.postMessage({
          tipo: "progreso",
          id: msg.id,
          fase: "envolvente",
          frac,
        } as RespuestaWorker),
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
