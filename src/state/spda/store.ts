/**
 * Estado global (zustand) y orquestación de los dos Web Workers.
 *
 * Es la única capa que conoce a la vez el modelo importado, los captadores
 * definidos a mano y los resultados del cálculo. Todo lo pesado se delega:
 *
 *   calculo.worker    → evaluar los vértices reales de la malla y extraer la envolvente
 *   exportCad.worker  → construir los sólidos B-rep y exportar STEP
 *
 * Ambos se crean perezosamente (`getWorker` / `getExportWorker`) y se reusan; el
 * de export además carga ~23 MB de WASM la primera vez, así que conviene no
 * instanciarlo hasta que haga falta. Las respuestas llegan por `onmessage` y se
 * vuelcan al estado en `manejarRespuesta` / `manejarRespuestaExport`, que es
 * también donde se dispara la descarga del archivo.
 *
 * Cada petición lleva un `id` incremental: si el usuario cambia algo mientras
 * corre un cálculo, la respuesta vieja se descarta al llegar.
 *
 * OJO: `radioEfectivo()` y `sistema()` son funciones, no valores. Al usarlas
 * como selector (`useStore((s) => s.radioEfectivo())`) se recalculan en cada
 * render, que para estos casos es barato y evita estado derivado desincronizado.
 *
 * Portado de Sdpa (spike standalone) a Front: única diferencia real son las
 * rutas de import (`@/lib/spda/...`, `@/workers/spda/...`).
 *
 * `resultado` se evalúa sobre los VÉRTICES REALES de `modelo.mallas`, no sobre
 * una nube de puntos muestreada — esa nube se sacó por completo (mesh.ts ya no
 * la genera). Solo alimenta el resumen numérico de `Resultados.tsx`; el visor
 * ya no colorea la malla por margen — `ModeloSolido` es un sólido de un color
 * fijo, y protegido/expuesto se lee por transparencia contra las superficies
 * de protección (`ZonasProtegidas`/`ConstruccionEsfera`), sin cálculo por
 * vértice para eso.
 */

import { create } from "zustand";
import {
  NIVELES_PROTECCION,
  type NPR,
} from "@/lib/spda/iec62305";
import type { Conductor, Mastil, SistemaCaptacion, Vec3 } from "@/lib/spda/geometry";
import { CONFIG_POR_DEFECTO, type ConfigCalculo, type ResultadoModelo } from "@/lib/spda/rollingSphere";
import type { MallaISO } from "@/lib/spda/marchingCubes";
import {
  importarArchivo,
  OPCIONES_IMPORT_POR_DEFECTO,
  type ModeloImportado,
  type OpcionesImport,
} from "@/lib/spda/import";
import type { PeticionWorker, RespuestaWorker } from "@/workers/spda/calculo.worker";
import { construirGeometriaExport } from "@/lib/spda/exportCad/geometria";
import type { PeticionExportCad, RespuestaExportCad } from "@/workers/spda/exportCad.worker";
import {
  getSpdaMallas,
  getSpdaMalla,
  deleteSpdaMalla,
  renombrarSpdaMalla,
  type SpdaMallaMeta,
} from "@/services/spdaMallas";
import { base64ABytes } from "@/lib/spda/base64";
import type { MallaRender } from "@/lib/spda/import/tipos";

/**
 * Un worker puede fallar SIN mandar ningún mensaje: si el módulo no carga o
 * revienta fuera del try/catch del handler, salta `onerror`/`onmessageerror` y
 * el `postMessage` nunca tiene respuesta. Sin esto el estado quedaba en
 * `calculando: true` para siempre, con el overlay de progreso tapando el visor
 * y sin ningún mensaje que explique qué pasó. Además se descarta la instancia
 * rota para que el próximo intento cree una nueva en vez de reusar el cadáver.
 */
function alFallarWorker(mensaje: string, cual: "calculo" | "export") {
  if (cual === "calculo") {
    worker = null;
    useSpdaStore.setState({ calculando: false, progreso: null, errorImport: mensaje });
  } else {
    exportWorker = null;
    useSpdaStore.setState({ exportandoCAD: false, errorExportCAD: mensaje });
  }
}

let worker: Worker | null = null;
let jobId = 0;
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../../workers/spda/calculo.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (ev: MessageEvent<RespuestaWorker>) => manejarRespuesta(ev.data);
    worker.onerror = (e) =>
      alFallarWorker(`Falló el worker de cálculo: ${e.message || "error desconocido"}`, "calculo");
    worker.onmessageerror = () =>
      alFallarWorker("El worker de cálculo devolvió un mensaje ilegible.", "calculo");
  }
  return worker;
}

