import { useMemo, useState } from 'react'
import type { HarmonySet, Palette } from '../../color/types'
import { combinedHarmonies } from '../../color/harmony'
import { makeSwatch } from '../../color/encode'
import { Button, IconButton } from '../ui/Button'
import { ColorInputRow } from '../ui/ColorInputRow'
import { PlusIcon, TrashIcon } from '../ui/icons'

interface Props {
  palette: Palette
  onReplace: (p: Palette) => void
  onAppend: (p: Palette) => void
}

interface Base {
  id: string
  hex: string
}

const ORDER: (keyof HarmonySet)[] = [
  'complementary',
  'analogous',
  'triadic',
  'tetradic',
  'splitComplementary',
  'monochromatic',
]

const LABELS: Record<keyof HarmonySet, string> = {
  complementary: 'Complementary',
  analogous: 'Analogous',
  triadic: 'Triadic',
  tetradic: 'Tetradic',
  splitComplementary: 'Split complementary',
  monochromatic: 'Monochromatic',
}

let uid = 0
const newId = () => `base-${uid++}`

export function HarmonyPanel({ palette, onReplace, onAppend }: Props) {
  const [bases, setBases] = useState<Base[]>([
    { id: newId(), hex: palette[0]?.hex ?? '#3a7bd5' },
  ])
  const sets = useMemo(
    () => combinedHarmonies(bases.map((b) => b.hex)),
    [bases],
  )

  const setHex = (id: string, hex: string) =>
    setBases((bs) => bs.map((b) => (b.id === id ? { ...b, hex } : b)))
  const addBase = () =>
    setBases((bs) => [...bs, { id: newId(), hex: '#e5484d' }])
  const removeBase = (id: string) =>
    setBases((bs) => (bs.length > 1 ? bs.filter((b) => b.id !== id) : bs))

  const toPalette = (hexes: string[]): Palette =>
    hexes.map((h) => makeSwatch(h)).filter((s): s is Palette[number] => !!s)

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-widest text-muted">
            Base colors
          </span>
          <Button
            variant="ghost"
            className="px-2 py-0.5 text-xs"
            onClick={addBase}
          >
            <PlusIcon width={14} height={14} /> Add base
          </Button>
        </div>
        {bases.map((b) => (
          <ColorInputRow
            key={b.id}
            hex={b.hex}
            label="base color"
            onChange={(hex) => setHex(b.id, hex)}
          >
            {bases.length > 1 && (
              <IconButton
                onClick={() => removeBase(b.id)}
                danger
                title="Remove base color"
                className="ml-auto h-7 w-7"
              >
                <TrashIcon width={14} height={14} />
              </IconButton>
            )}
          </ColorInputRow>
        ))}
      </div>

      {sets &&
        ORDER.map((key) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">
                {LABELS[key]}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  className="px-2 py-0.5 text-xs"
                  onClick={() => onAppend(toPalette(sets[key]))}
                >
                  Append
                </Button>
                <Button
                  className="px-2.5 py-0.5 text-xs"
                  onClick={() => onReplace(toPalette(sets[key]))}
                >
                  Use
                </Button>
              </div>
            </div>
            <div className="flex overflow-hidden rounded-lg">
              {sets[key].map((hex, i) => (
                <span
                  key={i}
                  className="h-9 flex-1"
                  style={{ background: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}
