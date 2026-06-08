export function LayoutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeMiterlimit="10">
      <path d="M23.49,0.46C15.8,0.47,8.12,0.48,0.44,0.49l0.02,23.02h23.02V0.46z" />
      <line x1="5.58" y1="0.71" x2="5.58" y2="23.51" />
      <polyline points="16.54,0.47 16.54,9.54 16.54,13.5 23.49,13.5" />
      <line x1="23.49" y1="19.46" x2="5.58" y2="19.46" />
      <line x1="16.54" y1="9.54" x2="5.58" y2="9.54" />
    </svg>
  )
}