let exportWorker: Worker | null = null;
let exportJobId = 0;
function getExportWorker(): Worker {
  if (!exportWorker) {
    exportWorker = new Worker(new URL("../../workers/spda/exportCad.worker.ts", import.meta.url), {
      type: "module",
    });
    exportWorker.onmessage = (ev: MessageEvent<RespuestaExportCad>) => manejarRespuestaExport(ev.data);
    exportWorker.onerror = (e) =>
      alFallarWorker(`Falló el worker de exportación: ${e.message || "error desconocido"}`, "export");
    exportWorker.onmessageerror = () =>
      alFallarWorker("El worker de exportación devolvió un mensaje ilegible.", "export");
  }
  return exportWorker;
}

interface Estado {
  npr: NPR;
  radioManual: number | null;
  config: Omit<ConfigCalculo, "radio" | "cotaTierra">;

  mastiles: Mastil[];
  conductores: Conductor[];
  cotaTierra: number | null;

  modelo: ModeloImportado | null;
  ultimoArchivo: File | null;
  opcionesImport: OpcionesImport;
  importando: boolean;
  errorImport: string | null;

  /** Evaluado sobre los vértices reales de `modelo.mallas`. `null` hasta el primer "Contrastar modelo", o si el modelo no tiene mallas. */
  resultado: ResultadoModelo | null;
  envolvente: MallaISO | null;
  calculando: boolean;
  progreso: { fase: string; frac: number } | null;

  seleccionId: string | null;
  mostrarEnvolvente: boolean;
  mostrarEsfera: boolean;
  mostrarZonas: boolean;
  mostrarEsferasEntre: boolean;
  mostrarSuelo: boolean;
  mostrarSeccion: boolean;
  /** Sólido real importado (`modelo.mallas`) — un color fijo, sin heatmap. */
  mostrarMalla: boolean;

  /**
   * Altura de circulación peatonal (m sobre el suelo) a la que se corta el
   * volumen protegido. 1.8 m es el criterio más habitual; algunas obras usan 2 m.
   */
  alturaSeccion: number;

  exportandoCAD: boolean;
  errorExportCAD: string | null;

  /** Metadata de las mallas guardadas del proyecto activo (sin bytes — ver `services/spdaMallas.ts`). */
  mallasGuardadas: SpdaMallaMeta[];
  /** ids activados por el usuario para verse en el visor (geometría en `mallasCargadas`, bajada bajo demanda). */
  mallasActivasIds: number[];
  mallasCargadas: Record<number, MallaRender>;
  cargandoMallaId: number | null;
  errorMallasGuardadas: string | null;
  /** Proyecto del que salió `mallasGuardadas` — para recordar las activas por proyecto. */
  proyectoIdMallas: number | null;

  // acciones
  setNPR: (npr: NPR) => void;
  setRadioManual: (r: number | null) => void;
  setAlturaSeccion: (h: number) => void;
  radioEfectivo: () => number;
  sistema: () => SistemaCaptacion;

  addMastil: (base: Vec3, altura: number) => void;
  updateMastil: (id: string, patch: Partial<Omit<Mastil, "id" | "tipo">>) => void;
  removeElemento: (id: string) => void;
  setSeleccion: (id: string | null) => void;

  cargarArchivo: (file: File) => Promise<void>;
  reimportar: () => Promise<void>;
  /**
   * Suelta el modelo importado. El import es andamio: sirve para delimitar los
   * edificios y guardarlos, y una vez guardados Diseño trabaja con las mallas
   * de la base. Dejarlo cargado al salir de "Importar modelo" duplicaba la
   * estructura en el visor y en el cálculo (el STL crudo MÁS el edificio
   * guardado, ver `mallasParaCalculo`).
   */
  descartarModelo: () => void;
  setOpcionesImport: (patch: Partial<OpcionesImport>) => void;

  calcular: () => void;
  calcularEnvolvente: (resolucion?: number) => void;
  /** ¿Hay geometría para contrastar? (modelo importado o edificios guardados activos) */
  hayGeometria: () => boolean;
  exportarCAD: () => void;
  cargarMallasGuardadas: (proyectoId: number) => Promise<void>;
  toggleMallaGuardada: (id: number) => Promise<void>;
  borrarMallaGuardada: (id: number) => Promise<void>;
  renombrarMallaGuardada: (id: number, nombre: string) => Promise<void>;
  toggle: (
    k:
      | "mostrarEnvolvente"
      | "mostrarEsfera"
      | "mostrarSeccion"
      | "mostrarZonas"
      | "mostrarEsferasEntre"
      | "mostrarSuelo"
      | "mostrarMalla",
  ) => void;
}

