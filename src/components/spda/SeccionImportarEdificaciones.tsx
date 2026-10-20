/**
 * Sección "Importar edificaciones" dentro de "Importar modelo": import del
 * modelo de ESTRUCTURA (OBJ/STL) que alimenta el cálculo real de Diseño —
 * `useSpdaStore.modelo`, del que salen `resultado`, `ModeloSolido`/heatmap,
 * etc. A diferencia de "Importar suelo" (`useHerramientasStore`, un banco de
 * pruebas aislado del cálculo), esto SÍ es el dato que usa Diseño.
 *
 * Contenido idéntico al que tenía `Panel.tsx` antes de mudarse acá — se sacó
 * de ahí por quedar redundante con la navegación de "Importar modelo", no
 * porque haya cambiado la lógica.
 */
import { useEffect, useRef, useState } from "react";
import { useSpdaStore } from "@/state/spda/store";
import { useEdificiosStore } from "@/state/spda/edificiosStore";
import { agruparClicks } from "@/lib/spda/edificios/arreglo";
import { UNIDADES } from "@/lib/spda/import";
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
  warnbox: "bg-warning-a0/15 border border-warning-a0 text-warning-a10 rounded-md p-2 text-[11px] mt-2",
  errbox: "bg-danger-a0/15 border border-danger-a0 text-danger-a10 rounded-md p-2 text-[11px] mt-2",
};

function Badge({ tono, children }: { tono: "ok" | "warn"; children: React.ReactNode }) {
  const color =
    tono === "ok" ? "bg-success-a0/20 text-success-a10" : "bg-warning-a0/20 text-warning-a10";
  return <span className={`inline-block px-1.5 py-0.5 rounded-full text-[11px] ml-1.5 ${color}`}>{children}</span>;
}

