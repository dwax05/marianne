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
- **Automatic palettes** — creates a random five-color starter with light and
  dark neutral anchors plus an analogous, triadic, or split-complementary trio,
  either unassigned or with suggested semantic roles already applied; every
  automatic result clears a 76-point palette-health floor with no bad checks.
- **Smart suggestions** — fits a requested hue such as green to the palette's
  visual weight, fills structural gaps (light/dark neutral anchors, tonal
  bridges), adds a palette-aware analogous harmony color, and guarantees an
  AA-passing color against a target background.
- **Auto-suggested roles** — infers a light or dark palette interpretation, then
  proposes confidence-ranked semantic roles and alternatives for unassigned
  colors in one reviewable, undoable batch.
- **Palette workflow** — drag or keyboard-reorder swatches, sort them dark to
  light in one undoable action, and copy the complete palette as role-aware CSS
  custom properties.
- **Clear and restart** — clear the palette in one undoable action, then open the
  generator or add the first color manually from the empty state.
- **Palette simplification** — once a palette grows past eight colors, offers an
  undoable cleanup only when unlocked, unassigned colors are perceptually
  redundant; purposeful large palettes are left alone.
- **Health score** — rolls every check into a single 0–100 verdict.

Automatic role suggestions preserve every explicit role and locked swatch. They
only include unlocked colors set to **No role**, and never change colors, order,
or persistence formats.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · [culori](https://culorijs.org)
for color math · [motion](https://motion.dev) · Vitest.

All color science lives in `src/color/` as pure functions (no React, no DOM),
covered by `src/color/color.test.ts`.

## Documentation

- [How marianne decides on color](COLOR_DECISIONS.md) — a
  reader-friendly and developer-facing walkthrough of every palette editor,
  analyzer, suggestion, and generator.

## Development

```bash
npm install
npm run dev      # dev server
npm run build    # tsc -b && vite build
npm run test     # vitest run
npm run lint     # oxlint
```
