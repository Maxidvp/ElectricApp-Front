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

## Verificación

No hay tests automatizados. Verificar cambios de UI con un script Playwright
descartable en `D:\ElectricApp\Back\.scratch\` (scratchpad compartido con el
backend, gitignored) contra el proyecto de prueba persistente (id 63 en la
sesión de desarrollo actual — no crear/borrar proyectos de prueba nuevos) —
antes de navegar, setear `localStorage.setItem('ea_proyecto', '63')`. Borrar
los scripts después de cada verificación.