export default function SeccionImportarEdificaciones() {
  const s = useSpdaStore();
  const e = useEdificiosStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { proyectoActivo } = useProyectos();

  // El modo delimitar no puede sobrevivir a este panel: sin sus controles a la
  // vista, el sólido se queda translúcido y cada click sobre el edificio sigue
  // sumando selecciones que nadie ve. Atarlo al desmontaje cubre las tres
  // salidas (← Volver, cambiar de sub-sección, irse de /spda) en un solo lugar.
  useEffect(() => useEdificiosStore.getState().cancelarDelimitacion, []);

  async function abrir(file: File) {
    await s.cargarArchivo(file);
  }

  return (
    <div>
      <h2 className={cls.h2}>Importar edificaciones</h2>
      <div
        className={`border border-dashed rounded-lg p-4 text-center cursor-pointer ${
          drag ? "border-primary-a0 text-font-a0" : "border-surface-tonal-a30 text-surface-tonal-a40"
        }`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) abrir(f);
        }}
      >
        {s.importando
          ? "Importando…"
          : s.modelo
            ? `Reemplazar (${s.modelo.formato.toUpperCase()}) — clic o arrastrar`
            : "Arrastrá un .step / .stl / .obj o hacé clic"}
        <input
          ref={fileRef}
          type="file"
          accept=".obj,.stl,.step,.stp"
          hidden
          onChange={(e) => e.target.files?.[0] && abrir(e.target.files[0])}
        />
      </div>

      <div className={`${cls.field} mt-2`}>
        <label className={cls.label}>
          Unidad del archivo
          {s.modelo &&
            (s.modelo.unidadDetectada ? (
              <Badge tono="ok">detectada</Badge>
            ) : (
              <Badge tono="warn">asumida</Badge>
            ))}
        </label>
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
      {s.modelo && !s.modelo.unidadDetectada && (
        <p className={`${cls.sub} m-0 mb-2`}>
          El formato no declara unidades. Elegí la correcta y usá <b>Reimportar</b>.
        </p>
      )}

      <div className="flex gap-2 items-end">
        <div className={`${cls.field} flex-1`}>
          <label className={cls.label}>Eje vertical del archivo</label>
          <select
            className={cls.input}
            value={s.opcionesImport.ejeVertical}
            onChange={(e) => s.setOpcionesImport({ ejeVertical: e.target.value as "Y" | "Z" })}
          >
            <option value="Z">Z arriba (CAD)</option>
            <option value="Y">Y arriba (mallas)</option>
          </select>
        </div>
        <div className="flex-1 mb-2.5">
          <button
            className={cls.btnSecondary + " mt-0"}
            disabled={!s.ultimoArchivo || s.importando}
            onClick={() => s.reimportar()}
          >
            Reimportar con estos valores
          </button>
        </div>
      </div>

      {s.errorImport && <div className={cls.errbox}>{s.errorImport}</div>}
      {s.modelo?.advertencias.map((a, i) => (
        <div className={cls.warnbox} key={i}>
          {a}
        </div>
      ))}
      {s.modelo && (
        <p className={`${cls.sub} mt-2`}>
          {s.modelo.formato.toUpperCase()} · capas/grupos: {s.modelo.capasDetectadas.join(", ") || "—"}
          <br />
          {s.mastiles.length} mástiles · {s.conductores.length} conductores
          {s.modelo.mallas.length > 0 ? (
            <>
              <br />
              Sólido real disponible ({s.modelo.mallas.length}{" "}
              {s.modelo.mallas.length === 1 ? "malla" : "mallas"}) — el contraste se ve por
              transparencia contra las superficies de protección.
            </>
          ) : (
            <>
              <br />
              Sin sólido (demasiados vértices): solo se ve el contorno, sin lectura visual de
              protección.
            </>
          )}
        </p>
      )}

      {s.modelo && s.modelo.mallas.length > 0 && (
        <>
          <h2 className={cls.h2}>Delimitar edificios</h2>

          {!e.delimitando && (
            <>
              <p className={cls.sub}>
                Delimitá cada edificio clickeándolo en el visor — se usa el sólido real de arriba,
                no hace falta importarlo de nuevo. La forma que se guarda es la real: puede ser no
                convexa (una L, un patio, un alero).
              </p>
              <button className={cls.btn} onClick={() => e.iniciarDelimitacion()}>
                Delimitar edificio
              </button>
              {/* El aviso va acá y no adentro del bloque de delimitación: al guardar
                  bien, `delimitando` pasa a false y ese bloque se desmonta, así que
                  el cartel de éxito no llegaba a verse nunca. */}
              {e.guardadoOk && (
                <p className="text-[11px] text-success-a10 mt-1.5">
                  Edificio guardado — aparece en “Modelos guardados”, en Diseño.
                </p>
              )}
            </>
          )}

          {e.delimitando && (
            <>
              <div className={cls.field}>
                <label className={cls.label}>Nombre del edificio</label>
                <input
                  className={cls.input}
                  value={e.nombreEdificio}
                  onChange={(ev) => e.setNombreEdificio(ev.target.value)}
                />
              </div>

              <div className="flex gap-1 mb-2">
                <button
                  className={`flex-1 text-[11px] px-2 py-1.5 rounded-md ${
                    e.modo === "conectividad"
                      ? "bg-primary-a0 text-font-a0"
                      : "bg-surface-a10 text-surface-tonal-a40 hover:text-font-a0"
                  }`}
                  onClick={() => e.setModo("conectividad")}
                >
                  Por conectividad
                </button>
                <button
                  className={`flex-1 text-[11px] px-2 py-1.5 rounded-md ${
                    e.modo === "region"
                      ? "bg-primary-a0 text-font-a0"
                      : "bg-surface-a10 text-surface-tonal-a40 hover:text-font-a0"
                  }`}
                  onClick={() => e.setModo("region")}
                >
                  Por región
                </button>
              </div>

              {e.modo === "conectividad" && (
                <>
                  <p className={cls.sub}>
                    Un click sobre el edificio se lleva toda la superficie conectada a esa cara —
                    normalmente el edificio entero, con su forma exacta. Si vino modelado en varias
                    partes (paredes y techo por separado), clickeá cada una: se suman al mismo
                    edificio.
                  </p>
                  <label className="flex items-center gap-1.5 text-xs text-font-a10 mt-2">
                    <input
                      type="checkbox"
                      checked={e.limitarAngulo}
                      onChange={(ev) => e.setLimitarAngulo(ev.target.checked)}
                    />
                    Frenar en pliegues cóncavos
                  </label>
                  {e.limitarAngulo && (
                    <div className={`${cls.field} mt-1.5`}>
                      <label className={cls.label}>Ángulo cóncavo máximo: {e.anguloLimite}°</label>
                      <input
                        type="range"
                        min={10}
                        max={150}
                        step={5}
                        value={e.anguloLimite}
                        onChange={(ev) => e.setAnguloLimite(Number(ev.target.value))}
                      />
                    </div>
                  )}
                  <p className={`${cls.sub} mt-1`}>
                    Solo hace falta si el archivo vino soldado (edificio y terreno como una sola
                    superficie continua): corta donde la pared se encuentra con el suelo. Las
                    esquinas propias del edificio son convexas, así que no las toca.
                  </p>
                </>
              )}

              {e.modo === "region" && (
                <>
                  <p className={cls.sub}>
                    Clickeá una cara del edificio y se marca con un <b>círculo</b>. Cada cara aporta
                    su plano entero, así que da igual en qué parte de ella clickees.
                  </p>
                  <p className={`${cls.sub} mt-1`}>
                    Si una misma cara aparece en <b>trozos separados</b> —los dos aleros de un techo,
                    las esquinas de un anillo alrededor de un patio— clickeá cada trozo: comparten el
                    plano pero cada uno necesita su punto para entrar al volumen.
                  </p>
                  <p className={`${cls.sub} mt-1`}>
                    El <b>sólido aparece recién cuando cierra</b>: mientras solo veas los círculos,
                    faltan caras. Si aparece pero le falta un pedazo, clickeá ese pedazo. Lo que se
                    dibuja es exactamente lo que se guarda.
                  </p>
                  <p className={`${cls.sub} mt-2`}>
                    Puntos: {e.piezaActual.length} sobre {agruparClicks(e.piezaActual).length} caras
                  </p>
                  <button
                    className={cls.btnSecondary}
                    disabled={e.piezaActual.length === 0}
                    onClick={() => e.deshacerPlano()}
                  >
                    Deshacer última cara
                  </button>
                </>
              )}

              {e.piezasTerminadas.length > 0 && (
                <div className="flex gap-2 items-center mt-2">
                  <p className={`${cls.sub} flex-1 m-0`}>
                    Partes seleccionadas: {e.piezasTerminadas.length}
                  </p>
                  <button
                    className={`${cls.btnSecondary} flex-1 mt-0`}
                    onClick={() => e.quitarUltimaPieza()}
                  >
                    Quitar última
                  </button>
                </div>
              )}

              <button
                className={cls.btn}
                disabled={
                  !proyectoActivo ||
                  e.guardando ||
                  // Nada seleccionado: ni piezas (conectividad) ni caras (región).
                  (e.piezasTerminadas.length === 0 && e.piezaActual.length === 0)
                }
                onClick={() => proyectoActivo && e.guardarEdificio(proyectoActivo.id)}
              >
                {e.guardando ? "Guardando…" : "Guardar edificio"}
              </button>
              <button className={cls.btnSecondary} disabled={e.guardando} onClick={() => e.cancelarDelimitacion()}>
                Cancelar
              </button>
              {!proyectoActivo && (
                <p className={`${cls.sub} mt-1`}>Elegí un proyecto activo para poder guardar.</p>
              )}
              {e.errorGuardar && <div className={cls.errbox}>{e.errorGuardar}</div>}
            </>
          )}
        </>
      )}
    </div>
  );
}
