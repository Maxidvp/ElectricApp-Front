@AGENTS.md

# ElectricApp — Frontend

Next.js App Router + Tailwind. UI para diseño eléctrico: cargas, ampacidad,
caídas, cortocircuito (IEC 60909-0), protecciones, ruteo de cables/bandejas/
canieros, instrumentación, rack de datos.

## Arrancar

```
PORT=3001 npm run dev   # turbopack, puerto 3001 (backend en 3000)
```

**Bug conocido de turbopack**: a veces un cambio en `globals.css` no se refleja
en caliente. Si el CSS servido queda desactualizado: matar el proceso en el
puerto 3001, borrar `.next/`, reiniciar. Los cambios en `.tsx` sí recargan bien.

## Estado global — `ProyectosContext`

Fuente de verdad para casi todo: tableros, circuitos, segmentos, canios,
bandejas, conjuntos, paredes, arquitecturas, canieros. Se carga **una sola vez**
con `GET /proyectos/:id` al activar un proyecto, y `LoadingGate` bloquea el
render de toda la app hasta que termina esa carga.

**Si agregás un dato nuevo por proyecto, sumalo a este mismo fetch inicial**
(include en el backend + estado en `ProyectosContext`) en vez de hacer un fetch
propio por página — así la ruta nueva carga instantáneo en vez de mostrar su
propio spinner (se hizo así para `/caneros`, ver `context/ProyectosContext.tsx`
y `src/routes/proyectos.ts` del backend).

**Tablero seleccionado**: es estado del context (`tableroSeleccionadoId` /
`seleccionarTablero`), compartido por todas las páginas y el Navbar. En una página
usar `useTableroSeleccionado(candidatos)` (`src/hooks/`) en vez de leer la cookie
`last_tablero_id`, que queda solo para recordar la selección entre recargas.

**Escrituras optimistas con vuelta atrás**: un cambio que el back rechaza se
deshace en pantalla (antes quedaba mostrando un valor no guardado). Para campos de
circuito usar `editarCampos` (`useCircuitosActions.ts`); para fuentes/lazos/puertos,
`editarItem` (`ProyectosContext.tsx`). Los borrados que fallan recargan el proyecto.
Las acciones de ruteo (`useRuteoActions.ts`) todavía NO tienen vuelta atrás.

## Catálogos (Cables, Protecciones)

`CablesContext`/`ProteccionesContext`: mismo patrón de dos niveles que el
backend (familia → variante), con una caché a nivel de módulo por `familia_id`
(`_cache`). **Si editás/creás/borrás una variante, hay que invalidar esa caché a
mano** (`invalidarCacheCables`/`invalidarCacheProtecciones`) o los selectores en
otras rutas (`FormacionModal`, `ProteccionModal`) siguen mostrando datos viejos
el resto de la sesión.

## Componentes/patrones compartidos

- **`CeldaEditable`** — celda de tabla editable con click, actualización
  optimista + PATCH. Usar en cualquier tabla nueva en vez de reinventar.
- **`TablaCalculo`** (`components/TablaCalculo.tsx`) — para páginas de cálculo por
  tablero: `TableroPills`, `EncabezadoTablero` (con la leyenda), `TablaCalculo`
  (tanstack, columnas redimensionables coloreadas por `meta.colType`), `AutoCell`
  y `useColSizing`. Lo usan Ampacidad, Caídas y Cortocircuitos.
- **Tablas tipo datatable** — clases `.datatable-container`/`.datatable`, con
  leyenda de 3 colores por `meta.colType`: `editable` (azul), `auto`/calculado
  (gris), `result` (verde).
- **Modales de selección** (`FormacionModal`, `CableSimpleModal`,
  `ProteccionModal`) — al guardar, el callback `onGuardar` debe devolver el
  **objeto completo** seleccionado (no solo el id). Si la actualización
  optimista en el context solo guarda el id y no el objeto anidado, la UI queda
  mostrando datos viejos hasta que responde el PATCH (bug real, ya corregido
  para Protección — ver `actualizarFormacion`/`actualizarProteccion` en
  `useCircuitosActions.ts` como referencia del patrón correcto).

