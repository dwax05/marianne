import { memo } from 'react'
import { Button } from './Button'

interface PalettePaint {
  id: string
  color: string
}

interface Point {
  x: number
  y: number
}

interface Props {
  paints: readonly PalettePaint[]
  selectedPaintId?: string
  onPaintSelect?: (paint: PalettePaint) => void
  className?: string
}

/**
 * Paint-source surface for the landing hero. An artwork image with paint
 * blobs sitting on it — pick a blob to select its color, then smear it across
 * the PaintCanvas. Drop-in replacement for ArtistPaletteBoard (same props).
 *
 * TWO things get tuned when the finished image lands:
 *   1. SOURCE_IMAGE — the asset (drop into /public, reference by URL).
 *   2. HOTSPOTS — where each blob sits, as fractions (0..1) of the rendered
 *      image box, so they stay put at any resolution.
 * Until then SOURCE_IMAGE is null and a dashed placeholder renders so the
 * hotspot layout is visible and tunable.
 */
const SOURCE_IMAGE: string | null = '/palette.svg'

// Normalized (0..1) blob positions, indexed by paint order. Samples carry up
// to 7 swatches, so 7 slots. Placed on the orange splat body, clear of the
// swirl hole at bottom-center. Fractions map to the cropped viewBox that hugs
// the splat (191.2 171.7 620.7 534.1).
const HOTSPOTS: readonly Point[] = [
  { x: 0.22, y: 0.28 },
  { x: 0.39, y: 0.15 },
  { x: 0.55, y: 0.13 },
  { x: 0.68, y: 0.26 },
  { x: 0.7, y: 0.43 },
  { x: 0.32, y: 0.46 },
  { x: 0.52, y: 0.36 },
]

function ImagePaletteBoardImpl({
  paints,
  selectedPaintId,
  onPaintSelect,
  className = '',
}: Props) {
  return (
    <div className={`image-palette-board relative ${className}`}>
      {SOURCE_IMAGE ? (
        <img
          src={SOURCE_IMAGE}
          alt=""
          aria-hidden="true"
          className="block h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center border-2 border-dashed border-line/60 bg-surface-2 text-xs uppercase tracking-widest text-muted"
        >
          paint source image
        </div>
      )}

      {onPaintSelect &&
        paints.map((paint, index) => {
          const spot = HOTSPOTS[index] ?? HOTSPOTS[HOTSPOTS.length - 1]
          const selected = paint.id === selectedPaintId
          return (
            <Button
              key={paint.id}
              type="button"
              variant="paint"
              aria-label={`Paint with ${paint.color}`}
              aria-pressed={selected}
              onClick={() => onPaintSelect({ id: paint.id, color: paint.color })}
              title={`Select ${paint.color}`}
              className={`absolute h-11 w-11 rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${selected ? 'scale-110' : ''}`}
              style={{
                left: `${spot.x * 100}%`,
                top: `${spot.y * 100}%`,
                background: paint.color,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <span className="sr-only">{paint.color}</span>
            </Button>
          )
        })}

      <div className="pointer-events-none absolute inset-x-0 top-full mt-4 text-center text-xs text-muted">
        Choose a color, then drag across the canvas
      </div>
    </div>
  )
}

export const ImagePaletteBoard = memo(ImagePaletteBoardImpl)
