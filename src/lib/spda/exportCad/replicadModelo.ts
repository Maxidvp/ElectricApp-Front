/**
 * Construye el volumen protegido como sólidos B-rep reales (OpenCascade, vía
 * replicad) a partir de la descripción geométrica pura de `geometria.ts`, y lo
 * exporta a STEP. Nada de mallas de triángulos.
 *
 * Se entrega en PIEZAS, un sólido por cono y uno por segmento entre puntas, sin
 * fusionar. Cada pieza es:
 *   - cono: la revolución del arco de la esfera rodante, recortada por las
 *     cuñas de azimut donde su esfera generadora penetraría otra punta;
 *   - segmento: el prisma vertical de su polígono de apoyos;
 * y a las dos se les resta TODAS las bolas de contacto — si un punto cae dentro
 * de cualquier esfera de apoyo válida, esa esfera lo alcanza y está expuesto.
 *
 * Los semiespacios con que se recorta cada pieza son una HERRAMIENTA de corte.
 * Al ser verticales (ver `separadoresDeEsfera`), cada prisma es exactamente la
 * extrusión de su polígono en planta, y como esos polígonos no se solapan, las
 * piezas tampoco: el reparto del volumen es limpio.
 *
 * Historia de por qué NO se fusiona ni se cosen caras, para no volver a
 * intentarlo:
 *  - Coser caras sueltas (`makeSolid`) exige que los bordes de piezas vecinas
 *    coincidan exactamente; con 3+ puntas no colineales no coinciden, quedan
 *    aristas libres y OCCT devuelve una cáscara que DECLARA
 *    `MANIFOLD_SOLID_BREP`/`CLOSED_SHELL` pero encierra volumen CERO — se veía
 *    como un modelo hueco, sin volumen ni en los conos.
 *  - Fusionar con booleano funciona si las piezas se solapan, pero con los
 *    planos verticales quedan pegadas por caras coplanares y el `fuse` trunca
 *    el sólido por arriba (~117 m³ menos en un triángulo de 3 puntas). No lo
 *    arreglan `commonFace`/`sameFace`, ni correr los planos una fracción de
 *    milímetro, ni cambiar el orden de los booleanos.
 *
 * Moraleja: `CLOSED_SHELL` en el STEP no prueba que haya sólido. Hay que MEDIR
 * el volumen (`BRepGProp.VolumeProperties`), que es lo que se verifica acá
 * antes de exportar.
 *
 * Este módulo importa `replicad` de forma estática porque solo se referencia
 * desde el worker de exportación (`exportCad.worker.ts`), que Vite empaqueta
 * aparte: no entra en el bundle principal de la app.
 */

import * as replicad from "replicad";
import type { Shape3D, SimplePoint } from "replicad";
import type { Vec3 } from "../geometry";
import type { PlanoRecorte } from "../construccionEsfera";
import type { ConoExport, ConstruccionExport } from "./geometria";

/**
 * Semiespacios: alcanza con superar largamente cualquier escena real (radios
 * de esfera ~decenas de m). Un valor mucho más grande (probado con 1e6) hace
 * que los booleanos de OCCT se vuelvan inestables por la disparidad de escala
 * entre la caja y la esfera — mejor quedarse moderado.
 */
const BIG = 5000;

/** `Vec3` (tupla readonly) → `SimplePoint` (tupla mutable) que pide replicad. */
function pt(p: Vec3): SimplePoint {
  return [p[0], p[1], p[2]];
}

/**
 * Sólido semiespacio `normal·(x − punto) ≥ 0`, como una caja enorme. Es solo
 * una HERRAMIENTA de corte — nunca queda expuesta en el resultado exportado.
 *
 * OJO: `.rotate()`/`.translate()` en replicad NO mutan el objeto y devuelven
 * `this` (pese a lo que dice su firma) — devuelven un wrapper NUEVO y dejan
 * inválido (`.delete()`d) el anterior. Hay que reencadenar/reasignar siempre
 * el valor de retorno; reusar la variable vieja tira "This object has been
 * deleted". Verificado empíricamente contra replicad 1.0.1.
 */
function semiespacio(plano: PlanoRecorte) {
  let box = replicad.makeBox([0, -BIG, -BIG], [BIG, BIG, BIG]); // x ≥ 0 en local
  const [nx, ny, nz] = plano.normal;
  const dot = Math.max(-1, Math.min(1, nx));
  if (dot < -1 + 1e-9) {
    box = box.rotate(180, [0, 0, 0], [0, 0, 1]);
  } else if (dot < 1 - 1e-9) {
    // eje = (1,0,0) × normal, ángulo = arccos(normal·(1,0,0))
    const axis: Vec3 = [0, -nz, ny];
    const len = Math.hypot(axis[0], axis[1], axis[2]) || 1;
    const angleDeg = (Math.acos(dot) * 180) / Math.PI;
    box = box.rotate(angleDeg, [0, 0, 0], [axis[0] / len, axis[1] / len, axis[2] / len]);
  }
  box = box.translate(pt(plano.punto));
  return box;
}

