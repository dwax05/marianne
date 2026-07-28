import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { mixPaintPixel, toPaintRgb } from '../../color/paint'
import { clamp } from '../../lib/num'
import { Button } from './Button'
import { UndoIcon } from './icons'
import type { Theme } from '../../theme'

interface PaintPoint {
  x: number
  y: number
}

interface BrushSegment {
  from: PaintPoint
  to: PaintPoint
  width: number
  color: string
  strokeId: number
  seed: number
}

interface PaintCanvasSession {
  version: number
  nextStrokeId: number
  segments: BrushSegment[]
}

const PaintCanvasContext = createContext<PaintCanvasSession | null>(null)

export function PaintCanvasSessionProvider({ children }: { children: ReactNode }) {
  const session = useRef<PaintCanvasSession>({
    version: 6,
    nextStrokeId: 1,
    segments: [],
  })
  return (
    <PaintCanvasContext.Provider value={session.current}>
      {children}
    </PaintCanvasContext.Provider>
  )
}

export function CanvasBackdrop({ theme }: { theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const ctx: CanvasRenderingContext2D = context

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      const dpr = Math.min(window.devicePixelRatio || 1, width < 480 ? 1.5 : 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const canvasColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--canvas-bg')
        .trim()
      drawCanvasTexture(ctx, width, height, canvasColor, theme)
    }

    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    draw()
    return () => observer.disconnect()
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="canvas-backdrop pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  )
}

export function PaintCanvas({
  color,
}: {
  color: string | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const redrawRef = useRef<(() => void) | null>(null)
  const inheritedSession = useContext(PaintCanvasContext)
  const localSession = useRef<PaintCanvasSession>({
    version: 6,
    nextStrokeId: 1,
    segments: [],
  })
  const session = inheritedSession ?? localSession.current
  if (session.version !== 6) {
    session.version = 6
    session.nextStrokeId = 1
    session.segments = []
  }
  const armed = color != null
  const colorRef = useRef(color)
  const armedRef = useRef(armed)
  const updateCursorRef = useRef<(() => void) | null>(null)
  const [hasPaint, setHasPaint] = useState(() => session.segments.length > 0)
  colorRef.current = color
  armedRef.current = armed

  // Re-evaluate the paint cursor whenever the armed state flips.
  useEffect(() => {
    updateCursorRef.current?.()
  }, [armed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const ctx: CanvasRenderingContext2D = context
    const forcedColors = window.matchMedia('(forced-colors: active)')
    const paintLayer = document.createElement('canvas')
    const paintContext = paintLayer.getContext('2d')!
    const maskLayer = document.createElement('canvas')
    const maskContext = maskLayer.getContext('2d', { willReadFrequently: true })!
    const mixCache = new Map<string, [number, number, number]>()
    let owners = new Uint32Array(1)
    let width = 1
    let height = 1
    let dpr = 1
    // Segments are stored in page coordinates so paint scrolls with the page.
    // These offsets map page space back into the fixed viewport canvas.
    let scrollX = window.scrollX
    let scrollY = window.scrollY
    let active: {
      pointerId: number
      point: PaintPoint
      strokeId: number
      width: number
    } | null = null
    let segmentSeed = session.segments.length

    const applyPaint = (segment: BrushSegment, present: boolean) => {
      // Convert page-space endpoints into viewport space for this scroll offset.
      const from = { x: segment.from.x - scrollX, y: segment.from.y - scrollY }
      const to = { x: segment.to.x - scrollX, y: segment.to.y - scrollY }
      const pad = segment.width / 2 + 3
      const left = clamp(Math.floor(Math.min(from.x, to.x) - pad), 0, width)
      const top = clamp(Math.floor(Math.min(from.y, to.y) - pad), 0, height)
      const right = clamp(Math.ceil(Math.max(from.x, to.x) + pad), 0, width)
      const bottom = clamp(Math.ceil(Math.max(from.y, to.y) + pad), 0, height)
      if (right <= left || bottom <= top) return

      maskContext.clearRect(left, top, right - left, bottom - top)
      drawBrushSegment(maskContext, { ...segment, from, to, color: '#ffffff' })

      const sx = Math.floor(left * dpr)
      const sy = Math.floor(top * dpr)
      const sw = Math.min(paintLayer.width - sx, Math.ceil((right - left) * dpr))
      const sh = Math.min(paintLayer.height - sy, Math.ceil((bottom - top) * dpr))
      if (sw <= 0 || sh <= 0) return
      const mask = maskContext.getImageData(sx, sy, sw, sh)
      const existing = paintContext.getImageData(sx, sy, sw, sh)
      const incoming = toPaintRgb(segment.color)
      const ownerId = segment.strokeId

      for (let index = 0; index < mask.data.length; index += 4) {
        const maskAlpha = mask.data[index + 3]
        if (maskAlpha === 0) continue
        const pixel = index / 4
        const ownerIndex =
          (sy + Math.floor(pixel / sw)) * paintLayer.width
          + sx
          + (pixel % sw)
        const existingAlpha = existing.data[index + 3]
        if (owners[ownerIndex] === ownerId) {
          existing.data[index + 3] = Math.max(existingAlpha, maskAlpha)
          continue
        }
        let next = incoming
        const sameColor =
          existing.data[index] === incoming[0]
          && existing.data[index + 1] === incoming[1]
          && existing.data[index + 2] === incoming[2]
        if (existingAlpha > 0 && !sameColor) {
          const key = `${existing.data[index]},${existing.data[index + 1]},${existing.data[index + 2]}:${segment.color}`
          next = mixCache.get(key) ?? mixPaintPixel(
            [
              existing.data[index],
              existing.data[index + 1],
              existing.data[index + 2],
            ],
            segment.color,
          )
          mixCache.set(key, next)
        }
        existing.data[index] = next[0]
        existing.data[index + 1] = next[1]
        existing.data[index + 2] = next[2]
        existing.data[index + 3] = Math.max(existingAlpha, maskAlpha)
        owners[ownerIndex] = ownerId
      }
      if (mixCache.size > 512) mixCache.clear()
      paintContext.putImageData(existing, sx, sy)

      if (present) {
        ctx.drawImage(
          paintLayer,
          sx,
          sy,
          sw,
          sh,
          left,
          top,
          right - left,
          bottom - top,
        )
      }
    }

    const redraw = () => {
      ctx.clearRect(0, 0, width, height)
      paintContext.clearRect(0, 0, width, height)
      owners.fill(0)
      for (const segment of session.segments) {
        applyPaint(segment, false)
      }
      ctx.drawImage(paintLayer, 0, 0, width, height)
    }

    const build = () => {
      scrollX = window.scrollX
      scrollY = window.scrollY
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, width < 480 ? 1.5 : 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      paintLayer.width = canvas.width
      paintLayer.height = canvas.height
      maskLayer.width = canvas.width
      maskLayer.height = canvas.height
      owners = new Uint32Array(canvas.width * canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      maskContext.setTransform(dpr, 0, 0, dpr, 0, 0)
      redraw()
    }

    const pointFromEvent = (event: PointerEvent): PaintPoint => {
      return { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY }
    }

    const blocked = (event: PointerEvent) => {
      const target = event.target
      return target instanceof Element
        && Boolean(target.closest('a, button, input, select, textarea, [data-no-paint]'))
    }

    const onPointerDown = (event: PointerEvent) => {
      if (forcedColors.matches || !armedRef.current) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (blocked(event)) return
      active = {
        pointerId: event.pointerId,
        point: pointFromEvent(event),
        strokeId: session.nextStrokeId++,
        width: 24,
      }
      event.preventDefault()
    }

    const onPointerMove = (event: PointerEvent) => {
      const cursor = cursorRef.current
      if (cursor) {
        cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`
        cursor.style.opacity =
          forcedColors.matches || !armedRef.current || blocked(event) || event.pointerType === 'touch'
            ? '0'
            : '1'
      }
      if (!active || active.pointerId !== event.pointerId) return
      const paintColor = colorRef.current
      if (paintColor == null) return
      const next = pointFromEvent(event)
      const distance = Math.hypot(next.x - active.point.x, next.y - active.point.y)
      if (distance < 1) return
      const targetWidth = clamp(29 - distance * 0.12, 19, 29)
      active.width += (targetWidth - active.width) * 0.22
      const wasEmpty = session.segments.length === 0
      const segment: BrushSegment = {
        from: active.point,
        to: next,
        width: active.width,
        color: paintColor,
        strokeId: active.strokeId,
        seed: segmentSeed++,
      }
      session.segments.push(segment)
      applyPaint(segment, true)
      if (session.segments.length > 1800) session.segments.splice(0, 300)
      active.point = next
      if (wasEmpty) setHasPaint(true)
      event.preventDefault()
    }

    const finish = (event: PointerEvent) => {
      if (active?.pointerId === event.pointerId) active = null
    }

    const hideCursor = () => {
      if (cursorRef.current) cursorRef.current.style.opacity = '0'
    }

    const updateCursorMode = () => {
      const paintable = armedRef.current && !forcedColors.matches
      document.body.classList.toggle('paint-cursor-active', paintable)
      if (!paintable) {
        active = null
        hideCursor()
      }
    }
    updateCursorRef.current = updateCursorMode

    // Repaint in page space as the user scrolls so strokes travel with content.
    let scrollFrame = 0
    const onScroll = () => {
      if (scrollFrame) return
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0
        scrollX = window.scrollX
        scrollY = window.scrollY
        redraw()
      })
    }

    const observer = new ResizeObserver(build)
    observer.observe(canvas)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: false })
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    document.documentElement.addEventListener('pointerleave', hideCursor)
    forcedColors.addEventListener('change', updateCursorMode)
    updateCursorMode()
    redrawRef.current = redraw
    build()

    return () => {
      observer.disconnect()
      if (scrollFrame) cancelAnimationFrame(scrollFrame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      document.documentElement.removeEventListener('pointerleave', hideCursor)
      forcedColors.removeEventListener('change', updateCursorMode)
      document.body.classList.remove('paint-cursor-active')
      redrawRef.current = null
      updateCursorRef.current = null
    }
  }, [session])

  const clear = () => {
    session.segments.length = 0
    setHasPaint(false)
    redrawRef.current?.()
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="paint-page-canvas pointer-events-none fixed inset-0 z-0 h-full w-full"
      />
      <div
        ref={cursorRef}
        aria-hidden="true"
        className="paint-cursor pointer-events-none fixed left-0 top-0 z-50 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fg/70 opacity-0 shadow-[0_1px_3px_var(--shadow)]"
        style={{ backgroundColor: color ?? 'transparent' }}
      />
      {hasPaint && (
        <Button
          variant="ghost"
          onClick={clear}
          className="fixed bottom-4 right-4 z-40 bg-bg/70 px-2 py-1 text-xs backdrop-blur"
          data-no-paint
        >
          <UndoIcon width={13} height={13} /> Clear canvas
        </Button>
      )}
    </>
  )
}

function drawCanvasTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  canvasColor: string,
  theme: Theme,
) {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = canvasColor
  ctx.fillRect(0, 0, width, height)

  const dark = theme === 'dark'
  const threadLight = dark
    ? 'rgba(242, 231, 211, 0.035)'
    : 'rgba(255, 252, 243, 0.16)'
  const threadShadow = dark
    ? 'rgba(0, 0, 0, 0.14)'
    : 'rgba(87, 70, 49, 0.075)'

  // A paired highlight and shadow gives each strand a little relief without
  // turning the weave into a visible grid. Small deterministic bends keep it
  // feeling like cloth when the canvas is redrawn or resized.
  ctx.save()
  ctx.lineWidth = 0.45
  for (let x = -2; x < width + 2; x += 4.8) {
    drawCanvasThread(ctx, x, height, false, x * 0.73, threadShadow)
    drawCanvasThread(ctx, x + 0.7, height, false, x * 0.73, threadLight)
  }
  for (let y = -2; y < height + 2; y += 4.35) {
    drawCanvasThread(ctx, y, width, true, y * 0.81, threadShadow)
    drawCanvasThread(ctx, y + 0.65, width, true, y * 0.81, threadLight)
  }

  ctx.restore()

  // Subtle edge depth suggests stretched canvas while keeping the center calm.
  const vignette = ctx.createRadialGradient(
    width * 0.48,
    height * 0.35,
    Math.min(width, height) * 0.12,
    width * 0.5,
    height * 0.45,
    Math.max(width, height) * 0.78,
  )
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(0.72, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, dark ? 'rgba(0, 0, 0, 0.16)' : 'rgba(68, 52, 36, 0.075)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)
}

function drawCanvasThread(
  ctx: CanvasRenderingContext2D,
  position: number,
  length: number,
  horizontal: boolean,
  seed: number,
  color: string,
) {
  ctx.beginPath()
  for (let distance = 0; distance <= length + 28; distance += 28) {
    const offset =
      Math.sin(distance * 0.037 + seed) * 0.38
      + Math.sin(distance * 0.011 + seed * 1.7) * 0.22
    const x = horizontal ? distance : position + offset
    const y = horizontal ? position + offset : distance
    if (distance === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = color
  ctx.stroke()
}

function drawBrushSegment(
  ctx: CanvasRenderingContext2D,
  segment: BrushSegment,
) {
  const { from, to, width, color, seed } = segment
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const nx = -dy / distance
  const ny = dx / distance

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 1
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.quadraticCurveTo(
    (from.x + to.x) / 2 + nx * jitter(seed, 1) * width * 0.12,
    (from.y + to.y) / 2 + ny * jitter(seed, 2) * width * 0.12,
    to.x,
    to.y,
  )
  ctx.stroke()

  ctx.restore()
}

function jitter(seed: number, salt: number): number {
  const value = Math.sin(seed * 91.17 + salt * 47.11) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}
