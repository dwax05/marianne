import { useId, useMemo, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent } from 'react'
import type { Palette } from '../../color/types'
import { extractPalette } from '../../color/extract'
import { makeSwatch } from '../../color/encode'
import { Button } from '../ui/Button'
import { ImageIcon } from '../ui/icons'

interface Props {
  onReplace: (p: Palette) => void
  onAppend: (p: Palette) => void
}

/** Longest edge the source image is downscaled to before sampling pixels. */
const MAX_DIM = 128
const COLOR_COUNTS = [4, 5, 6, 7, 8] as const

/**
 * Source a palette from a photo or artwork. The image never leaves the device:
 * it's drawn to a downscaled offscreen canvas, its pixels read locally, and
 * `extractPalette` (pure) pulls the dominant colours out. The sampled buffer is
 * kept in state so each available palette size can be previewed together.
 */
export function ImagePalettePanel({ onReplace, onAppend }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string>('')
  const pickerName = useId()
  const [preview, setPreview] = useState('')
  const [imageData, setImageData] = useState<Uint8ClampedArray | null>(null)
  const [count, setCount] = useState(6)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const paletteOptions = useMemo(
    () =>
      imageData
        ? COLOR_COUNTS.map((optionCount) => ({
            count: optionCount,
            colors: extractPalette(imageData, { count: optionCount }),
          }))
        : [],
    [imageData],
  )
  const colors =
    paletteOptions.find((option) => option.count === count)?.colors ?? []

  const toPalette = (hexes: string[]): Palette =>
    hexes.map((h) => makeSwatch(h)).filter((s): s is Palette[number] => !!s)

  const readFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.')
      return
    }
    setError('')
    try {
      const url = URL.createObjectURL(file)
      const data = sampleImage(await loadImage(url), MAX_DIM)
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = url
      setPreview(url)
      setImageData(data)
    } catch {
      setError('Could not read that image.')
    }
  }

  const onDrop = (event: ReactDragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    void readFile(event.dataTransfer.files[0])
  }

  return (
    <div className="space-y-3 text-sm">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? 'border-accent bg-surface-2/60'
            : 'border-line/60 hover:border-accent/60 hover:bg-surface-2/40'
        }`}
      >
        <ImageIcon width={22} height={22} className="text-accent" />
        <span className="font-medium text-fg">
          Drop an image or click to choose
        </span>
        <span className="text-xs text-muted">
          PNG, JPG, or any image — read on your device, never uploaded.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            void readFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>

      {error && <p className="text-xs text-bad">{error}</p>}

      {preview && (
        <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <img
            src={preview}
            alt="Source for palette extraction"
            className="h-32 w-full rounded-lg border border-line/50 object-cover sm:h-full sm:min-h-60"
          />
          <fieldset className="min-w-0">
            <legend className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">
              Choose a palette
            </legend>
            <div className="space-y-1.5">
              {paletteOptions.map((option) => {
                const selected = option.count === count
                return (
                  <label key={option.count} className="block cursor-pointer">
                    <input
                      type="radio"
                      name={pickerName}
                      value={option.count}
                      checked={selected}
                      onChange={() => setCount(option.count)}
                      className="peer sr-only"
                      aria-label={`${option.count} colors`}
                    />
                    <span
                      className={`flex min-h-11 items-center gap-2 rounded-lg border p-1.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg ${
                        selected
                          ? 'border-accent bg-surface-2/70'
                          : 'border-line/50 hover:border-accent/50 hover:bg-surface-2/30'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-accent' : 'border-line'
                        }`}
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-accent" />
                        )}
                      </span>
                      <span
                        className={`w-3 text-xs tabular-nums ${
                          selected ? 'text-fg' : 'text-muted'
                        }`}
                      >
                        {option.count}
                      </span>
                      <span className="flex h-8 min-w-0 flex-1 overflow-hidden rounded-md">
                        {option.colors.length === 0 ? (
                          <span className="flex-1 bg-surface-2" />
                        ) : (
                          option.colors.map((hex, index) => (
                            <span
                              key={`${hex}-${index}`}
                              className="flex-1"
                              style={{ background: hex }}
                              title={hex}
                            />
                          ))
                        )}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      )}

      {colors.length > 0 && (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            className="px-2 py-0.5 text-xs"
            onClick={() => onAppend(toPalette(colors))}
          >
            Append
          </Button>
          <Button
            className="px-2.5 py-0.5 text-xs"
            onClick={() => onReplace(toPalette(colors))}
          >
            Use
          </Button>
        </div>
      )}
    </div>
  )
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

/** Draw an image to a downscaled canvas and return its raw RGBA pixels. */
function sampleImage(
  img: HTMLImageElement,
  maxDim: number,
): Uint8ClampedArray {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d canvas context')
  ctx.drawImage(img, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h).data
}