/** Intersección de dos o más semiespacios (una cuña, o la región a conservar). */
function interseccionSemiespacios(planos: PlanoRecorte[]) {
  let acc = semiespacio(planos[0]);
  for (let i = 1; i < planos.length; i++) acc = acc.intersect(semiespacio(planos[i]));
  return acc;
}

/** Superficie de revolución del arco de la esfera rodante, sin recortar. */
function conoRevolucion(c: ConoExport): Shape3D {
  // El perfil (eje → punta → arco → borde en el suelo) es siempre un único
  // contorno cerrado, así que sketchOnPlane/revolve resuelven a un único
  // Sketch/Shape3D; el tipo se ensancha por la firma genérica de los overloads.
  const perfil = (
    replicad
      .draw([0, 0])
      .lineTo([0, c.hEff])
      .threePointsArcTo([c.rp, 0], [c.arcoMedio.r, c.arcoMedio.z])
      .close()
      .sketchOnPlane("XZ") as { revolve(): Shape3D }
  ).revolve(); // eje Z por defecto, vuelta completa: sólido de revolución simétrico
  return perfil.translate(pt(c.base));
}

/** Le quita al cono las cuñas de azimut donde su esfera generadora penetraría otra punta. */
function recortarCono(cono: Shape3D, c: ConoExport): Shape3D {
  let x = cono;
  for (const [p1, p2] of c.cortes) {
    x = x.cut(interseccionSemiespacios([p1, p2]));
  }
  return x;
}

/** Semiespacio horizontal: "bajo" conserva z ≤ zAbs; "sobre", z ≥ zAbs. */
function planoHorizontal(zAbs: number, lado: "bajo" | "sobre"): PlanoRecorte {
  return { punto: [0, 0, zAbs], normal: lado === "bajo" ? [0, 0, -1] : [0, 0, 1] };
}

export interface PiezaCad {
  nombre: string;
  shape: Shape3D;
}

/** Bolas de contacto: un punto dentro de CUALQUIERA de ellas es alcanzable. */
function bolasDeContacto(construccion: ConstruccionExport): Shape3D[] {
  return construccion.segmentos.map((s) =>
    replicad.makeSphere(s.radio).translate(pt(s.centro)),
  );
}

/**
 * Le resta a una pieza TODAS las bolas de contacto, no solo la propia: si un
 * punto cae dentro de cualquier esfera de apoyo válida, esa esfera lo alcanza
 * y por lo tanto está expuesto. Además hace que el material a ambos lados de
 * una pared interna coincida, así la pared desaparece al fusionar.
 */
function menosBolas(pieza: Shape3D, bolas: Shape3D[]): Shape3D {
  let acc = pieza;
  for (const bola of bolas) {
    // Descarte barato por caja envolvente. Antes acá había un `try/catch` vacío
    // que trataba CUALQUIER excepción de `cut` como "la bola no toca": si el
    // booleano fallaba por un problema numérico real, la pieza se quedaba con
    // volumen que debería haberse restado y el STEP salía con MÁS volumen
    // protegido del real, en silencio. Con el descarte por bbox ya no hay
    // motivo legítimo para que `cut` falle, así que un fallo ahora se propaga.
    if (acc.boundingBox.isOut(bola.boundingBox)) continue;
    try {
      acc = acc.cut(bola);
    } catch (err) {
      throw new Error(
        `No se pudo restar una esfera de apoyo del volumen exportado (${
          err instanceof Error ? err.message : String(err)
        }). Se aborta la exportación: seguir dejaría el STEP mostrando más protección de la real.`,
      );
    }
  }
  return acc;
}

/** Por debajo de esto una pieza se considera vacía (una mitad que no existe). */
const VOL_MIN = 1e-6;

/**
 * Cada pieza como SÓLIDO completo. Si se pasa `zCorte` (cota absoluta), cada
 * pieza se entrega partida en dos por ese plano horizontal, de modo que la
 * altura de circulación queda marcada como ARISTA de los sólidos — los programas
 * de CAD dibujan las aristas, así que la línea aparece sola en el modelo sin
 * exportar ninguna curva suelta.
 *
 * OJO con el orden: se parte ANTES de aplicar los recortes de cuña, no después.
 * Recortar y partir después deja la mitad de arriba del cono más recortado
 * (5 cuñas convergiendo en el ápice) como sólido INVÁLIDO según
 * `BRepCheck_Analyzer`; partiendo primero, el mismo volumen sale válido.
 * Para los segmentos ni siquiera hace falta un booleano extra: el plano de
 * corte es un semiespacio más en la lista que ya define el prisma.
 */
