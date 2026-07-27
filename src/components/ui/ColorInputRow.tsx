import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { normalizeHex } from '../../color/convert'
import { Button } from './Button'

interface Props {
  hex: string
  label: string
  onChange: (hex: string) => void
  children?: ReactNode
}

export function ColorInputRow({
  hex,
  label,
  onChange,
  children,
}: Props) {
  const colorRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(hex)

  useEffect(() => {
    if (document.activeElement !== textRef.current) setText(hex)
  }, [hex])

  const commitText = (raw: string) => {
    const normalized = normalizeHex(raw)
    if (normalized) {
      onChange(normalized)
      setText(normalized)
    } else {
      setText(hex)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-8 w-8 shrink-0">
        <Button
          variant="paint"
          onClick={() => colorRef.current?.click()}
          className="h-full w-full rounded-lg border border-line/40"
          style={{ background: hex }}
          aria-label={`Change ${label}`}
          title={`Click to change ${label}`}
        />
        <input
          ref={colorRef}
          type="color"
          value={hex}
          onChange={(event) => {
            onChange(event.target.value)
            setText(event.target.value)
          }}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          tabIndex={-1}
          aria-hidden
        />
      </div>
      <input
        ref={textRef}
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => commitText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitText(event.currentTarget.value)
          if (event.key === 'Escape') setText(hex)
        }}
        className="w-24 rounded bg-transparent px-1 font-mono text-xs uppercase tracking-wide text-fg focus:outline-none focus:ring-2 focus:ring-accent/35"
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        title="Enter a hex color with or without #"
        aria-label={`${label} hex value`}
      />
      {children}
    </div>
  )
}
