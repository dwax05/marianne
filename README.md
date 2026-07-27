# marianne

A fully client-side color palette optimizer. Build a palette by hand and marianne
checks it for WCAG contrast, color-vision safety, and perceptual balance, suggests
fixes, and generates harmonious palettes.

No backend, no accounts — state lives in `localStorage` and the URL hash, so every
palette is shareable by link.

## Features

- **Contrast** — WCAG AA/AAA checks across meaningful role pairs, with one-click
  lightness fixes.
- **Color vision** — colorblind simulation (protan / deutan / tritan) and detection
  of pairs that collapse together.
- **Balance** — OKLCH lightness spacing analysis and an even-ramp respacer.
- **Harmony** — flags saturation/lightness outliers and generates harmonious
  palettes by hue rotation.
- **Smart suggestions** — fills structural gaps (light/dark neutral anchors, tonal
  bridges) and guarantees an AA-passing color against a target background.
- **Health score** — rolls every check into a single 0–100 verdict.

Locked swatches are protected from any automatic change.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · [culori](https://culorijs.org)
for color math · [motion](https://motion.dev) · Vitest.

All color science lives in `src/color/` as pure functions (no React, no DOM),
covered by `src/color/color.test.ts`.

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # tsc -b && vite build
npm run test     # vitest run
npm run lint     # oxlint
```
