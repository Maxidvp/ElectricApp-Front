/**
 * Adaptador STEP: pide la lectura al worker de OpenCascade y arma el
 * `ModeloImportado`.
 *
 * Lo que STEP resuelve y OBJ/STL no pueden:
 *
 *  - **Unidad**: viene declarada en el archivo y OpenCascade la aplica, así que
 *    la geometría llega siempre en milímetros venga modelada en lo que venga.
 *    Acá se divide por 1000 y no hay nada que adivinar. Con STL la unidad se
 *    supone, y como las coordenadas de relevamiento están lejos del origen un
 *    error de unidad no cambia el tamaño: manda la pieza a kilómetros.
 *  - **Caras reales**: el B-rep trae las caras del CAD, no triángulos sueltos.
 *    El worker cuenta cuántas son planas, que son las que sirven para delimitar
 *    edificios; más adelante se pueden ofrecer como lista en vez de clickearlas.
 *
 * STEP es siempre Z-arriba, así que `ejeVertical` no se usa (igual que pasaba
 * con DXF).
 */
import type { Vec3 } from "../geometry";
import type { MallaRender, ModeloImportado, OpcionesImport } from "./tipos";
import { MAX_VERTICES_MALLA } from "./tipos";
import type {
  MallaStep,
  PeticionImportStep,
  RespuestaImportStep,
} from "@/workers/spda/importStep.worker";

let worker: Worker | null = null;
let siguienteId = 1;

function asegurarWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../../workers/spda/importStep.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

/** Una lectura por vez: cada llamada espera su propia respuesta por id. */
function leerEnWorker(bytes: ArrayBuffer, nombre: string): Promise<RespuestaImportStep> {
  const w = asegurarWorker();
  const id = siguienteId++;
  return new Promise((resolve, reject) => {
    const alMensaje = (ev: MessageEvent<RespuestaImportStep>) => {
      if (ev.data.id !== id) return;
      limpiar();
      resolve(ev.data);
    };
    const alError = (e: ErrorEvent) => {
      limpiar();
      // Un worker que murió queda inservible: se descarta para que el próximo
      // intento arranque uno nuevo en vez de esperar para siempre.
      worker = null;
      reject(new Error(`Falló el worker de importación STEP: ${e.message || "error desconocido"}`));
    };
    function limpiar() {
      w.removeEventListener("message", alMensaje);
      w.removeEventListener("error", alError);
    }
    w.addEventListener("message", alMensaje);
    w.addEventListener("error", alError);
    const pet: PeticionImportStep = { id, bytes, nombre };
    w.postMessage(pet, [bytes]);
  });
}

export interface LecturaSTEP {
  mallas: MallaStep[];
  /** Unidad declarada en la cabecera, solo informativa: la conversión ya está hecha. */
  unidadArchivo: string | null;
  advertencias: string[];
}

/**
 * Lee un STEP y devuelve sus sólidos teselados, EN METROS.
 *
 * Es el escalón que comparten los dos importadores: el de edificaciones
 * (`importarSTEP`, que arma un `ModeloImportado`) y el de suelo
 * (`importarTerrenoCrudo` en `terreno.ts`, que se queda con las mallas crudas
 * para decimarlas). Ninguno de los dos toca la unidad elegida en el panel:
 * la trae el archivo.
 */
export async function leerSTEP(bytes: ArrayBuffer, nombre: string): Promise<LecturaSTEP> {
  const res = await leerEnWorker(bytes, nombre.replace(/\.(stp|step)$/i, ""));
  if (res.tipo === "error") throw new Error(res.mensaje);
  return { mallas: res.mallas, unidadArchivo: res.unidadArchivo, advertencias: res.advertencias };
}

function aMallaRender(m: MallaStep): MallaRender {
  return {
    nombre: m.nombre,
    positions: m.positions,
    indices: m.indices,
    pesada: m.positions.length / 3 > MAX_VERTICES_MALLA,
  };
}

export async function importarSTEP(
  bytes: ArrayBuffer,
  nombreArchivo: string,
  opts: OpcionesImport,
): Promise<ModeloImportado> {
  const res = await leerSTEP(bytes, nombreArchivo);
  const mallas = res.mallas.map(aMallaRender);
  const advertencias = [...res.advertencias];

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const m of mallas) {
    for (let i = 0; i < m.positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = m.positions[i + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
  }
  if (!isFinite(min[0])) {
    min[0] = min[1] = min[2] = 0;
    max[0] = max[1] = max[2] = 1;
    advertencias.push("No se pudo determinar la extensión del modelo.");
  }
  const bounds = {
    min: [min[0], min[1], min[2]] as Vec3,
    max: [max[0], max[1], max[2]] as Vec3,
  };

  const totalCaras = res.mallas.reduce((a, m) => a + m.caras, 0);
  const planas = res.mallas.reduce((a, m) => a + m.carasPlanas, 0);
  advertencias.push(
    res.unidadArchivo
      ? `Unidad leída del archivo: ${res.unidadArchivo}. STEP la declara, así que no hace falta elegirla ni reimportar.`
      : "El archivo no declara unidad de longitud explícita; OpenCascade asumió milímetros.",
  );
  advertencias.push(
    `${res.mallas.length} sólido(s), ${totalCaras} caras de CAD (${planas} planas) — las planas son las que sirven para delimitar.`,
  );
  for (const m of mallas) {
    if (m.pesada) {
      advertencias.push(
        `"${m.nombre}" tiene demasiados vértices para dibujarlo como sólido: se ve solo el contorno, pero sí entra en el cálculo.`,
      );
    }
  }

  return {
    formato: "step",
    mastiles: [],
    conductores: [],
    lineasEstructura: [],
    mallas,
    terreno: [],
    bounds,
    cotaTierra: bounds.min[2],
    capasDetectadas: res.mallas.map((m) => m.nombre),
    // La unidad la resolvió el archivo: lo que el usuario tenga elegido en el
    // panel no participa, y se informa "m" porque eso es lo que sale.
    unidadUsada: opts.unidad,
    unidadDetectada: "m",
    advertencias,
  };
}