## Motor de cortocircuito

`utils/cortocircuito/` es un módulo "puro" (sin dependencias de la app) que
implementa IEC 60909-0. `utils/calcularIccTablero.ts` es la capa que sí conoce
la app: recorre la fuente propia de un tablero (o la cadena de circuitos
ALIMENTADOR que lo alimentan, recursivamente) para derivar su Icc de barra en
vez de pedirla cargada a mano.

## Verificación y Memoria de cálculo

`/verificacion` (panel con todos los ✗ / datos faltantes / avisos del proyecto) y
`/memoria` (memoria de cálculo imprimible, se llega desde Verificación) **no
calculan nada propio**: usan `evaluarProyecto` (`utils/verificacionProyecto.ts`),
que corre las mismas funciones puras que las páginas (`cargas.ts`, `ampacidad.ts`,
`caida.ts`, `verificacionCortocircuito.ts`). Si agregás una verificación nueva,
sumala a esa función y a `hallazgosCircuito` para que aparezca en los dos lados.
Un dato faltante se informa como `falta`, nunca como cumple.

**Selectividad** (`utils/selectividad.ts`): solo entre protecciones con curva
normalizada (`CURVA_MULTIPLICADOR`), límite = extremo inferior de la banda magnética de
la de aguas arriba. Lo que quede fuera (caja moldeada regulable, guardamotores,
fusibles) se carga a mano en el circuito de aguas abajo (`selectividad_Is` /
`selectividad_total`, columna "Is fabricante" de Cortocircuitos) y pisa al calculado.
Diferenciales: no se evalúa.

## Pendientes a revisar (decisiones del usuario)

- **Factor por altitud `calcFH`** (`utils/electricidad.ts`): la fórmula
  `min(1; 1,02 − 0,00002·h)` no tiene fuente confirmada. El usuario la recuerda de la
  AEA: se mantiene tal cual hasta ubicar la cláusula. No cambiarla ni citarla como
  verificada.
- **Verificación térmica rigurosa (k²S² ≥ I²t)**: la AEA 90364-7-771 la resuelve con
  las tablas de orientación del anexo 771-H.2.4 (por clase de limitación 2/3). Falta
  que el usuario pase esas tablas; hasta entonces sigue la S mín orientativa con
  tiempos fijos.
- **Métodos de instalación**: se mantienen las tres categorías actuales (caño / aire /
  enterrado) siguiendo la AEA; no migrar a los métodos de referencia IEC.

## Verificación de cambios

**Cálculos: `npm test`** (vitest, `src/**/*.test.ts`) — motor de cortocircuito,
`electricidad.ts`, `calcularIccTablero`, `cargas.ts` (carga efectiva por circuito:
acometidas y alimentadores vinculados — fuente única para Cargas, Ampacidad y
Caídas) `verificacionCortocircuito.ts` (verificación por circuito de la página
de Cortocircuitos) y `ampacidad.ts` (Iadm del cable según método de instalación
— `Cable.Iadm_canio/_aire/_enterrado`, con `Iadm` como genérica de respaldo — y
coordinación Ib ≤ In ≤ Iz). La lógica de cálculo va en `utils/` como función pura, no
dentro de la página. Correrlo en cada cambio que toque un
cálculo. Regla: **los valores esperados salen de la norma citada o de un cálculo
a mano escrito en el comentario del test, nunca de la salida de la propia app.**
Si un test falla, revisar primero el cálculo a mano y la tabla, después el código.

Cada cálculo que omite algo (fuentes que no entran, datos incompletos) lo devuelve
en `avisos`/`advertencias` y la página lo muestra junto al resultado — no omitir
en silencio.

**UI:** verificar con un script Playwright
descartable en `D:\ElectricApp\Back\.scratch\` (scratchpad compartido con el
backend, gitignored) contra el proyecto de prueba persistente (id 63 en la
sesión de desarrollo actual — no crear/borrar proyectos de prueba nuevos) —
antes de navegar, setear `localStorage.setItem('ea_proyecto', '63')`. Borrar
los scripts después de cada verificación.

