import type { Palette } from './types'
import { rolePairs } from './contrast'
import { collapsedPairs } from './cvd'
import { analyzeBalance } from './balance'
import { analyzeCoverage, analyzeHarmony } from './audit'

export interface HealthCheck {
  key: 'contrast' | 'cvd' | 'balance' | 'harmony' | 'coverage'
  label: string
  /** 'good' = nothing wrong, 'warn' = minor, 'bad' = needs attention. */
  status: 'good' | 'warn' | 'bad'
  summary: string
}

export interface Health {
  score: number // 0..100
  checks: HealthCheck[]
  issueCount: number
}

/** Roll up every analyzer into one glanceable verdict. */
export function paletteHealth(palette: Palette): Health {
  const checks: HealthCheck[] = []

  // Contrast (role-based)
  const { pairs, hasBackground } = rolePairs(palette)
  if (!hasBackground) {
    checks.push({
      key: 'contrast',
      label: 'Contrast',
      status: 'warn',
      summary: 'Assign a Background role to check readability.',
    })
  } else {
    const fails = pairs.filter(
      (p) => p.level === 'fail' || p.level === 'AA-large',
    ).length
    checks.push({
      key: 'contrast',
      label: 'Contrast',
      status: fails === 0 ? 'good' : 'bad',
      summary:
        fails === 0
          ? 'All text/background combinations pass AA.'
          : `${fails} combination(s) are hard to read.`,
    })
  }

  // Colour vision (worst of the three deficiencies)
  const cvdCounts = (['deuter', 'prot', 'trit'] as const).map(
    (t) => collapsedPairs(palette, t, 15).length,
  )
  const cvdWorst = Math.max(...cvdCounts)
  checks.push({
    key: 'cvd',
    label: 'Color vision',
    status: cvdWorst === 0 ? 'good' : 'warn',
    summary:
      cvdWorst === 0
        ? 'No colors clash for colorblind viewers.'
        : `${cvdWorst} pair(s) look alike to some colorblind viewers.`,
  })

  // Perceptual balance
  if (palette.length >= 3) {
    const { unevenness } = analyzeBalance(palette)
    checks.push({
      key: 'balance',
      label: 'Balance',
      status: unevenness < 0.05 ? 'good' : 'warn',
      summary:
        unevenness < 0.05
          ? 'Lightness steps are evenly spaced.'
          : 'Lightness spacing is uneven.',
    })
  }

  // Saturation / lightness outliers
  const harmonyIssues = analyzeHarmony(palette)
  checks.push({
    key: 'harmony',
    label: 'Harmony',
    status: harmonyIssues.length === 0 ? 'good' : 'warn',
    summary:
      harmonyIssues.length === 0
        ? 'No saturation or lightness outliers found.'
        : `${harmonyIssues.length} color(s) break from the palette's main character.`,
  })

  // Neutral coverage
  const coverage = analyzeCoverage(palette)
  const missingNeutralCount =
    Number(!coverage.hasLightNeutral) + Number(!coverage.hasDarkNeutral)
  checks.push({
    key: 'coverage',
    label: 'Neutrals',
    status: missingNeutralCount === 0 ? 'good' : 'warn',
    summary:
      missingNeutralCount === 0
        ? 'Light and dark neutral anchors are present.'
        : `Missing ${[
            !coverage.hasLightNeutral && 'a light neutral',
            !coverage.hasDarkNeutral && 'a dark neutral',
          ]
            .filter(Boolean)
            .join(' and ')}.`,
  })

  const issueCount = checks.filter((c) => c.status !== 'good').length
  const bad = checks.filter((c) => c.status === 'bad').length
  const warn = checks.filter((c) => c.status === 'warn').length
  const score = Math.max(0, 100 - bad * 30 - warn * 12)

  return { score, checks, issueCount }
}
