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
  bridges), adds a palette-aware analogous harmony color, and guarantees an
  AA-passing color against a target background.
- **Auto-suggested roles** — infers a light or dark palette interpretation, then
  proposes confidence-ranked semantic roles and alternatives for unassigned
  colors in one reviewable, undoable batch.
- **Manual ordering** — drag swatches by a compact grip with leaderboard-style
  feedback, or use arrow keys from the focused grip; order persists in share
  links and each completed reorder is undoable.
- **Health score** — rolls every check into a single 0–100 verdict.

Automatic role suggestions preserve every explicit role and locked swatch. They
only include unlocked colors set to **No role**, and never change colors, order,
or persistence formats.

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
