/**
 * Punto de entrada de importación: despacha por extensión al adaptador que toca.
 * Formatos soportados: DXF (AutoCAD), OBJ, STL.
 */

import { importarDXF } from "./dxf";
import { importarOBJ, importarSTL } from "./mesh";
import type { ModeloImportado, OpcionesImport } from "./tipos";

export * from "./tipos";
export { importarDXF } from "./dxf";
export { importarOBJ, importarSTL } from "./mesh";

export const EXTENSIONES_SOPORTADAS = [".dxf", ".obj", ".stl"] as const;

function extension(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i).toLowerCase() : "";
}

/** Sugiere el eje vertical por defecto según el formato. */
export function ejeVerticalPorDefecto(nombre: string): "Y" | "Z" {
  return extension(nombre) === ".dxf" ? "Z" : "Y";
}

export async function importarArchivo(
  file: File,
  opts: OpcionesImport,
): Promise<ModeloImportado> {
  const ext = extension(file.name);
  switch (ext) {
    case ".dxf":
      return importarDXF(await file.text(), opts);
    case ".obj":
      return importarOBJ(await file.text(), opts);
    case ".stl":
      return importarSTL(await file.arrayBuffer(), opts);
    default:
      throw new Error(
        `Formato no soportado: "${ext || file.name}". Usá ${EXTENSIONES_SOPORTADAS.join(", ")}.`,
      );
  }
}