export function construirPiezas(construccion: ConstruccionExport, zCorte?: number): PiezaCad[] {
  const bolas = bolasDeContacto(construccion);
  const parte = zCorte != null;
  const lados: ("bajo" | "sobre")[] = parte ? ["bajo", "sobre"] : [];
  const sufijo = (lado: string) =>
    parte ? `-${lado}-${(zCorte! - cotaDe(construccion)).toFixed(2)}m` : "";
  const piezas: PiezaCad[] = [];

  const agregar = (nombre: string, construir: () => Shape3D) => {
    try {
      const shape = construir();
      if (volumenDe(shape) > VOL_MIN) piezas.push({ nombre, shape });
    } catch {
      // esa mitad quedó vacía: no hay nada que agregar
    }
  };

  for (const c of construccion.conos) {
    if (!parte) {
      agregar(`cono-${c.id}`, () => menosBolas(recortarCono(conoRevolucion(c), c), bolas));
      continue;
    }
    for (const lado of lados) {
      agregar(`cono-${c.id}${sufijo(lado)}`, () => {
        const mitad = conoRevolucion(c).intersect(
          interseccionSemiespacios([planoHorizontal(zCorte!, lado)]),
        );
        return menosBolas(recortarCono(mitad, c), bolas);
      });
    }
  }

  for (const s of construccion.segmentos) {
    if (s.planos.length === 0) continue;
    if (!parte) {
      agregar(`segmento-${s.id}`, () => menosBolas(interseccionSemiespacios(s.planos), bolas));
      continue;
    }
    for (const lado of lados) {
      agregar(`segmento-${s.id}${sufijo(lado)}`, () =>
        menosBolas(
          interseccionSemiespacios([...s.planos, planoHorizontal(zCorte!, lado)]),
          bolas,
        ),
      );
    }
  }
  return piezas;
}

/** Volumen del sólido (m³). Sirve para no exportar nunca una cáscara hueca. */
function volumenDe(shape: Shape3D): number {
  const oc = replicad.getOC() as unknown as {
    GProp_GProps: new () => { Mass(): number };
    BRepGProp: {
      VolumeProperties(s: unknown, g: unknown, a: boolean, b: boolean, c: boolean): void;
    };
  };
  const props = new oc.GProp_GProps();
  oc.BRepGProp.VolumeProperties(
    (shape as unknown as { wrapped: unknown }).wrapped,
    props,
    true,
    false,
    false,
  );
  return props.Mass();
}

/** Cota del plano de tierra de la construcción. */
function cotaDe(construccion: ConstruccionExport): number {
  return construccion.conos[0]?.base[2] ?? construccion.segmentos[0]?.cota ?? 0;
}

/**
 * Exporta el volumen protegido a STEP, como piezas independientes (un sólido
 * por cono y uno por segmento).
 *
 * Si se pasa `alturaSeccion` (metros sobre el suelo), cada pieza se parte además
 * en dos por ese plano horizontal, para que la altura de circulación quede
 * marcada como arista de los sólidos.
 *
 * NO se fusionan, a propósito. Los planos divisores son verticales para que
 * cada prisma sea la extrusión de su polígono y las piezas no se solapen (ver
 * `separadoresDeEsfera`), pero eso las deja pegadas por caras coplanares y ahí
 * el `fuse` de OCCT falla en grande: trunca el sólido por arriba y se come
 * ~117 m³ en un triángulo de 3 puntas — verificado comparando el área de
 * sección contra la analítica, que coincide a 0.02 m² hasta z=9 y a partir de
 * ahí OCCT devuelve 0.00. No lo arreglan los modos de pegado de OCCT
 * (`commonFace`/`sameFace`), ni correr los planos una fracción de milímetro,
 * ni reestructurar el orden de los booleanos.
 *
 * Entregar el volumen en partes evita el problema por completo: cada pieza es
 * un sólido válido, la suma da el volumen correcto (contrastado contra la
 * integral del área de sección en altura) y no hay solape entre ellas.
 *
 * Antes, el cosido de caras sueltas (`makeSolid`) daba algo peor todavía: una
 * cáscara que declaraba `MANIFOLD_SOLID_BREP`/`CLOSED_SHELL` pero encerraba
 * volumen CERO — se veía como un modelo hueco, sin volumen ni en los conos. De
 * ahí la lección: mirar `CLOSED_SHELL` no prueba que haya sólido; hay que medir
 * el volumen, que es lo que se verifica acá antes de exportar.
 */
export function exportarSTEP(
  construccion: ConstruccionExport,
  alturaSeccion?: number,
): Blob {
  const zCorte =
    alturaSeccion != null && alturaSeccion > 0 ? cotaDe(construccion) + alturaSeccion : undefined;
  const piezas = construirPiezas(construccion, zCorte);
  if (piezas.length === 0) {
    throw new Error("No hay puntas con altura > 0: no hay nada que exportar.");
  }

  const vol = piezas.reduce((acc, p) => acc + volumenDe(p.shape), 0);
  if (!(vol > 1e-6)) {
    throw new Error(
      `Las piezas suman un volumen de ${vol.toFixed(3)} m³ (hueco). ` +
        "No se exporta: sería un modelo sin volumen.",
    );
  }

  return replicad.exportSTEP(piezas.map((p) => ({ shape: p.shape, name: p.nombre })));
}
