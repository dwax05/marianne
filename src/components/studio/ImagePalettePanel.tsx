import { useMemo, useRef, useState } from 'react'
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
const MIN_COLORS = 4
const MAX_COLORS = 8

/**
 * Source a palette from a photo or artwork. The image never leaves the device:
 * it's drawn to a downscaled offscreen canvas, its pixels read locally, and
 * `extractPalette` (pure) pulls the dominant colours out. Re-extraction on the
 * colour-count slider is cheap because the sampled buffer is kept in state.
 */
export function ImagePalettePanel({ onReplace, onAppend }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string>('')
  const [preview, setPreview] = useState('')
  const [imageData, setImageData] = useState<Uint8ClampedArray | null>(null)
  const [count, setCount] = useState(6)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const colors = useMemo(
    () => (imageData ? extractPalette(imageData, { count }) : []),
    [imageData, count],
  )

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
        <div className="flex items-start gap-3">
          <img
            src={preview}
            alt="Source for palette extraction"
            className="h-16 w-16 shrink-0 rounded-lg border border-line/50 object-cover"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted">
              Colors
              <input
                type="range"
                min={MIN_COLORS}
                max={MAX_COLORS}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="flex-1 accent-accent"
                aria-label="Number of colors to extract"
              />
              <span className="tabular-nums text-fg">{count}</span>
            </label>
            <div className="flex overflow-hidden rounded-lg">
              {colors.length === 0 ? (
                <span className="h-9 flex-1 bg-surface-2" />
              ) : (
                colors.map((hex, i) => (
                  <span
                    key={i}
                    className="h-9 flex-1"
                    style={{ background: hex }}
                    title={hex}
                  />
                ))
              )}
            </div>
          </div>
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
