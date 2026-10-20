/**
 * Sección "Importar modelo": contenedor de las sub-secciones de import.
 *
 * "Importar edificaciones" es el import real (alimenta `useSpdaStore.modelo`,
 * el que usa Diseño para calcular) — vivía en `Panel.tsx` y se movió acá para
 * no duplicar navegación. "Importar suelo" es un banco de pruebas aparte
 * (`useHerramientasStore`), no participa del cálculo todavía — ver memoria
 * del proyecto para el plan de integrarlo más adelante.
 *
 * Cada sub-sección es su propio componente en `SeccionXxx.tsx`, este archivo
 * solo arma el selector y decide cuál mostrar.
 */
import { useState } from "react";
import SeccionImportarEdificaciones from "./SeccionImportarEdificaciones";
import SeccionImportarSuelo from "./SeccionImportarSuelo";

type SeccionId = "importar-edificaciones" | "importar-suelo";

const SECCIONES: { id: SeccionId; nombre: string }[] = [
  { id: "importar-edificaciones", nombre: "Importar edificaciones" },
  { id: "importar-suelo", nombre: "Importar suelo" },
];

export default function PanelImportarModelo() {
  const [seccion, setSeccion] = useState<SeccionId>("importar-edificaciones");

  return (
    <div>
      <h1 className="text-base font-semibold m-0 mb-0.5">Importar modelo</h1>
      <p className="text-[11px] text-surface-tonal-a40 mb-3">
        Importar los distintos elementos del sitio antes de calcular en Diseño.
      </p>

      <div className="flex flex-col gap-1 mb-4">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            className={`text-left text-xs px-2.5 py-1.5 rounded-md transition-colors ${
              seccion === s.id
                ? "bg-primary-a0 text-font-a0"
                : "bg-surface-a10 text-surface-tonal-a40 hover:text-font-a0 hover:bg-surface-tonal-a10"
            }`}
          >
            {s.nombre}
          </button>
        ))}
      </div>

      {seccion === "importar-edificaciones" && <SeccionImportarEdificaciones />}
      {seccion === "importar-suelo" && <SeccionImportarSuelo />}
    </div>
  );
}
