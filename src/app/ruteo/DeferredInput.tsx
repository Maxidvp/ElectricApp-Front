'use client'
import { useState } from 'react'

export function DeferredInput({
  value, onPreview, onCommit, ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onPreview?: (v: number) => void
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      {...rest}
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onChange={e => { setDraft(e.target.value); onPreview?.(Number(e.target.value)) }}
      onBlur={() => { if (draft !== null) { onCommit(Number(draft)); setDraft(null) } }}
    />
  )
}
