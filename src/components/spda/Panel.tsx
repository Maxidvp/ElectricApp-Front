/**
 * Panel de control: nivel de protección, importación del modelo, edición de
 * captadores, disparo del cálculo, altura de circulación y exportación CAD.
 *
 * Es el único componente que escribe en el store; el resto solo lee.
 *
 * Portado de Sdpa: la lógica es idéntica, solo cambió el sistema de estilos
 * (CSS plano propio → Tailwind con los tokens de Front) para no convivir con
 * dos sistemas de diseño en el mismo repo.
 */
import { useRef, useState } from "react";
import { useSpdaStore } from "@/state/spda/store";
import { useSeccion } from "@/state/spda/useSeccion";
import { NIVELES_PROTECCION, NPR_ORDEN, corrienteDesdeRadio } from "@/lib/spda/iec62305";
import { UNIDADES } from "@/lib/spda/import";

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

export default function Panel() {
  const s = useSpdaStore();
  const seccion = useSeccion();
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const R = s.radioEfectivo();

  async function abrir(file: File) {
    await s.cargarArchivo(file);
  }

  return (
    <div>
      <h1 className="text-base font-semibold m-0 mb-0.5">SDPA · Esfera rodante</h1>
      <p className={`${cls.sub} mb-3`}>
        Método de la esfera rodante (IEC 62305-3).
      </p>

      <h2 className={cls.h2}>Captadores</h2>
      <div className="flex flex-col gap-1">
        {s.mastiles.map((m) => (
          <div
            key={m.id}
            className={`flex gap-1.5 items-center bg-surface-a10 border rounded-md px-1.5 py-1 cursor-pointer ${
              s.seleccionId === m.id ? "border-primary-a0" : "border-surface-tonal-a30"
            }`}
            onClick={() => s.setSeleccion(m.id)}
          >
            <span className="text-surface-tonal-a40 text-xs shrink-0">{m.id}</span>
            <input
              className={cls.input}
              type="number"
              title="x"
              value={m.base[0]}
              onChange={(e) =>
                s.updateMastil(m.id, { base: [Number(e.target.value), m.base[1], m.base[2]] })
              }
            />
            <input
              className={cls.input}
              type="number"
              title="y"
              value={m.base[1]}
              onChange={(e) =>
                s.updateMastil(m.id, { base: [m.base[0], Number(e.target.value), m.base[2]] })
              }
            />
            <input
              className={cls.input}
              type="number"
              title="altura"
              value={m.altura}
              onChange={(e) => s.updateMastil(m.id, { altura: Number(e.target.value) })}
            />
            <button
              className="text-surface-tonal-a40 hover:text-danger-a10 shrink-0"
              title="eliminar"
              onClick={(e) => {
                e.stopPropagation();
                s.removeElemento(m.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        className={cls.btnSecondary}
        onClick={() => {
          const c = s.modelo?.bounds;
          const cx = c ? (c.min[0] + c.max[0]) / 2 : 0;
          const cy = c ? (c.min[1] + c.max[1]) / 2 : 0;
          s.addMastil([cx, cy, s.cotaTierra ?? 0], 10);
        }}
      >
        + Añadir mástil
      </button>
      
      <h2 className={cls.h2}>Modelo (DXF · OBJ · STL)</h2>
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
            : "Arrastrá un .dxf / .obj / .stl o hacé clic"}
        <input
          ref={fileRef}
          type="file"
          accept=".dxf,.obj,.stl"
          hidden
          onChange={(e) => e.target.files?.[0] && abrir(e.target.files[0])}
        />
      </div>

      <div className="flex gap-2 mt-2">
        <div className={`${cls.field} flex-1`}>
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
        <div className={`${cls.field} flex-1`}>
          <label className={cls.label}>Paso muestreo (m)</label>
          <input
            className={cls.input}
            type="number"
            min={0.25}
            step={0.25}
            value={s.opcionesImport.pasoMuestreo}
            onChange={(e) => s.setOpcionesImport({ pasoMuestreo: Number(e.target.value) })}
          />
        </div>
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
          {s.modelo.puntosEstructura.length} puntos de estructura · {s.mastiles.length} mástiles ·{" "}
          {s.conductores.length} conductores
        </p>
      )}

      <h2 className={cls.h2}>Nivel de protección (NPR)</h2>
      <div className="grid grid-cols-4 gap-1.5">
        {NPR_ORDEN.map((npr) => {
          const activo = s.npr === npr && s.radioManual == null;
          return (
            <button
              key={npr}
              className={`flex flex-col items-center gap-0.5 rounded-md py-2 border ${
                activo
                  ? "border-primary-a0 bg-primary-a0/15"
                  : "border-surface-tonal-a30 bg-surface-a10"
              }`}
              onClick={() => s.setNPR(npr)}
            >
              <b className="text-sm text-font-a0">{npr}</b>
              <span className="text-surface-tonal-a40 text-[10px]">
                {NIVELES_PROTECCION[npr].radioEsfera} m
              </span>
            </button>
          );
        })}
      </div>
      <div className={`${cls.field} mt-2.5`}>
        <label className={cls.label}>Radio de esfera efectivo (m) — editable para sobrescribir</label>
        <input
          className={cls.input}
          type="number"
          value={R}
          min={1}
          step={1}
          onChange={(e) => s.setRadioManual(Number(e.target.value) || null)}
        />
        <p className={`${cls.sub} m-0`}>
          ≈ corriente de rayo mínima interceptada {corrienteDesdeRadio(R).toFixed(1)} kA
        </p>
      </div>

      <h2 className={cls.h2}>Cálculo</h2>
      <div className={cls.field}>
        <label className={cls.label}>Direcciones muestreadas: {s.config.direcciones}</label>
        <input
          type="range"
          min={80}
          max={800}
          step={40}
          value={s.config.direcciones}
          onChange={(e) =>
            useSpdaStore.setState((st) => ({
              config: { ...st.config, direcciones: Number(e.target.value) },
            }))
          }
        />
      </div>
      <button className={cls.btn} disabled={!s.modelo || s.calculando} onClick={() => s.calcular()}>
        Contrastar modelo
      </button>
      <button
        className={cls.btnSecondary}
        disabled={!s.modelo || s.calculando}
        onClick={() => s.calcularEnvolvente()}
      >
        Extraer envolvente de protección
      </button>

      <div className="flex gap-2 mt-2.5 flex-wrap">
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input type="checkbox" checked={s.mostrarZonas} onChange={() => s.toggle("mostrarZonas")} />
          Conos por punta
        </label>
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input
            type="checkbox"
            checked={s.mostrarEsferasEntre}
            onChange={() => s.toggle("mostrarEsferasEntre")}
          />
          Esferas entre puntas
        </label>
      </div>
      <div className="flex gap-2 flex-wrap">
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input
            type="checkbox"
            checked={s.mostrarEnvolvente}
            onChange={() => s.toggle("mostrarEnvolvente")}
          />
          Envolvente
        </label>
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input type="checkbox" checked={s.mostrarEsfera} onChange={() => s.toggle("mostrarEsfera")} />
          Esfera manual
        </label>
      </div>
      <div className="flex gap-2 flex-wrap">
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input type="checkbox" checked={s.mostrarSuelo} onChange={() => s.toggle("mostrarSuelo")} />
          Suelo XY
        </label>
        <label className="flex-1 flex items-center gap-1.5 text-xs text-font-a10">
          <input
            type="checkbox"
            checked={s.mostrarSeccion}
            onChange={() => s.toggle("mostrarSeccion")}
          />
          Sección a altura
        </label>
      </div>
      <p className={`${cls.sub} mt-1.5`}>
        Conos = puntas aisladas; entre puntas cercanas la esfera se apoya en 2–3 puntas y la
        protección sube. El caso completo es la envolvente.
      </p>

      <h2 className={cls.h2}>Altura de circulación</h2>
      <p className={`${cls.sub} mt-0`}>
        Corta el volumen protegido a esa altura sobre el suelo. Es la superficie que realmente
        cubre a una persona circulando: el radio de cada cono se achica en √(2Rz − z²).
      </p>
      <div className="flex gap-2 items-end">
        <label className={`${cls.label} flex-1`}>
          Altura (m)
          <input
            className={cls.input}
            type="number"
            min={0}
            step={0.1}
            value={s.alturaSeccion}
            onChange={(e) => s.setAlturaSeccion(Number(e.target.value))}
          />
        </label>
        <div className="flex-1 mb-2.5">
          <div className={cls.sub}>Superficie protegida</div>
          <strong className="text-font-a0">{seccion ? `${seccion.area.toFixed(1)} m²` : "—"}</strong>
        </div>
      </div>

      <h2 className={cls.h2}>Exportar CAD (STEP)</h2>
      <p className={`${cls.sub} mt-0`}>
        Sólidos B-rep reales (superficie de revolución + esferas), no una malla. Solo el volumen
        analítico de conos y segmentos esféricos — no incluye la envolvente numérica.
      </p>
      <button className={cls.btnSecondary} disabled={s.exportandoCAD} onClick={() => s.exportarCAD()}>
        {s.exportandoCAD ? "Generando…" : "Exportar STEP"}
      </button>
      {s.errorExportCAD && <div className={cls.errbox}>{s.errorExportCAD}</div>}
    </div>
  );
}
