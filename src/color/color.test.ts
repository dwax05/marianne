import { describe, it, expect } from 'vitest'
import { toOklch, toHex, normalizeHex } from './convert'
import {
  contrast,
  grade,
  suggestContrastFix,
  rolePairs,
  AA_NORMAL,
} from './contrast'
import { paletteHealth } from './health'
import { simulate, collapsedPairs } from './cvd'
import { analyzeBalance, evenRamp } from './balance'
import { harmonies, combinedHarmonies } from './harmony'
import { encodePalette, decodePalette } from './encode'
import { mixPaint, mixPaintPixel, toPaintRgb } from './paint'
import {
  analyzeCoverage,
  analyzeHarmony,
  applyHarmonyFixes,
  suggestNeutral,
} from './audit'
import { suggestAdditions } from './suggest'
import type { Palette } from './types'

const pal = (...hexes: string[]): Palette =>
  hexes.map((hex, i) => ({ id: `s${i}`, hex, role: 'unset', locked: false }))

describe('convert', () => {
  it('round-trips black and white through oklch', () => {
    expect(normalizeHex('#000')).toBe('#000000')
    const o = toOklch('#ffffff')!
    expect(o.l).toBeCloseTo(1, 2)
  })
  it('toHex clamps to a displayable color', () => {
    // absurd chroma should still yield a valid hex
    const hex = toHex({ l: 0.6, c: 0.9, h: 30 })
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('accepts bare hex colors anywhere normalization is used', () => {
    expect(normalizeHex('fff')).toBe('#ffffff')
    expect(normalizeHex('68B192')).toBe('#68b192')
    expect(normalizeHex(' 00bfff ')).toBe('#00bfff')
    expect(normalizeHex('not-a-color')).toBeNull()
  })
})

describe('paint mixing', () => {
  it('blends two colors without changing either source', () => {
    const red = '#e5484d'
    const blue = '#3a7bd5'

    expect(mixPaint(red, blue, 0)).toBe(red)
    expect(mixPaint(red, blue, 1)).toBe(blue)
    expect(mixPaint(red, blue, 0.5)).not.toBe(red)
    expect(mixPaint(red, blue, 0.5)).not.toBe(blue)
    expect(toPaintRgb(red)).toEqual([229, 72, 77])
    expect(mixPaintPixel([229, 72, 77], blue)).toEqual(
      toPaintRgb(mixPaint(red, blue)),
    )
  })
})

describe('contrast', () => {
  it('black vs white is ~21', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })
  it('grades levels correctly', () => {
    expect(grade(21)).toBe('AAA')
    expect(grade(5)).toBe('AA')
    expect(grade(3.2)).toBe('AA-large')
    expect(grade(1.5)).toBe('fail')
  })
  it('fixes a failing pair to reach AA', () => {
    const fix = suggestContrastFix('#777777', '#ffffff', AA_NORMAL)
    expect(fix).not.toBeNull()
    expect(fix!.ratio).toBeGreaterThanOrEqual(AA_NORMAL)
  })
  it('returns delta 0 when already passing', () => {
    const fix = suggestContrastFix('#000000', '#ffffff')
    expect(fix!.deltaL).toBe(0)
  })
})

describe('rolePairs', () => {
  const roled = (
    entries: [string, import('./types').Role][],
  ): Palette =>
    entries.map(([hex, role], i) => ({ id: `s${i}`, hex, role, locked: false }))

  it('reports no background when none assigned', () => {
    expect(rolePairs(pal('#000', '#fff')).hasBackground).toBe(false)
  })
  it('pairs each foreground against each background only', () => {
    const p = roled([
      ['#ffffff', 'background'],
      ['#1b1b1f', 'text'],
      ['#3a7bd5', 'primary'],
      ['#8a8f98', 'neutral'], // neutral is not a foreground role -> excluded
    ])
    const { pairs, hasBackground } = rolePairs(p)
    expect(hasBackground).toBe(true)
    expect(pairs).toHaveLength(2) // text+primary vs the one background
  })
  it('checks hero and accent variants as foreground roles', () => {
    const p = roled([
      ['#ffffff', 'background'],
      ['#172554', 'hero'],
      ['#60a5fa', 'light-accent'],
      ['#1e3a8a', 'dark-accent'],
      ['#f5f5f4', 'light-neutral'],
      ['#292524', 'dark-neutral'],
    ])
    expect(rolePairs(p).pairs).toHaveLength(3)
    expect(rolePairs(p).pairs.map((pair) => pair.fg.role)).toEqual(
      expect.arrayContaining(['light-accent', 'hero', 'dark-accent']),
    )
  })
})

describe('health', () => {
  it('scores a clean palette high and a broken one lower', () => {
    const good = [
      { id: 'a', hex: '#ffffff', role: 'background' as const, locked: false },
      { id: 'b', hex: '#111111', role: 'text' as const, locked: false },
    ]
    const bad = [
      { id: 'a', hex: '#ffffff', role: 'background' as const, locked: false },
      { id: 'b', hex: '#eeeeee', role: 'text' as const, locked: false },
    ]
    expect(paletteHealth(good).score).toBeGreaterThan(paletteHealth(bad).score)
    expect(paletteHealth(bad).issueCount).toBeGreaterThan(0)
  })
})

describe('palette audit', () => {
  it('finds a saturation outlier and suggests a harmonized replacement', () => {
    const p = pal('#68b192', '#7b7fb2', '#00bfff')
    const issues = analyzeHarmony(p)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      kind: 'saturation',
      currentHex: '#00bfff',
    })
    expect(toOklch(issues[0].suggestedHex)!.c).toBeCloseTo(0.087, 2)
  })

  it('finds a bright color outside an otherwise tight lightness cluster', () => {
    const p = pal('#edc9ff', '#f2b79f', '#e6b869', '#d8cc34', '#f29fb0')
    const issues = analyzeHarmony(p)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'lightness',
          currentHex: '#edc9ff',
          title: 'Too bright compared to palette',
        }),
      ]),
    )
  })

  it('does not mistake an intentional tonal ramp for outliers', () => {
    expect(
      analyzeHarmony(pal('#25163d', '#613c86', '#9d70bd', '#d9b5ef')),
    ).toHaveLength(0)
  })

  it('applies fixes without changing locked colors', () => {
    const p = pal('#68b192', '#7b7fb2', '#00bfff')
    p[2].locked = true
    const issues = analyzeHarmony(p)
    expect(applyHarmonyFixes(p, issues)).toEqual(p)
  })

  it('detects missing neutral anchors and suggests tinted replacements', () => {
    const p = pal('#68b192', '#7b7fb2', '#00bfff')
    expect(analyzeCoverage(p)).toEqual({
      hasLightNeutral: false,
      hasDarkNeutral: false,
    })
    const light = suggestNeutral(p, 'light')
    const dark = suggestNeutral(p, 'dark')
    expect(toOklch(light)!.l).toBeGreaterThanOrEqual(0.88)
    expect(toOklch(dark)!.l).toBeLessThanOrEqual(0.3)

    const suggestions = suggestAdditions(p)
    expect(suggestions.map((suggestion) => suggestion.kind)).toEqual([
      'light-neutral',
      'dark-neutral',
    ])
    expect(suggestions.map((suggestion) => suggestion.role)).toEqual([
      'light-neutral',
      'dark-neutral',
    ])
  })

  it('does not bridge a gap that only exists around a neutral anchor', () => {
    // Three tightly-clustered chromatic colors plus light/dark neutral anchors.
    // The big lightness gaps are between the neutrals and the cluster — bridging
    // them with a chromatic mid-tone would read as a balance outlier, so no
    // tonal bridge should be offered.
    const p = pal('#68b192', '#7b7fb2', '#74badd', '#ecf5f9', '#181f22')
    const bridge = suggestAdditions(p).find(
      (suggestion) => suggestion.kind === 'lightness-gap',
    )
    expect(bridge).toBeUndefined()
  })

  it('bridges a genuine chromatic gap without worsening harmony or balance', () => {
    // A dark and a light chromatic color with nothing between them.
    const p = pal('#0d3b2e', '#9be8c8')
    const bridge = suggestAdditions(p).find(
      (suggestion) => suggestion.kind === 'lightness-gap',
    )
    expect(bridge).toBeDefined()

    const withBridge: Palette = [
      ...p,
      { id: 'bridge', hex: bridge!.hex, role: bridge!.role, locked: false },
    ]
    expect(analyzeHarmony(withBridge)).toHaveLength(0)
    // Adding the bridge must not trip the Balance warning (unevenness < 0.05).
    expect(analyzeBalance(withBridge).unevenness).toBeLessThan(0.05)
  })
})

