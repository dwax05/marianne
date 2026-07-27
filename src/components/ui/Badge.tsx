import type { ReactNode } from 'react'

type Tone = 'good' | 'warn' | 'bad' | 'neutral'

const tones: Record<Tone, string> = {
  good: 'bg-good/15 text-good',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  neutral: 'bg-muted/15 text-muted',
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