/**
 * Qué mallas guardadas estaban activas, por proyecto. Va en localStorage (mismo
 * criterio que `ea_proyecto` en `ProyectosContext`) y no en la base: es una
 * preferencia de vista de ESTE navegador, no del proyecto.
 */
const lsActivas = (proyectoId: number) => `ea_spda_activas_${proyectoId}`;

function leerActivasRecordadas(proyectoId: number): number[] {
  try {
    const crudo = localStorage.getItem(lsActivas(proyectoId));
    const ids: unknown = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(ids) ? ids.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return []; // modo privado / storage bloqueado: no es motivo para romper nada
  }
}

function recordarActivas(proyectoId: number, ids: number[]) {
  try {
    localStorage.setItem(lsActivas(proyectoId), JSON.stringify(ids));
  } catch {
    /* idem */
  }
}

async function bajarMalla(id: number): Promise<MallaRender> {
  const completa = await getSpdaMalla(id);
  return {
    nombre: completa.nombre,
    positions: new Float32Array(base64ABytes(completa.positions).buffer),
    indices: completa.indices ? new Uint32Array(base64ABytes(completa.indices).buffer) : null,
  };
}

/**
 * Cota de tierra derivada: si hay algún SUELO guardado activo, manda el Z mínimo
 * de esos suelos; si no, la del modelo importado. Antes la cota salía solo del
 * import, así que un proyecto con el terreno ya guardado y ningún modelo abierto
 * calculaba contra el plano z=0 por defecto.
 */
function cotaDeTerrenosActivos(s: Estado): number | null {
  const suelos = s.mallasActivasIds
    .filter((id) => s.mallasGuardadas.find((m) => m.id === id)?.tipo === "suelo")
    .map((id) => s.mallasCargadas[id])
    .filter((m): m is MallaRender => !!m);
  if (suelos.length === 0) return s.modelo?.cotaTierra ?? 0;
  let minZ = Infinity;
  for (const m of suelos) {
    for (let i = 2; i < m.positions.length; i += 3) {
      if (m.positions[i] < minZ) minZ = m.positions[i];
    }
  }
  return isFinite(minZ) ? minZ : (s.modelo?.cotaTierra ?? 0);
}

/**
 * Geometría que entra al cálculo: el modelo recién importado MÁS los edificios
 * guardados que estén activos.
 *
 * El suelo queda AFUERA a propósito. Sus vértices lejos de los mástiles saldrían
 * "expuestos" —lo cual es cierto, el suelo abierto está expuesto— y hundirían el
 * porcentaje, pero "cobertura de protección" acá significa cuánto de la
 * ESTRUCTURA queda protegido. El terreno igual participa: define la cota de
 * tierra (`cotaDeTerrenosActivos`), que es lo que la esfera rodante usa como
 * plano de apoyo.
 */
function mallasParaCalculo(s: Estado): MallaRender[] {
  const edificios = s.mallasActivasIds
    .filter((id) => s.mallasGuardadas.find((m) => m.id === id)?.tipo === "edificio")
    .map((id) => s.mallasCargadas[id])
    .filter((m): m is MallaRender => !!m);
  return [...(s.modelo?.mallas ?? []), ...edificios];
}

/**
 * Todo lo que cambia la respuesta del cálculo tiene que borrar el resultado
 * anterior: si no, el resumen sigue mostrando la cobertura y el cartel
 * "Estructura protegida" de una configuración que ya no es la de la pantalla
 * (agregar un mástil, cambiar el NPR o el radio). En una herramienta de
 * cumplimiento eso es peor que no mostrar nada, porque parece válido.
 */
const INVALIDA_RESULTADO = { resultado: null, envolvente: null } as const;

