/**
 * Resumen numérico del contraste: cobertura, puntos expuestos y margen mínimo.
 * El "margen" es `r − exposición` en metros: positivo = protegido.
 */
import { useSpdaStore } from "@/state/spda/store";
import { NIVELES_PROTECCION } from "@/lib/spda/iec62305";

function Stat({ label, value, tono }: { label: string; value: string; tono?: "ok" | "bad" }) {
  const color =
    tono === "ok" ? "text-success-a10" : tono === "bad" ? "text-danger-a10" : "text-font-a0";
  return (
    <div className="flex flex-col leading-tight">
      <b className={`text-sm ${color}`}>{value}</b>
      <span className="text-[11px] text-surface-tonal-a40">{label}</span>
    </div>
  );
}

export default function Resultados() {
  const r = useSpdaStore((s) => s.resultado);
  const npr = useSpdaStore((s) => s.npr);
  const R = useSpdaStore((s) => s.radioEfectivo());

  return (
    <div className="flex gap-5 items-center">
      <Stat
        value={`${R} m`}
        label={`radio esfera · NPR ${npr} (Imín ${NIVELES_PROTECCION[npr].corrienteMinima} kA)`}
      />
      {!r ? (
        <span className="text-[11px] text-surface-tonal-a40">
          Importá un DXF y pulsá “Contrastar modelo”.
        </span>
      ) : (
        <>
          <Stat value={String(r.total)} label="puntos evaluados" />
          <Stat
            value={String(r.expuestos)}
            label="puntos expuestos"
            tono={r.expuestos ? "bad" : "ok"}
          />
          <Stat
            value={`${(r.cobertura * 100).toFixed(1)}%`}
            label="cobertura de protección"
            tono={r.cobertura >= 1 ? "ok" : "bad"}
          />
          <Stat value={`${r.margenMinimo.toFixed(2)} m`} label="margen mínimo (r − exposición)" />
          {r.expuestos === 0 ? (
            <span className="text-xs px-2 py-1 rounded-full bg-success-a0 text-font-a0">
              Estructura protegida
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-danger-a0 text-font-a0">
              Puntos sin protección
            </span>
          )}
        </>
      )}
    </div>
  );
}
