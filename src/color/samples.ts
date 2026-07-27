/**
 * Sample palettes named for Miss Goldenweek's "Colors Trap" — the color-and-
 * emotion technique the app is named after (her real name is Marianne). Each
 * design forced a mood on whoever it was painted on; here each is a real,
 * usable palette in that color's key. Two of them nod to her mixing lore:
 * Calming Green is Sorrowful Blue + Laughter Yellow, and Friendship Yellow-Green
 * is that green stirred with more yellow. Rainbow of Dreams is the full swirl.
 *
 * `p` is a ready-to-use URL-hash string (see encode.ts): `<hex>[.<roleCode>]`
 * tokens joined by '-'. Link a sample as `#/app?p=${sample.p}`.
 */
export type Sample = {
  name: string
  /** Original attack name (romaji · literal). */
  origin: string
  /** What the paint did to its target. */
  effect: string
  /** Display swatches, background-first, for the mini preview. */
  swatch: string[]
  /** Encoded palette for the URL hash. */
  p: string
}

export const SAMPLES: Sample[] = [
  {
    name: 'Rainbow of Dreams',
    origin: 'Yume no Nijiiro · Rainbow of Dreams',
    effect: 'a swirl of every color — the target realizes their dream',
    swatch: ['#e5484d', '#f5a623', '#f5d90a', '#2f9e6b', '#3a7bd5', '#7c5cff', '#b5179e'],
    p: 'e5484d.p-f5a623-f5d90a-2f9e6b-3a7bd5.a-7c5cff-b5179e',
  },
  {
    name: 'Betrayal Black',
    origin: 'Uragiri no Kuro · Black of Betrayal',
    effect: 'the target does the exact opposite of what they say',
    swatch: ['#0b0b0d', '#ededf0', '#26262c', '#8a1c2b', '#52525b'],
    p: '0b0b0d.b-ededf0.t-26262c.p-8a1c2b.a-52525b.n',
  },
  {
    name: 'Laughter Yellow',
    origin: 'Warai no Kiiro · Yellow of Laughter',
    effect: 'the target laughs uncontrollably',
    swatch: ['#fffdf5', '#2a2400', '#f5b301', '#ffce3a', '#c9a94b'],
    p: 'fffdf5.b-2a2400.t-f5b301.p-ffce3a.a-c9a94b.n',
  },
  {
    name: 'Bullfight Red',
    origin: 'Togyu no Aka · Red of Bullfighting',
    effect: 'the target aims every attack at the painted mark',
    swatch: ['#1a0608', '#ffecec', '#d21f2c', '#ff5964', '#8a4a4f'],
    p: '1a0608.b-ffecec.t-d21f2c.p-ff5964.a-8a4a4f.n',
  },
  {
    name: 'Sorrowful Blue',
    origin: 'Kanashimi no Ao · Blue of Sadness',
    effect: 'the target is overcome with sadness',
    swatch: ['#0a1420', '#e6f0fb', '#2f6fb0', '#5aa0e0', '#4a6b8a'],
    p: '0a1420.b-e6f0fb.t-2f6fb0.p-5aa0e0.a-4a6b8a.n',
  },
  {
    name: 'Calming Green',
    origin: 'Nagomi no Midori · Green of Soothing (blue + yellow)',
    effect: 'the target sits down for a picnic',
    swatch: ['#0d1a10', '#eefbe9', '#3f9e5a', '#7bd58a', '#5a8a63'],
    p: '0d1a10.b-eefbe9.t-3f9e5a.p-7bd58a.a-5a8a63.n',
  },
  {
    name: 'Friendship Yellow-Green',
    origin: 'Tomodachi no Kimidori · Yellow-Green of Friendship (green + yellow)',
    effect: 'the target becomes her friend and helps her out',
    swatch: ['#131a08', '#f4fbe6', '#8bc34a', '#b6e05a', '#7a8a4a'],
    p: '131a08.b-f4fbe6.t-8bc34a.p-b6e05a.a-7a8a4a.n',
  },
]
