export type Hex = string

export type Role =
  | 'unset'
  | 'background'
  | 'text'
  | 'primary'
  | 'hero'
  | 'accent'
  | 'light-accent'
  | 'dark-accent'
  | 'neutral'
  | 'light-neutral'
  | 'dark-neutral'

export interface Swatch {
  id: string
  hex: Hex
  role: Role
  locked: boolean
}

export type Palette = Swatch[]

/** Roles that sit ON a background and therefore need contrast against it. */
export const FOREGROUND_ROLES: Role[] = [
  'text',
  'primary',
  'hero',
  'accent',
  'light-accent',
  'dark-accent',
]

export const ROLE_LABELS: Record<Role, string> = {
  unset: 'No role',
  background: 'Background',
  text: 'Text',
  primary: 'Primary',
  hero: 'Hero',
  accent: 'Accent',
  'light-accent': 'Light accent',
  'dark-accent': 'Dark accent',
  neutral: 'Neutral',
  'light-neutral': 'Light neutral',
  'dark-neutral': 'Dark neutral',
}

/** OKLCH color as used internally (culori shape, mode omitted here). */
export interface Oklch {
  l: number // 0..1
  c: number // 0..~0.4
  h: number // 0..360 (may be undefined for achromatic -> we default to 0)
}

export type CvdType = 'prot' | 'deuter' | 'trit'

export type WcagLevel = 'AAA' | 'AA' | 'AA-large' | 'fail'

export interface ContrastCell {
  aId: string
  bId: string
  ratio: number
  level: WcagLevel
}

export interface ContrastFix {
  hex: Hex
  ratio: number
  /** Change in OKLCH lightness applied (signed). */
  deltaL: number
}

export interface CollapsedPair {
  aId: string
  bId: string
  /** Perceptual distance between the two colors AS SEEN by the CVD type. */
  distance: number
}

export interface HarmonySet {
  complementary: Hex[]
  analogous: Hex[]
  triadic: Hex[]
  tetradic: Hex[]
  splitComplementary: Hex[]
  monochromatic: Hex[]
}
