/**
 * Sección "Importar suelo" dentro de "Importar modelo": importar una malla de
 * terreno cruda y decimarla, comparando original vs. resultado. No participa
 * del cálculo de esfera rodante — es un banco de pruebas, ver
 * `state/spda/herramientasStore.ts`.
 */
import { useRef } from "react";
import {
  useHerramientasStore,
  contarVertices,
  contarTriangulos,
  pesoBytes,
  PESO_MAX_BYTES,
} from "@/state/spda/herramientasStore";
import { UNIDADES } from "@/lib/spda/import/tipos";
import { useProyectos } from "@/context/ProyectosContext";

const cls = {
  input:
    "h-8 border border-surface-tonal-a30 rounded-[7px] px-2.5 text-[13px] bg-surface-a10 text-font-a0 outline-none w-full hover:border-surface-tonal-a40 focus:border-info-a10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
  label: "text-xs text-font-a20",
  field: "flex flex-col gap-[5px] mb-2.5",
  h2: "text-[11px] uppercase tracking-wider text-surface-tonal-a40 mt-4 mb-2",
  sub: "text-[11px] text-surface-tonal-a40",
  btn: "w-full bg-primary-a0 text-font-a0 font-semibold rounded-md py-2 mt-1.5 disabled:opacity-50 disabled:cursor-not-allowed",
  btnSecondary:
    "w-full bg-surface-a10 text-font-a0 border border-surface-tonal-a30 rounded-md py-2 mt-1.5 disabled:opacity-50 disabled:cursor-not-allowed",
  warnbox:
    "bg-warning-a0/15 border border-warning-a0 text-warning-a10 rounded-md p-2 text-[11px] mt-2",
  errbox: "bg-danger-a0/15 border border-danger-a0 text-danger-a10 rounded-md p-2 text-[11px] mt-2",
};

function fmt(n: number): string {
  return n.toLocaleString("es-AR");
}

function fmtMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