describe('cvd', () => {
  it('simulate returns a valid hex', () => {
    expect(simulate('#e5484d', 'deuter')).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('flags a red/green pair as collapsed for deuteranopia', () => {
    const p = pal('#d33', '#3a3') // red + green: classic confusion
    // With a normal-vision eye these are far apart; under deuteranopia they
    // converge, so a generous-but-real threshold flags them.
    expect(collapsedPairs(p, 'deuter', 15).length).toBeGreaterThan(0)
    // ...and a strict threshold does not flag an obviously distinct pair.
    expect(collapsedPairs(pal('#000', '#fff'), 'deuter', 15)).toHaveLength(0)
  })
})

describe('balance', () => {
  it('evenRamp produces near-uniform lightness steps', () => {
    const p = pal('#111111', '#222222', '#f0f0f0') // clustered dark + one light
    const evened = evenRamp(p)
    const report = analyzeBalance(evened)
    const gaps = report.steps.slice(1).map((s) => s.gapL)
    const max = Math.max(...gaps)
    const min = Math.min(...gaps)
    expect(max - min).toBeLessThan(0.01)
  })
})

describe('harmony', () => {
  it('complementary rotates hue ~180 degrees', () => {
    const h = harmonies('#e5484d')!
    const baseH = toOklch(h.complementary[0])!.h
    const compH = toOklch(h.complementary[1])!.h
    const hueDelta = ((compH - baseH + 360) % 360) // 0..360
    expect(Math.abs(hueDelta - 180)).toBeLessThan(1)
  })
  it('triadic yields 3 colors', () => {
    expect(harmonies('#3a7bd5')!.triadic).toHaveLength(3)
  })
  it('combined interleaves multiple bases and dedupes', () => {
    const c = combinedHarmonies(['#e5484d', '#3a7bd5'])!
    // two bases, each complementary set has 2 colors, no overlap -> 4
    expect(c.complementary).toHaveLength(4)
    // no duplicate hexes
    expect(new Set(c.complementary.map((h) => h.toLowerCase())).size).toBe(4)
  })
  it('combined of one base equals single harmony', () => {
    expect(combinedHarmonies(['#3a7bd5'])!.triadic).toEqual(
      harmonies('#3a7bd5')!.triadic,
    )
  })
  it('combined of no valid bases is null', () => {
    expect(combinedHarmonies([])).toBeNull()
  })
})

describe('encode', () => {
  it('round-trips a palette', () => {
    const p = pal('#1b1b1f', '#e5484d', '#2f9e6b')
    const decoded = decodePalette(encodePalette(p))
    expect(decoded.map((s) => s.hex)).toEqual([
      '#1b1b1f',
      '#e5484d',
      '#2f9e6b',
    ])
  })
  it('drops invalid tokens', () => {
    expect(decodePalette('zzzzzz-e5484d')).toHaveLength(1)
  })
  it('round-trips roles and lock flags', () => {
    const p: Palette = [
      { id: 'a', hex: '#ffffff', role: 'background', locked: false },
      { id: 'b', hex: '#1b1b1f', role: 'text', locked: true },
      { id: 'c', hex: '#3a7bd5', role: 'hero', locked: false },
      { id: 'd', hex: '#a9d7ff', role: 'light-accent', locked: false },
      { id: 'e', hex: '#173c67', role: 'dark-accent', locked: false },
      { id: 'f', hex: '#f7f5f1', role: 'light-neutral', locked: false },
      { id: 'g', hex: '#242321', role: 'dark-neutral', locked: false },
    ]
    const decoded = decodePalette(encodePalette(p))
    expect(decoded.map((s) => [s.hex, s.role, s.locked])).toEqual([
      ['#ffffff', 'background', false],
      ['#1b1b1f', 'text', true],
      ['#3a7bd5', 'hero', false],
      ['#a9d7ff', 'light-accent', false],
      ['#173c67', 'dark-accent', false],
      ['#f7f5f1', 'light-neutral', false],
      ['#242321', 'dark-neutral', false],
    ])
  })
  it('reads legacy plain-hex tokens', () => {
    const decoded = decodePalette('1b1b1f-e5484d')
    expect(decoded[0]).toMatchObject({ role: 'unset', locked: false })
  })
})
