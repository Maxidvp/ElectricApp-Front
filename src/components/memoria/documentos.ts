// Documentos que el proyecto puede emitir desde /memorias. Todos muestran el estado
// ACTUAL del proyecto; para conservar una emisión tal como salió están los checkpoints
// (se restaura la revisión y se vuelve a abrir el documento).
// Para sumar uno: agregarlo acá y su contenido en app/memorias/[doc]/page.tsx.

export type DocumentoId = 'general' | 'cargas' | 'cortocircuito' | 'cables' | 'locales' | 'analisis-cargas'

export const DOCUMENTOS: { id: DocumentoId; titulo: string; descripcion: string; contenido: string[] }[] = [
  {
    id: 'general', titulo: 'Memoria de cálculo eléctrico',
    descripcion: 'El documento completo: criterios de cálculo y, por cada tablero, todas las verificaciones.',
    contenido: ['Criterios', 'Cargas', 'Corriente admisible y protección', 'Caída de tensión', 'Cortocircuito', 'Selectividad', 'Observaciones'],
  },
  {
    id: 'cargas', titulo: 'Planilla de cargas por tablero',
    descripcion: 'Una hoja por tablero con sus circuitos, conductores y protecciones, la potencia total y el balance de fases.',
    contenido: ['Circuitos, conductores y protección', 'Potencia instalada', 'Balance de fases'],
  },
  {
    id: 'analisis-cargas', titulo: 'Planilla de Análisis de Cargas',
    descripcion: 'Formato de COPAIPA (CTM-002): bocas y tomas, potencia instalada, factores de simultaneidad, potencia e intensidad simultáneas por fase, caída, sección y corriente admisible.',
    contenido: ['Circuitos por tablero', 'Subtotales por acometida', 'Simultaneidad'],
  },
  {
    id: 'locales', titulo: 'Planilla de Locales',
    descripcion: 'Formato de COPAIPA (CTM-002): ambientes con sus puntos de utilización, condiciones de utilización y materiales permitidos, agrupados por unidad funcional.',
    contenido: ['Locales por unidad funcional', 'Puntos de utilización', 'Condiciones y materiales'],
  },
  {
    id: 'cortocircuito', titulo: 'Estudio de cortocircuito y selectividad',
    descripcion: 'Corrientes de falla por circuito, verificación de las protecciones y selectividad con la de aguas arriba.',
    contenido: ['Criterios', 'Icc de barra', 'Cortocircuito por circuito', 'Selectividad', 'Observaciones'],
  },
  {
    id: 'cables', titulo: 'Lista de cables',
    descripcion: 'Todos los tendidos del proyecto con origen, destino, formación, largo y método de instalación, y el resumen de metros por formación.',
    contenido: ['Tendidos por tablero', 'Resumen por formación'],
  },
]