export default function SeccionImportarSuelo() {
  const s = useHerramientasStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const { proyectoActivo } = useProyectos();

  const vOriginal = s.terreno ? contarVertices(s.terreno) : 0;
  const tOriginal = s.terreno ? contarTriangulos(s.terreno) : 0;
  const pesoOriginal = s.terreno ? pesoBytes(s.terreno) : 0;
  const vDecimado = s.terrenoDecimado ? contarVertices(s.terrenoDecimado) : 0;
  const tDecimado = s.terrenoDecimado ? contarTriangulos(s.terrenoDecimado) : 0;
  const pesoDecimado = s.terrenoDecimado ? pesoBytes(s.terrenoDecimado) : 0;
  const vObjetivo = Math.round(vOriginal * (1 - s.fraccionQuitar));

  return (
    <div>
      <h2 className={cls.h2}>Importar suelo</h2>
      <div className={`${cls.field} flex-row gap-2`} style={{ display: "flex" }}>
        <div className="flex-1">
          <label className={cls.label}>Unidad del archivo</label>
          <select
            className={cls.input}
            value={s.opcionesImport.unidad}
            onChange={(e) =>
              s.setOpcionesImport({ unidad: e.target.value as (typeof UNIDADES)[number]["valor"] })
            }
          >
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.etiqueta} ({u.valor})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={cls.label}>Eje vertical</label>
          <select
            className={cls.input}
            value={s.opcionesImport.ejeVertical}
            onChange={(e) => s.setOpcionesImport({ ejeVertical: e.target.value as "Y" | "Z" })}
          >
            <option value="Z">Z arriba (CAD)</option>
            <option value="Y">Y arriba (mallas)</option>
          </select>
        </div>
      </div>

      <button
        className={cls.btnSecondary}
        onClick={() => fileRef.current?.click()}
        disabled={s.importandoTerreno}
      >
        {s.importandoTerreno
          ? "Importando…"
          : s.terrenoArchivo
            ? `Reemplazar (${s.terrenoArchivo})`
            : "Elegir archivo (.step / .stl / .obj)"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".obj,.stl,.step,.stp"
        hidden
        onChange={(e) => e.target.files?.[0] && s.cargarTerreno(e.target.files[0])}
      />
      {s.errorTerreno && <div className={cls.errbox}>{s.errorTerreno}</div>}
      {s.terreno && (
        <p className={`${cls.sub} mt-2`}>
          Original: {fmt(vOriginal)} vértices · {fmt(tOriginal)} triángulos ·{" "}
          <b className="text-font-a0">{fmtMB(pesoOriginal)} MB</b>
          {s.terrenoUnidadArchivo && (
            <>
              <br />
              Unidad leída del archivo: <b className="text-font-a0">{s.terrenoUnidadArchivo}</b> — STEP
              la declara, así que el terreno cae en las mismas coordenadas que las edificaciones.
            </>
          )}
          {s.terrenoDescartadosPorDuplicado > 0 && (
            <>
              <br />
              Se descartaron {fmt(s.terrenoDescartadosPorDuplicado)} triángulos: parecían la cara
              inferior duplicada de un sólido.
            </>
          )}
        </p>
      )}
      {s.terrenoAvisos.map((a, i) => (
        <div className={cls.warnbox} key={i}>
          {a}
        </div>
      ))}

      <h2 className={cls.h2}>Decimar</h2>
      <div className={cls.field}>
        <label className={cls.label}>
          Quitar {Math.round(s.fraccionQuitar * 100)}% de los vértices
          {s.terreno && <> — objetivo ≈ {fmt(vObjetivo)} vértices</>}
        </label>
        <input
          type="range"
          min={0}
          max={99}
          step={1}
          value={Math.round(s.fraccionQuitar * 100)}
          onChange={(e) => s.setFraccionQuitar(Number(e.target.value) / 100)}
        />
      </div>
      <button
        className={cls.btn}
        disabled={!s.terreno || s.decimando}
        onClick={() => s.decimar()}
      >
        {s.decimando ? "Decimando…" : "Decimar"}
      </button>
      {s.errorDecimar && <div className={cls.errbox}>{s.errorDecimar}</div>}
      {s.terrenoDecimado && (
        <p className={`${cls.sub} mt-2`}>
          Resultado: {fmt(vDecimado)} vértices · {fmt(tDecimado)} triángulos ·{" "}
          <b className={pesoDecimado > PESO_MAX_BYTES ? "text-danger-a10" : "text-font-a0"}>
            {fmtMB(pesoDecimado)} MB
          </b>
          {s.decimarMs != null && <> · {(s.decimarMs / 1000).toFixed(1)}s</>}
          <br />
          Peso crudo de <code>positions</code>+<code>indices</code> — lo que ocuparía guardado tal
          cual en la base (antes de base64, que suma ~33% más para el transporte).
        </p>
      )}

      {s.terrenoDecimado && (
        <>
          <button
            className={cls.btn}
            disabled={
              !proyectoActivo || s.guardando || pesoDecimado > PESO_MAX_BYTES || pesoDecimado === 0
            }
            onClick={() => proyectoActivo && s.guardarTerreno(proyectoActivo.id)}
          >
            {s.guardando
              ? "Guardando…"
              : pesoDecimado > PESO_MAX_BYTES
                ? `Supera el límite de ${fmtMB(PESO_MAX_BYTES)} MB`
                : "Guardar suelo en el proyecto"}
          </button>
          {!proyectoActivo && (
            <p className={`${cls.sub} mt-1`}>Elegí un proyecto activo para poder guardar.</p>
          )}
          {s.errorGuardar && <div className={cls.errbox}>{s.errorGuardar}</div>}
          {s.guardadoOk && (
            <p className={`${cls.sub} mt-1 text-success-a10`}>Suelo guardado en el proyecto.</p>
          )}
        </>
      )}

      <h2 className={cls.h2}>Comparar</h2>
      <div className="flex gap-2 flex-wrap">
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input
            type="checkbox"
            checked={s.mostrarOriginal}
            onChange={() => s.toggle("mostrarOriginal")}
          />
          Malla original
        </label>
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input
            type="checkbox"
            checked={s.mostrarDecimado}
            onChange={() => s.toggle("mostrarDecimado")}
            disabled={!s.terrenoDecimado}
          />
          Malla decimada
        </label>
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input
            type="checkbox"
            checked={s.mostrarAristasDecimado}
            onChange={() => s.toggle("mostrarAristasDecimado")}
            disabled={!s.terrenoDecimado}
          />
          Ver aristas
        </label>
      </div>
      <p className={`${cls.sub} mt-1.5`}>
        Original en wireframe celeste, decimada en sólido naranja — con las dos activas se ve qué
        tanto se aparta la simplificación de la forma real. "Ver aristas" dibuja la triangulación
        real de la malla decimada encima del sólido.
      </p>
    </div>
  );
}
