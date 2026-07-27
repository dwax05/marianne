import { memo, useEffect, useRef, useState } from 'react'
import {
  createBoardLayout,
} from './paintBoard'
import type { BoardLayout, PalettePaint, PaintWell, Point } from './paintBoard'
import { Button } from './Button'

export type { PalettePaint } from './paintBoard'

interface Props {
  paints: readonly PalettePaint[]
  selectedPaintId?: string
  onPaintSelect?: (paint: PalettePaint) => void
  className?: string
}

const BOARD_ROTATION = -0.055

function ArtistPaletteBoardImpl({
  paints,
  selectedPaintId,
  onPaintSelect,
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [layout, setLayout] = useState<BoardLayout | null>(null)
  const rotation = BOARD_ROTATION

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const ctx: CanvasRenderingContext2D = context

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        width < 480 ? 1.5 : 2,
      )
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const next = createBoardLayout(width, height, paints)
      setLayout(next)
      drawBoard(ctx, next, rotation, selectedPaintId)
    }

    const observer = new ResizeObserver(build)
    observer.observe(canvas)
    build()
    return () => observer.disconnect()
  }, [paints, rotation, selectedPaintId])

  return (
    <div
      className={`artist-palette-board relative ${className}`}
      data-no-paint
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      {layout && onPaintSelect &&
        layout.paints.map((paint) => {
          const position = rotateAround(paint, { x: layout.cx, y: layout.cy }, rotation)
          const selected = paint.id === selectedPaintId
          return (
            <Button
              key={paint.id}
              type="button"
              variant="paint"
              aria-label={`Paint with ${paint.color}`}
              aria-pressed={selected}
              onClick={() => onPaintSelect({ id: paint.id, color: paint.color })}
              className={`absolute rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${selected ? 'scale-110' : ''}`}
              style={{
                left: position.x,
                top: position.y,
                width: paint.radius * 2.25,
                height: paint.radius * 2.25,
                transform: 'translate(-50%, -50%)',
              }}
              title={`Select ${paint.color}`}
            >
              <span className="sr-only">{paint.color}</span>
            </Button>
          )
        })}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-xs text-muted">
        Choose a color, then drag across the canvas
      </div>
    </div>
  )
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
  rotation: number,
  selectedPaintId?: string,
) {
  ctx.clearRect(0, 0, layout.width, layout.height)
  ctx.save()
  ctx.translate(layout.cx, layout.cy)
  ctx.rotate(rotation)
  ctx.translate(-layout.cx, -layout.cy)
  drawWood(ctx, layout)
  for (const paint of layout.paints) {
    drawFlatPaint(ctx, paint, paint.id === selectedPaintId)
  }
  ctx.restore()
}

function drawWood(
  ctx: CanvasRenderingContext2D,
  layout: BoardLayout,
) {
  const { cx, cy, rx, ry, hole } = layout
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.68)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 18
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#2a1c11'
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.clip()
  const wood = ctx.createRadialGradient(
    cx - rx * 0.3,
    cy - ry * 0.42,
    rx * 0.04,
    cx,
    cy,
    rx,
  )
  wood.addColorStop(0, '#a87b4e')
  wood.addColorStop(0.43, '#805734')
  wood.addColorStop(0.78, '#55351f')
  wood.addColorStop(1, '#2d1c12')
  ctx.fillStyle = wood
  ctx.fillRect(0, 0, layout.width, layout.height)

  for (let index = 0; index < 52; index++) {
    const y = cy - ry + (index / 51) * ry * 2
    const drift = Math.sin(index * 1.73) * 7
    ctx.beginPath()
    ctx.moveTo(cx - rx, y)
    ctx.bezierCurveTo(
      cx - rx * 0.3,
      y + drift,
      cx + rx * 0.28,
      y - drift * 0.6,
      cx + rx,
      y + drift * 0.35,
    )
    ctx.strokeStyle = index % 3 === 0
      ? 'rgba(43, 21, 8, 0.16)'
      : 'rgba(255, 230, 190, 0.055)'
    ctx.lineWidth = index % 7 === 0 ? 2.2 : 0.8
    ctx.stroke()
  }

  const vignette = ctx.createRadialGradient(
    cx - rx * 0.2,
    cy - ry * 0.25,
    rx * 0.15,
    cx,
    cy,
    rx,
  )
  vignette.addColorStop(0, 'rgba(255,255,255,0.06)')
  vignette.addColorStop(0.68, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(20,8,2,0.52)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, layout.width, layout.height)
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.ellipse(hole.x, hole.y, hole.rx, hole.ry, -0.25, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.ellipse(hole.x, hole.y, hole.rx, hole.ry, -0.25, 0, Math.PI * 2)
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(35, 17, 8, 0.65)'
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 225, 185, 0.18)'
  ctx.stroke()
}

function drawFlatPaint(
  ctx: CanvasRenderingContext2D,
  paint: PaintWell,
  selected: boolean,
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(paint.x, paint.y, paint.radius, 0, Math.PI * 2)
  ctx.fillStyle = paint.color
  ctx.fill()
  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ctx.restore()
}

function rotateAround(point: Point, center: Point, angle: number): Point {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export const ArtistPaletteBoard = memo(ArtistPaletteBoardImpl)