export const useSpdaStore = create<Estado>((set, get) => ({
  npr: "II",
  radioManual: null,
  config: { ...CONFIG_POR_DEFECTO },

  mastiles: [],
  conductores: [],
  cotaTierra: 0,

  modelo: null,
  ultimoArchivo: null,
  opcionesImport: { ...OPCIONES_IMPORT_POR_DEFECTO },
  importando: false,
  errorImport: null,

  resultado: null,
  envolvente: null,
  calculando: false,
  progreso: null,

  seleccionId: null,
  mostrarEnvolvente: true,
  mostrarEsfera: false,
  mostrarZonas: true,
  mostrarEsferasEntre: true,
  mostrarSuelo: true,
  mostrarSeccion: true,
  mostrarMalla: true,
  alturaSeccion: 1.8,

  exportandoCAD: false,
  errorExportCAD: null,

  mallasGuardadas: [],
  mallasActivasIds: [],
  mallasCargadas: {},
  cargandoMallaId: null,
  errorMallasGuardadas: null,
  proyectoIdMallas: null,

  setNPR: (npr) => set({ npr, radioManual: null, ...INVALIDA_RESULTADO }),
  setRadioManual: (radioManual) => set({ radioManual, ...INVALIDA_RESULTADO }),
  setAlturaSeccion: (alturaSeccion) => set({ alturaSeccion: Math.max(0, alturaSeccion) }),
  radioEfectivo: () => get().radioManual ?? NIVELES_PROTECCION[get().npr].radioEsfera,
  hayGeometria: () => mallasParaCalculo(get()).length > 0,
  sistema: () => ({
    elementos: [...get().mastiles, ...get().conductores],
    cotaTierra: get().cotaTierra,
  }),

  addMastil: (base, altura) =>
    set((s) => ({
      mastiles: [
        ...s.mastiles,
        { id: `m-${Date.now().toString(36)}`, tipo: "mastil", base, altura },
      ],
      ...INVALIDA_RESULTADO,
    })),
  updateMastil: (id, patch) =>
    set((s) => ({
      mastiles: s.mastiles.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      ...INVALIDA_RESULTADO,
    })),
  removeElemento: (id) =>
    set((s) => ({
      mastiles: s.mastiles.filter((m) => m.id !== id),
      conductores: s.conductores.filter((c) => c.id !== id),
      seleccionId: s.seleccionId === id ? null : s.seleccionId,
      ...INVALIDA_RESULTADO,
    })),
  setSeleccion: (seleccionId) => set({ seleccionId }),

  // Se importa con lo que el usuario tenga elegido en el panel. Antes esto
  // pisaba `ejeVertical` con un default fijo, así que elegir "Z arriba (CAD)"
  // no tenía ningún efecto en el primer import: había que importar (mal),
  // volver a tocar el selector y recién ahí "Reimportar con estos valores".
  cargarArchivo: async (file) => {
    await aplicarImport(file, get().opcionesImport);
  },
  reimportar: async () => {
    const { ultimoArchivo, opcionesImport } = get();
    if (ultimoArchivo) await aplicarImport(ultimoArchivo, opcionesImport);
  },
  descartarModelo: () =>
    set((s) => ({
      modelo: null,
      ultimoArchivo: null,
      errorImport: null,
      // La cota volvía a quedar en la del archivo que ya no está; se recalcula
      // con lo que quede (los suelos guardados activos, o 0).
      cotaTierra: cotaDeTerrenosActivos({ ...s, modelo: null }),
      ...INVALIDA_RESULTADO,
    })),
  setOpcionesImport: (patch) =>
    set((s) => ({ opcionesImport: { ...s.opcionesImport, ...patch } })),

  calcular: () => {
    const s = get();
    const mallas = mallasParaCalculo(s);
    if (mallas.length === 0) {
      set({
        errorImport:
          "No hay geometría para contrastar: importá un modelo o activá un edificio guardado.",
      });
      return;
    }
    // Se COPIAN las posiciones a un buffer propio para transferirlo al worker:
    // transferir `m.positions.buffer` directo dejaría al modelo sin geometría
    // (el buffer queda desacoplado del lado del emisor) y se apagaría el visor.
    const totalFloats = mallas.reduce((acc, m) => acc + m.positions.length, 0);
    const posiciones = new Float32Array(totalFloats);
    let off = 0;
    for (const m of mallas) {
      posiciones.set(m.positions, off);
      off += m.positions.length;
    }
    set({ calculando: true, progreso: { fase: "evaluar", frac: 0 } });
    const id = ++jobId;
    const pet: PeticionWorker = {
      tipo: "evaluar",
      id,
      posiciones,
      sistema: s.sistema(),
      cfg: { ...s.config, radio: s.radioEfectivo(), cotaTierra: s.cotaTierra },
    };
    getWorker().postMessage(pet, [posiciones.buffer]);
  },

  calcularEnvolvente: (resolucion = 40) => {
    const s = get();
    // Mismo criterio que `calcular`: la envolvente se extrae alrededor de TODA
    // la geometría que se está evaluando, no solo del modelo recién importado.
    const mallas = mallasParaCalculo(s);
    if (mallas.length === 0) return;
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const m of mallas) {
      for (let i = 0; i < m.positions.length; i += 3) {
        for (let k = 0; k < 3; k++) {
          const v = m.positions[i + k];
          if (v < min[k]) min[k] = v;
          if (v > max[k]) max[k] = v;
        }
      }
    }
    const R = s.radioEfectivo();
    const bounds = {
      min: [min[0] - R, min[1] - R, Math.min(s.cotaTierra ?? 0, min[2])] as Vec3,
      max: [max[0] + R, max[1] + R, max[2] + R] as Vec3,
    };
    const span = [
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2],
    ];
    const mx = Math.max(...span);
    const dims: [number, number, number] = [
      Math.max(8, Math.round((span[0] / mx) * resolucion)),
      Math.max(8, Math.round((span[1] / mx) * resolucion)),
      Math.max(8, Math.round((span[2] / mx) * resolucion)),
    ];
    set({ calculando: true, progreso: { fase: "envolvente", frac: 0 } });
    const id = ++jobId;
    const pet: PeticionWorker = {
      tipo: "envolvente",
      id,
      bounds,
      dims,
      sistema: s.sistema(),
      cfg: { ...s.config, radio: R, cotaTierra: s.cotaTierra },
    };
    getWorker().postMessage(pet);
  },

  exportarCAD: () => {
    const s = get();
    const hayPuntas = s.mastiles.some((m) => m.base[2] + m.altura - (s.cotaTierra ?? 0) > 0.01);
    if (!hayPuntas) {
      set({ errorExportCAD: "No hay puntas con altura > 0: agregá al menos un mástil." });
      return;
    }
    set({ exportandoCAD: true, errorExportCAD: null });
    const construccion = construirGeometriaExport(s.mastiles, s.radioEfectivo(), s.cotaTierra ?? 0);
    const pet: PeticionExportCad = {
      id: ++exportJobId,
      construccion,
      alturaSeccion: s.mostrarSeccion ? s.alturaSeccion : undefined,
    };
    getExportWorker().postMessage(pet);
  },

  cargarMallasGuardadas: async (proyectoId) => {
    try {
      const mallasGuardadas = await getSpdaMallas(proyectoId);
      set({ mallasGuardadas, proyectoIdMallas: proyectoId, errorMallasGuardadas: null });

      // Restaurar las que estaban activas la última vez. Se descartan los ids
      // que ya no existen (borrados desde otra sesión) para no dejar basura en
      // localStorage ni intentar bajarlos.
      const recordadas = leerActivasRecordadas(proyectoId).filter((id) =>
        mallasGuardadas.some((m) => m.id === id),
      );
      const yaActivas = get().mallasActivasIds;
      const faltantes = recordadas.filter((id) => !yaActivas.includes(id));
      if (faltantes.length === 0) {
        recordarActivas(proyectoId, recordadas);
        return;
      }
      const bajadas = await Promise.all(
        faltantes.map((id) => bajarMalla(id).then((m) => [id, m] as const).catch(() => null)),
      );
      set((st) => {
        const cargadas = { ...st.mallasCargadas };
        const activas = [...st.mallasActivasIds];
        for (const par of bajadas) {
          if (!par) continue;
          cargadas[par[0]] = par[1];
          if (!activas.includes(par[0])) activas.push(par[0]);
        }
        return { mallasCargadas: cargadas, mallasActivasIds: activas };
      });
      recordarActivas(proyectoId, get().mallasActivasIds);
      set({ cotaTierra: cotaDeTerrenosActivos(get()) });
    } catch (err) {
      set({ errorMallasGuardadas: err instanceof Error ? err.message : String(err) });
    }
  },

  toggleMallaGuardada: async (id) => {
    const s = get();
    const persistir = () => {
      const st = get();
      if (st.proyectoIdMallas != null) recordarActivas(st.proyectoIdMallas, st.mallasActivasIds);
      // Activar o desactivar una malla cambia la geometría que se evalúa y la
      // cota, así que el resultado anterior deja de corresponder.
      set({ cotaTierra: cotaDeTerrenosActivos(get()), ...INVALIDA_RESULTADO });
    };

    if (s.mallasActivasIds.includes(id)) {
      set({ mallasActivasIds: s.mallasActivasIds.filter((x) => x !== id) });
      persistir();
      return;
    }
    if (s.mallasCargadas[id]) {
      set({ mallasActivasIds: [...s.mallasActivasIds, id] });
      persistir();
      return;
    }
    set({ cargandoMallaId: id, errorMallasGuardadas: null });
    try {
      const malla = await bajarMalla(id);
      set((st) => ({
        mallasCargadas: { ...st.mallasCargadas, [id]: malla },
        mallasActivasIds: [...st.mallasActivasIds, id],
        cargandoMallaId: null,
      }));
      persistir();
    } catch (err) {
      set({ cargandoMallaId: null, errorMallasGuardadas: err instanceof Error ? err.message : String(err) });
    }
  },

  borrarMallaGuardada: async (id) => {
    try {
      await deleteSpdaMalla(id);
      set((st) => {
        const cargadas = { ...st.mallasCargadas };
        delete cargadas[id];
        return {
          mallasGuardadas: st.mallasGuardadas.filter((m) => m.id !== id),
          mallasActivasIds: st.mallasActivasIds.filter((x) => x !== id),
          mallasCargadas: cargadas,
          errorMallasGuardadas: null,
        };
      });
      const st = get();
      if (st.proyectoIdMallas != null) recordarActivas(st.proyectoIdMallas, st.mallasActivasIds);
      set({ cotaTierra: cotaDeTerrenosActivos(get()), ...INVALIDA_RESULTADO });
    } catch (err) {
      set({ errorMallasGuardadas: err instanceof Error ? err.message : String(err) });
    }
  },

  renombrarMallaGuardada: async (id, nombre) => {
    const limpio = nombre.trim();
    if (!limpio) return;
    try {
      const actualizada = await renombrarSpdaMalla(id, limpio);
      set((st) => ({
        mallasGuardadas: st.mallasGuardadas.map((m) => (m.id === id ? actualizada : m)),
        errorMallasGuardadas: null,
      }));
    } catch (err) {
      set({ errorMallasGuardadas: err instanceof Error ? err.message : String(err) });
    }
  },

  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Pick<Estado, typeof k>),
}));

