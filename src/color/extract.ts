import { differenceCiede2000, formatHex } from 'culori'
import type { Hex } from './types'

/**
 * Pull a small, distinct palette out of raw image pixels — pure and DOM-free
 * so the quantization is unit-testable. Callers (components) own the canvas
 * plumbing that turns an image into an RGBA buffer, then hand it here.
 *
 * Method: classic median-cut quantization (the buffer is recursively split on
 * whichever colour box has the widest channel spread, halving at that
 * channel's median), each resulting box collapsed to its mean colour, then a
 * light CIEDE2000 pass drops near-identical neighbours so the result reads as
 * distinct swatches rather than a run of muddy siblings.
 */

interface Pixel {
  r: number // 0..255
  g: number
  b: number
}

type Channel = 'r' | 'g' | 'b'

export interface ExtractOptions {
  /** Desired number of colours (upper bound — dedupe may return fewer). */
  count?: number
  /** Sample every Nth pixel; higher = faster, coarser. Default 1. */
  sampleStride?: number
  /** Skip pixels below this alpha (0..255). Default 125. */
  minAlpha?: number
}

/** CIEDE2000 distance below which two colours are treated as duplicates. */
const DUPLICATE_DELTA_E = 4
const deltaE = differenceCiede2000()

/** Extract up to `count` dominant, perceptually distinct hex colours. */
export function extractPalette(
  rgba: Uint8ClampedArray,
  options: ExtractOptions = {},
): Hex[] {
  const count = Math.max(1, Math.floor(options.count ?? 6))
  const stride = Math.max(1, Math.floor(options.sampleStride ?? 1))
  const minAlpha = options.minAlpha ?? 125

  const pixels: Pixel[] = []
  for (let i = 0; i < rgba.length; i += 4 * stride) {
    if (rgba[i + 3] < minAlpha) continue
    pixels.push({ r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] })
  }
  if (pixels.length === 0) return []

  const boxes = medianCut(pixels, count)
  const colors = boxes.map((box) => toHex(averageColor(box)))
  return dedupe(colors, count)
}

/** Split `pixels` into up to `target` boxes, most-populous box first. */
function medianCut(pixels: Pixel[], target: number): Pixel[][] {
  let boxes: Pixel[][] = [pixels]

  while (boxes.length < target) {
    let widest = -1
    let spread = -1
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue
      const range = channelRanges(boxes[i])
      const vol = Math.max(range.r, range.g, range.b)
      if (vol > spread) {
        spread = vol
        widest = i
      }
    }
    if (widest === -1) break // every box is a single pixel; can't split further

    const box = boxes[widest]
    const range = channelRanges(box)
    const channel: Channel =
      range.r >= range.g && range.r >= range.b
        ? 'r'
        : range.g >= range.b
          ? 'g'
          : 'b'
    const sorted = [...box].sort((a, b) => a[channel] - b[channel])
    const mid = sorted.length >> 1
    boxes.splice(widest, 1, sorted.slice(0, mid), sorted.slice(mid))
  }

  return boxes.sort((a, b) => b.length - a.length)
}

function channelRanges(pixels: Pixel[]): Pixel {
  let rMin = 255,
    gMin = 255,
    bMin = 255,
    rMax = 0,
    gMax = 0,
    bMax = 0
  for (const p of pixels) {
    if (p.r < rMin) rMin = p.r
    if (p.r > rMax) rMax = p.r
    if (p.g < gMin) gMin = p.g
    if (p.g > gMax) gMax = p.g
    if (p.b < bMin) bMin = p.b
    if (p.b > bMax) bMax = p.b
  }
  return { r: rMax - rMin, g: gMax - gMin, b: bMax - bMin }
}

function averageColor(pixels: Pixel[]): Pixel {
  let r = 0,
    g = 0,
    b = 0
  for (const p of pixels) {
    r += p.r
    g += p.g
    b += p.b
  }
  const n = pixels.length
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
  }
}

function toHex(p: Pixel): Hex {
  return (
    formatHex({ mode: 'rgb', r: p.r / 255, g: p.g / 255, b: p.b / 255 }) ??
    '#000000'
  )
}

/** Keep colours in order, dropping any within DUPLICATE_DELTA_E of a kept one. */
function dedupe(colors: Hex[], max: number): Hex[] {
  const out: Hex[] = []
  for (const c of colors) {
    if (out.length >= max) break
    if (out.every((kept) => deltaE(kept, c) > DUPLICATE_DELTA_E)) out.push(c)
  }
  return out
}
