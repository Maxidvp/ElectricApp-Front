/**
 * Punto de entrada de importación: despacha por extensión al adaptador que toca.
 * Formatos soportados: OBJ, STL, STEP.
 *
 * STEP es el único que **declara su unidad**, así que es el único donde la
 * pieza cae sí o sí donde corresponde. En OBJ/STL la unidad se adivina, y con
 * coordenadas de relevamiento (lejos del origen) errarle no cambia el tamaño:
 * manda la pieza a kilómetros. Además trae las caras del CAD en vez de
 * triángulos sueltos. Ver `step.ts`.
 *
 * DXF se sacó del soporte (2026-09-07): un DXF de terreno modelado en Civil3D
 * como Surface suele exportar como sólido ACIS (entidades `REGION`) — nuestro
 * parser no las interpreta (no hay librería JS para ACIS/SAT), así que ese
 * caso da 0 geometría útil aunque el archivo cargue. STL evita el problema de
 * raíz: siempre llega ya triangulado, sea cual sea el objeto de origen.
 */

import { importarOBJ, importarSTL } from "./mesh";
import { importarSTEP } from "./step";
import type { ModeloImportado, OpcionesImport } from "./tipos";

export * from "./tipos";
export { importarOBJ, importarSTL } from "./mesh";
export { importarSTEP } from "./step";

export const EXTENSIONES_SOPORTADAS = [".obj", ".stl", ".step", ".stp"] as const;

function extension(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i).toLowerCase() : "";
}

export async function importarArchivo(
  file: File,
  opts: OpcionesImport,
): Promise<ModeloImportado> {
  const ext = extension(file.name);
  switch (ext) {
    case ".obj":
      return importarOBJ(await file.text(), opts);
    case ".stl":
      return importarSTL(await file.arrayBuffer(), opts);
    case ".step":
    case ".stp":
      return importarSTEP(await file.arrayBuffer(), file.name, opts);
    default:
      throw new Error(
        `Formato no soportado: "${ext || file.name}". Usá ${EXTENSIONES_SOPORTADAS.join(", ")}.`,
      );
  }
}
