export const TIPOS_PUERTO = [
  { value: 'PATCH_PANEL', label: 'Patch panel' },
  { value: 'SWITCH', label: 'Switch' },
  { value: 'SERVIDOR', label: 'Servidor' },
  { value: 'AP', label: 'Access point' },
  { value: 'FIREWALL', label: 'Firewall' },
  { value: 'UPS_RED', label: 'UPS de red' },
] as const

export type ColMeta = { colType: 'editable' | 'display' }