function manejarRespuesta(msg: RespuestaWorker) {
  const set = useSpdaStore.setState;
  switch (msg.tipo) {
    case "progreso":
      set({ progreso: { fase: msg.fase, frac: msg.frac } });
      break;
    case "evaluar:ok":
      set({ resultado: msg.resultado, calculando: false, progreso: null });
      break;
    case "envolvente:ok":
      set({ envolvente: msg.malla, calculando: false, progreso: null });
      break;
    case "error":
      set({ calculando: false, progreso: null, errorImport: msg.mensaje });
      break;
  }
}

function manejarRespuestaExport(msg: RespuestaExportCad) {
  const set = useSpdaStore.setState;
  if (msg.tipo === "error") {
    set({ exportandoCAD: false, errorExportCAD: msg.mensaje });
    return;
  }
  const blob = new Blob([msg.bytes], { type: "application/step" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = msg.nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  set({ exportandoCAD: false });
}

async function aplicarImport(file: File, opciones: OpcionesImport) {
  const set = useSpdaStore.setState;
  set({ importando: true, errorImport: null });
  try {
    const modelo = await importarArchivo(file, opciones);
    const traeCaptacion = modelo.mastiles.length > 0 || modelo.conductores.length > 0;
    set((s) => ({
      modelo,
      ultimoArchivo: file,
      // Si el archivo declaró su unidad, el selector pasa a reflejarla.
      opcionesImport: modelo.unidadDetectada
        ? { ...opciones, unidad: modelo.unidadDetectada }
        : opciones,
      // Las mallas no traen captación: se conserva lo que el usuario cargó a mano.
      mastiles: traeCaptacion ? modelo.mastiles : s.mastiles,
      conductores: traeCaptacion ? modelo.conductores : s.conductores,
      cotaTierra: modelo.cotaTierra,
      resultado: null,
      envolvente: null,
      importando: false,
    }));
  } catch (err) {
    set({ importando: false, errorImport: err instanceof Error ? err.message : String(err) });
  }
}

// Mismo criterio que en `edificiosStore`: el modelo importado vive en memoria y
// se ve en un canvas WebGL, así que sin esto no hay forma de verificar desde
// afuera que la geometría llegó donde corresponde. No sale en producción.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __spda?: typeof useSpdaStore }).__spda = useSpdaStore;
}
