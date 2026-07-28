# How marianne decides on color

This guide explains every part of marianne that analyzes, chooses, or changes a
palette color. Each section starts with the behavior a palette author sees, then
describes the implementation for contributors.

marianne is a decision aid, not an oracle. A passing score means the checks in
this document passed; it does not mean every possible use of the palette is
accessible or aesthetically correct. Roles and locks are how an author tells the
app what a color is for and which decisions must remain theirs.

## The common color model

Studio analyses and suggestions share the same ordered list of swatches. A
swatch has:

- a normalized `#rrggbb` display color;
- a semantic role, such as Background, Text, Primary, or Neutral; and
- a lock flag that protects it from automatic fixes.

Most visual decisions are made in **OKLCH**, whose three coordinates are easier
to reason about independently than RGB:

- **L** is perceptual lightness, from `0` (black) to `1` (white);
- **C** is chroma, or color intensity; and
- **H** is hue around a `0–360°` color wheel.

When marianne turns an OKLCH result back into a screen color, it reduces chroma
as needed to fit the displayable gamut and then emits hex. That means a vivid
requested color can become quieter at very light or dark lightness values.

Two other measurements appear throughout the app:

- **WCAG contrast ratio** measures readable light/dark separation from `1:1` to
  `21:1`.
- **CIEDE2000 ΔE** estimates perceptual difference. A smaller value means two
  colors look more alike.

The shared parsing and conversion path is in
[`src/color/convert.ts`](src/color/convert.ts), and the swatch/role model is in
[`src/color/types.ts`](src/color/types.ts).

## At a glance

| Studio area | What it decides | Does it change the palette automatically? |
| --- | --- | --- |
| Palette editor | Accepts a color and gives a newly added gray swatch a palette-aware starting color when its first role is chosen | Only after an explicit edit or role choice |
| Auto-suggest roles | Infers what existing colors could be used for | No; the author reviews a batch first, and applying changes roles only |
| Simplify palette | Finds safely removable near-duplicates after a palette grows past eight colors | Only when Simplify is chosen |
| Palette health | Summarizes five analyzers in one score | No |
| Smart palette suggestions | Proposes missing structure, a requested hue, harmony, and accessible foregrounds | No; each proposal has an Add action |
| Harmony check | Finds unusually vivid, bright, or dark colors and proposes a correction | Only when Apply is chosen |
| Readability | Grades role-based foreground/background pairs and proposes a lightness fix | Only when Apply is chosen |
| Color-vision safety | Simulates three color-vision deficiencies and finds confusable pairs | No |
| Perceptual balance | Measures lightness spacing and previews an even ramp | Only when Apply is chosen |
| From an image | Extracts dominant RGB clusters from local image pixels | Only when Use or Append is chosen |
| Generate a palette | Rotates one or more base hues into classic harmony sets | Only when Use or Append is chosen |

## Palette editor: entering and protecting colors

### Reader view

A color can be entered with the native color picker, the screen eyedropper when
the browser supports it, a CSS color name, or a hex value with or without `#`.
marianne normalizes valid input to six-digit hex. Invalid text is discarded and
the swatch returns to its last valid value.

**Add color** creates a neutral gray placeholder (`#888888`) with No role. If the
author immediately gives that untouched placeholder a role, marianne turns it
into a useful palette-aware starting color:

- Background and Light neutral become a very light, subtly tinted neutral.
- Dark neutral becomes a dark, subtly tinted neutral.
- Text starts as a dark tinted neutral, then tries to move lighter or darker if
  needed to pass AA against the palette's Background.
- Neutral becomes a middle-light, low-chroma version of the palette's
  representative hue.
- Primary, Hero, and Accent become a nearby analogous hue and, when possible,
  are moved to AA contrast when a Background exists.
- Light accent and Dark accent use that analogous hue but favor their requested
  light or dark tone instead of forcing contrast.

Changing the role of any non-placeholder swatch never changes its color.

A lock does not prevent manual editing or role changes. It protects the swatch
from automatic color fixes and excludes it from automatic role assignment.

**Clear palette** removes every swatch as one undoable action; it does not reset
to the built-in defaults. With no colors, the Palette sidebar offers two explicit
starting paths: open the palette generator or add the gray manual placeholder.
Opening the generator scrolls to its section, moves programmatic focus there,
and briefly highlights the card. The same feedback repeats if Generate mode was
already open, so the action never appears to do nothing.

### Developer view

Input goes through `normalizeHex`, which accepts anything Culori can parse plus
bare 3-, 4-, 6-, and 8-digit hex. `makeSwatch` stores the resulting six-digit
hex. The add-and-assign behavior is deliberately narrow: `usePalette.setRole`
calls `suggestForRole` only when the current value is exactly `SKELETON_HEX` and
the new role is not `unset`.

Role-based starting colors are produced as follows:

- Light neutral: `L = 0.984`; chroma is the palette's average chromatic chroma
  multiplied by `0.08`, clamped to `0.006–0.012`; hue is the representative hue
  plus `30°`.
- Dark neutral: `L = 0.25`; chroma is average chromatic chroma multiplied by
  `0.20`, clamped to `0.012–0.024`; hue is the representative hue.
- Generic neutral: `L = 0.60`, `C = 0.02`, representative hue.
- Brand/accent roles: use the representative chromatic swatch as a seed, rotate
  `30°` toward the less crowded adjacent side of the OKLCH hue wheel, and apply
  a chroma floor of `0.10`. Light accent has `L >= 0.82`; Dark accent has
  `L <= 0.42`.
- If no chromatic seed exists, brand/accent roles start from
  `OKLCH(0.58 0.13 40)`.

The representative chromatic swatch is a **hue medoid**, not a numeric hue
average: among colors with `C > 0.04`, it is the existing swatch with the
smallest total circular hue distance to all the others. Palette order breaks a
tie. The implementation is split between
[`src/hooks/usePalette.ts`](src/hooks/usePalette.ts),
[`src/color/suggest.ts`](src/color/suggest.ts), and
[`src/color/audit.ts`](src/color/audit.ts).

## Auto-suggest roles: deciding what each existing color could do

### Reader view

Role suggestions interpret the palette as either light-background or
dark-background, then look for a coherent Background, Text, Primary, Hero,
accents, and neutrals. marianne favors readable text, quiet background colors,
prominent brand colors, and useful tonal variants.

The assistant only considers unlocked colors whose role is No role. Explicit
roles and locked swatches are never changed. Suggestions open as a review: high-
and medium-confidence rows are selected, low-confidence rows require opt-in, and
the author can choose an alternative before applying.

Background, Text, Hero, Primary, Light accent, Dark accent, Light neutral, and
Dark neutral are treated as one-per-palette by the assistant. Accent and Neutral
may be reused. These uniqueness rules constrain automatic batches only; existing
duplicate roles are preserved.

### Developer view

Each valid color is measured once. The scorer derives these normalized features:

- `neutralness = clamp01(1 - C / 0.12)`;
- `relativeChroma = C / maxPaletteChroma`;
- `salience = 0.72 × relativeChroma + 0.28 × lightnessDistance`;
- `lightnessDistance = clamp01(abs(L - meanPaletteL) × 2)`;
- `tonalProximity(target) = clamp01(1 - abs(L - target) / 0.62)`;
- `contrastScore = clamp01((min(contrastRatio, 7) - 1) / 6)`; and
- `hueSeparation` is the nearest circular distance from a Primary/Accent anchor,
  divided by `180`. Hue affinity is `1 - hueSeparation`.

If the palette already has Background roles, their median lightness chooses the
interpretation: `L >= 0.5` is light, otherwise dark. With no explicit
Background, the complete mapping is evaluated in both orientations; higher
quality wins and an exact tie chooses light.

Role scores are weighted sums:

| Role | Score inputs |
| --- | --- |
| Background | `42%` neutralness, `40%` proximity to `L 0.96` (light) or `0.10` (dark), `18%` best readable partner |
| Text | `68%` worst-case contrast across backgrounds, `22%` neutralness, `10%` proximity to `L 0.16` (light UI) or `0.90` (dark UI) |
| Light/Dark neutral | `65%` neutralness, `35%` proximity to `L 0.93` / `0.18` |
| Neutral | `62%` neutralness, `38%` proximity to `L 0.56` |
| Primary | `42%` relative chroma, `28%` middle tone, `30%` contrast |
| Hero | `42%` salience, `28%` relative chroma, `22%` contrast, `8%` middle tone |
| Accent | `38%` relative chroma, `30%` hue separation, `22%` contrast, `10%` middle tone |
| Light/Dark accent | `36%` hue affinity, `34%` proximity to `L 0.82` / `0.34`, `18%` relative chroma, `12%` contrast |

The assignment is staged. Background, Text, Primary, and Accent are selected in
that order so later scores have meaningful anchors. A memoized search then finds
the highest-total-score legal assignment for the remaining swatches while
respecting unique roles. Stable palette order and the fixed role order resolve
ties.

Confidence compares the selected score with the next legal candidate:

- High: score at least `0.75` and margin at least `0.20`.
- Medium: score at least `0.55` and margin at least `0.10`.
- Low: everything else.

The displayed fit is the mean recommended score, plus `0.08` when the mapping
contains a Text color that passes WCAG AA against every Background, minus
`0.08 × low-confidence proportion`, clamped to `0–1`.

The final apply is validated again and is atomic. It changes only `role`; hex,
order, and lock state are preserved. See
[`src/color/roles.ts`](src/color/roles.ts) and
[`src/components/studio/RoleSuggestReview.tsx`](src/components/studio/RoleSuggestReview.tsx).

## Simplify palette: a soft complexity check

### Reader view

Eight colors is an attention threshold, not a palette limit. A palette can grow
past eight without losing health points or receiving a warning simply because it
is large. The always-visible Palette sidebar offers **Simplify palette** only
when marianne also finds one or more safely removable colors that look nearly
the same as colors already worth keeping.

The review groups each proposed removal with the color that would remain. It
shows their perceptual difference and the before/after count. Applying the whole
review is one undoable change. Dismiss hides the current suggestion until the
palette changes.

Simplification never averages colors or invents replacements. Locked colors,
colors with explicit roles, and existing light/dark neutral coverage are always
kept. If a large palette is distinct, or if all of its similar colors are
protected, marianne stays quiet.

### Developer view

`suggestPaletteSimplification` returns `null` unless the palette contains more
than `8` swatches. It uses the same CIEDE2000 `< 6` boundary that the harmony
generator and wanted-color duplicate check use for colors that read as alike.

Every locked or role-assigned swatch is seeded into the retained set first, even
when it occurs late in palette order. The analyzer then visits unlocked,
unassigned swatches in original order:

1. If the color is at least `6 ΔE` from every retained swatch, retain it.
2. Otherwise, propose removing it beside its closest retained color.
3. Keep it instead if removal would lose light- or dark-neutral coverage that
   existed before simplification.
4. Resolve an equal-distance tie by the keeper's original palette order.

The resulting palette filters only those proposed IDs, preserving the identity
and order of everything else. Because the sidebar recomputes the plan from the
current palette, the same suggestion path catches manual additions and edits,
image or harmony appends, generated replacements, and shared palettes. It does
not affect `paletteHealth`.

See [`src/color/simplify.ts`](src/color/simplify.ts) and
[`src/components/studio/PaletteSimplifySuggestion.tsx`](src/components/studio/PaletteSimplifySuggestion.tsx).

## Palette health: the 0–100 summary

### Reader view

Palette health is a summary of categories, not a count of every individual
problem. For example, five failed contrast pairs still count as one failing
Contrast category. The chips below the score say which category needs attention;
the detailed sections explain why.

A warning removes 12 points and a bad result removes 30 points. The score is:

`max(0, 100 - 30 × bad checks - 12 × warning checks)`

### Developer view

The rollup uses these exact rules:

| Check | Good | Warning | Bad |
| --- | --- | --- | --- |
| Contrast | A Background exists and every generated pair reaches AA | No Background role | At least one pair is below AA |
| Color vision | No pair is within `15 ΔE` in any of the three simulations | At least one pair is confusable in the worst simulation | Never |
| Balance | Lightness-gap standard deviation is below `0.05` | It is `0.05` or higher | Never |
| Harmony | No chroma/lightness outlier | One or more outliers | Never |
| Neutrals | Both light and dark neutral coverage exist | Either is missing | Never |

Balance is omitted when the palette has fewer than three swatches. `issueCount`
counts non-good categories. One implementation edge case is worth knowing: once
a Background exists, zero foreground pairs currently counts as good Contrast;
the Readability section still prompts the author to assign a foreground.

The rollup is in [`src/color/health.ts`](src/color/health.ts).

## Smart palette suggestions

This section has two independent paths: fitting a color the author asks for and
finding structural additions the palette appears to need. Every result is only a
preview until Add is chosen.

### Find a matching color

#### Reader view

The requested word or value supplies the **hue**. The current palette supplies
the typical lightness and intensity, so asking for “green” does not simply add a
generic browser green. Choosing a role further shapes the result. Foreground
roles can also require AA contrast against the chosen target background.

marianne declines the request when it is invalid, has no meaningful hue, is
already represented, cannot be displayed without losing the requested hue, or
cannot satisfy the requested contrast.

#### Developer view

The request is parsed and converted to OKLCH. It must have `C >= 0.001`. Reference
swatches are chosen in this order, using only chromatic colors (`C > 0.04`):

1. colors already assigned the requested role;
2. colors with Primary, Hero, or any Accent role; or
3. all chromatic palette colors.

The medians of reference L and C define the visual weight. With no reference,
the fallback is `OKLCH(0.58 0.13 40)`. The requested hue replaces H. Role bounds
then adjust the medians:

- Background/Light neutral: `L >= 0.90`.
- Light accent: `L >= 0.82`.
- Text/Dark neutral: `L <= 0.30`.
- Dark accent: `L <= 0.42`.
- Background, Text, and all Neutral roles: `C <= 0.035`.

If contrast is required, only L is searched in both directions and the smaller
successful lightness change wins. After gamut mapping, the result must retain
`C >= 0.01` and stay within `3°` of the requested hue. A palette swatch below
`6 CIEDE2000 ΔE` makes the result “already present.”

### Structural additions

#### Reader view

marianne may offer four kinds of addition:

- a light or dark neutral anchor when the tonal range lacks one;
- a bridge across a conspicuously large lightness gap;
- an analogous accent on the less crowded side of the palette; and
- a readable foreground when nothing reaches AA against the target background.

The target is the palette's first Background, white when no Background role is
assigned, or a custom background selected in the panel. When both neutral
anchors are absent, the UI also offers one action to add them together.

#### Developer view

Neutral coverage is based on appearance, not role labels:

- light neutral coverage: `C <= 0.04` and `L >= 0.88`;
- dark neutral coverage: `C <= 0.04` and `L <= 0.30`.

Missing anchors use the same tinted-neutral recipe described in the Palette
editor section.

A tonal bridge is considered only between chromatic swatches sorted by L. The
largest gap must be at least `0.22`. The proposal averages the endpoints' L and C
and deliberately keeps the darker endpoint's hue. Its role is inferred from L
and C: a neutral (`C <= 0.04`) becomes Light neutral at `L >= 0.80`, Dark
neutral at `L <= 0.40`, or Neutral between them; a chromatic bridge becomes
Light accent at `L >= 0.80`, Dark accent at `L <= 0.50`, or Accent between them.
The bridge is discarded if adding it creates a new harmony issue or pushes
balance into, or farther into, the warning range (`σ >= 0.05`).

The harmony addition begins at the hue-medoid swatch. In HSL it tries `-30°` and
`+30°`, keeps the side with the greatest nearest-hue separation, and preserves
the anchor's HSL saturation and lightness. An exact existing hex is not proposed.

For contrast, the algorithm checks current colors and the other proposals. If
none reaches the target (AA `4.5:1` in the UI), it takes the current swatch with
the best ratio and searches its OKLCH lightness for the smallest passing change.
The fallback seed for an empty palette is `OKLCH(0.20 0.05 0)`.

Both paths live in [`src/color/suggest.ts`](src/color/suggest.ts); neutral
coverage and medoid selection live in
[`src/color/audit.ts`](src/color/audit.ts).

## Harmony check

### Reader view

Harmony check asks whether one color is much more intense, brighter, or darker
than the main group. It is intentionally conservative: it ignores quiet neutrals
and uses the palette's median character, so one extreme swatch cannot drag the
expected value toward itself.

A saturation fix changes only chroma. A lightness fix changes only lightness.
Hue is preserved in both cases, subject to display-gamut mapping. Locked colors
can be diagnosed but cannot be applied by either Apply fix or Apply all.

### Developer view

Only colors with `C > 0.04` participate. Fewer than three chromatic colors
produce no issues.

For chroma, the analyzer computes the median and median absolute deviation
(MAD). A color is an outlier above:

`medianC + max(0.045, 2.5 × chromaMAD)`

Its fix sets C to `medianC`.

Saturation outliers are excluded from the lightness pass and cannot receive two
fixes. The remaining lightness candidates must have
`C >= max(0.04, 0.70 × medianC)`, which avoids comparing a muted bridge with vivid
accents. At least four candidates are required. A color is a lightness outlier
when its distance from median L is greater than:

`max(0.05, 2.75 × lightnessMAD)`

Its fix sets L to the median. Dismissing a suggestion is UI-local and it returns
if the color changes. See [`src/color/audit.ts`](src/color/audit.ts) and
[`src/components/studio/HarmonyCheckPanel.tsx`](src/components/studio/HarmonyCheckPanel.tsx).

## Readability (contrast)

### Reader view

Readability does not test every swatch against every other swatch. It tests the
combinations the role labels say can actually occur: every Text, Primary, Hero,
Accent, Light accent, and Dark accent against every Background.

The grades are:

- `7:1` or more: AAA for normal text;
- `4.5:1` or more: AA for normal text;
- `3:1` or more: AA for large text only; and
- below `3:1`: fail.

marianne treats “large text only” as a problem because the palette should remain
safe for ordinary text and UI use. A proposed fix preserves hue and chroma as
far as gamut mapping permits and changes only lightness. Locked foregrounds are
reported but cannot be fixed.

### Developer view

`rolePairs` builds the Cartesian product of foreground roles and backgrounds,
computes Culori's WCAG 2.x ratio, and sorts weakest-first. The fix searches both
lighter and darker OKLCH directions. It first verifies that the `L = 0` or
`L = 1` extreme can pass, then performs 24 binary-search iterations in each
viable direction. The passing candidate with the smallest absolute `ΔL` wins.

The implementation is in [`src/color/contrast.ts`](src/color/contrast.ts).

## Color-vision safety

### Reader view

The three tabs simulate:

- deuteranopia, a green-sensitive cone deficiency;
- protanopia, a red-sensitive cone deficiency; and
- tritanopia, a blue-sensitive cone deficiency.

Every swatch is shown through the selected full-severity simulation. marianne
then compares every pair and flags colors that would be hard to tell apart. This
section diagnoses rather than recolors because an appropriate replacement
depends heavily on how the colors are used; contrast, labels, icons, and patterns
may also carry the distinction.

### Developer view

Culori's protan, deutan, and tritan filters run at severity `1`. The analyzer
computes CIEDE2000 distance between every unordered pair of simulated colors,
keeps distances `<= 15` in both the panel and health score, and sorts closest
first. The lower-level helper defaults to `10`, but both product call sites pass
the more cautious UI threshold of `15` explicitly.

See [`src/color/cvd.ts`](src/color/cvd.ts).

## Perceptual balance

### Reader view

Perceptual balance measures whether the palette's colorful swatches form regular
steps from dark to light. Quiet light and dark neutral anchors are ignored in the
score because their job is to sit outside that chromatic ramp.

The labels mean:

- `σ < 0.02`: even;
- `0.02 <= σ < 0.05`: slightly uneven; and
- `σ >= 0.05`: uneven.

The preview itself includes every color, sorted by lightness. Applying it spreads
the swatches evenly between the palette's current darkest and lightest values.
Hue and chroma are kept where the display gamut allows. Locked swatches retain
their exact color, although they still occupy a position in the reordered ramp.

### Developer view

`analyzeBalance` converts and sorts all valid swatches by OKLCH L. For the
unevenness number it filters to `C > 0.04`, computes adjacent L gaps, then takes
their population standard deviation.

`evenRamp` uses the darkest and lightest values from **all** sorted swatches. For
index `i` among `n` colors, the target is:

`L = minL + (maxL - minL) × i / (n - 1)`

The returned palette is in lightness order, so Apply can also change manual
swatch order. Locks skip recoloring, not sorting or slot allocation. See
[`src/color/balance.ts`](src/color/balance.ts).

## From an image

### Reader view

The image stays in the browser. marianne downsizes it for speed, groups similar
pixels into dominant color regions, and offers palettes of four through eight
colors. Large color regions appear first. Very similar results are merged, so an
option can contain fewer colors than its label.

**Use** replaces the current palette; **Append** keeps it and adds the extracted
colors. Extracted colors begin with No role and are ready for manual or automatic
role assignment.

### Developer view

The longest image edge is downscaled to at most `128 px`, then the component
passes its RGBA buffer to the DOM-free extractor. By default every pixel with
alpha at least `125/255` is sampled.

Extraction uses median cut:

1. Begin with one box containing every retained RGB pixel.
2. Choose the box whose widest RGB channel has the largest range.
3. Choose that box's widest channel, preferring R, then G, then B on ties.
4. Sort on that channel and split at the median.
5. Repeat until the requested box count is reached or no box can split.
6. Replace each box with its mean RGB color and order boxes by pixel population.
7. Walk that order and drop a color when it is within `4 CIEDE2000 ΔE` of one
   already kept.

The UI plumbing is in
[`src/components/studio/ImagePalettePanel.tsx`](src/components/studio/ImagePalettePanel.tsx),
and the algorithm is in [`src/color/extract.ts`](src/color/extract.ts).

## Generate a palette

### Reader view

**Generate random palette** is the one-click path. It replaces the current
palette with five colors: quiet light and dark anchors plus three chromatic
colors from a randomly selected classic harmony. The replacement is undoable,
and the chosen base remains in the Base colors control for manual refinement.
The generated swatches begin with No role. Marianne checks candidates before
showing them and only returns an automatic palette with health of at least
76/100 and no bad checks. The confirmation reports the score so that quality is visible at the
moment of generation.

**Generate palette with roles** starts from the same five-color recipe, then
asks Marianne to interpret the result as a light or dark interface and apply
its best semantic role for every color. Background and text anchors are always
included, while the chromatic colors receive roles such as Primary, Hero, or
Accent according to their fit. These are suggestions applied for a useful
starting point, not permanent labels: every role remains editable. Color and
role generation is committed together, so one Undo restores the prior palette.

The generator keeps a base color's lightness and intensity while moving around
its hue wheel. This produces familiar complementary, analogous, triadic,
tetradic, and split-complementary relationships. Monochromatic generation keeps
the hue and intensity and varies lightness instead.

More than one base can be supplied. Their results are woven together so each
base contributes in turn, and near-duplicates are removed. Generated swatches
begin with No role. **Use** replaces the palette; **Append** adds to it.

### Developer view

`randomHarmonyPalette` draws four independent random values. They select a hue
from `0–360°`, base L from `0.52–0.68`, base C from `0.13–0.21`, and one of three
equally likely schemes:

- Analogous: `-30°, 0°, +30°`;
- Triadic: `0°, 120°, 240°`; or
- Split complementary: `0°, 150°, 210°`.

It prepends a light anchor at `L 0.965, C 0.012, H base + 20°` and a dark anchor
at `L 0.20, C 0.02, H base`, yielding exactly five gamut-clamped colors. The
function accepts an injected random-number source so its behavior is
deterministic in tests.

`generateAutomaticPalette` is the health-gated module used by both automatic
buttons. It converts each candidate's five hex values into unlocked swatches,
optionally passes that temporary palette to `suggestRoles`, and applies every
recommendation through `applyRoleAssignments`. It then measures the finished
result with `paletteHealth`, because adding roles activates contrast checks that
an unassigned palette does not have.

Candidates below `76`, or with any analyzer marked bad, are discarded. This is
the first score tier above 70 in the current rubric and prevents a single bad
contrast check from slipping through as a 70. Generation is capped at 24 random
attempts and then uses a deterministic fallback that is covered by the same
health-floor test, preventing a pathological random source from hanging the UI
or returning a known-weak result. The normal palette commit receives one
complete palette, so color generation and role assignment remain one undoable
operation.

All wheel rotations are performed in OKLCH:

| Set | Hue offsets from each base |
| --- | --- |
| Complementary | `0°, 180°` |
| Analogous | `-30°, 0°, +30°` |
| Triadic | `0°, 120°, 240°` |
| Tetradic | `0°, 90°, 180°, 270°` |
| Split complementary | `0°, 150°, 210°` |
| Monochromatic | No rotation; five L values at `1/6, 2/6, 3/6, 4/6, 5/6` |

With multiple bases, each same-type list is interleaved round-robin by index. A
candidate is dropped when its CIEDE2000 distance from any already-kept color is
less than `6`. Every conversion back to hex is gamut-clamped.

The first base initializes from the current palette's first swatch, or
`#3a7bd5` for an empty palette. Additional bases initialize as `#e5484d`; these
are interface defaults, not algorithm inputs. See
[`src/color/harmony.ts`](src/color/harmony.ts) and
[`src/components/studio/HarmonyPanel.tsx`](src/components/studio/HarmonyPanel.tsx).

## Landing-page paints

The landing page does not generate the named Colors Trap palettes. They are
curated constants in [`src/color/samples.ts`](src/color/samples.ts), including
the roles encoded in each sample's share link.

The optional painting interaction has one color calculation: where a new paint
stroke overlaps a different existing color, the two are mixed halfway in OKLCH.
L and C are linearly interpolated; H travels along the shorter arc of the hue
wheel; the result is gamut-clamped. Repainting a pixel during the same stroke
does not repeatedly remix it, and laying down the identical RGB color does not
mix it. See [`src/color/paint.ts`](src/color/paint.ts) and
[`src/components/ui/PaintCanvas.tsx`](src/components/ui/PaintCanvas.tsx).

The application's light/dark theme and decorative canvas colors are separate
from palette decisions. They style the interface but never enter these
calculations.

## Persistence and reproducibility

Palette operations are deterministic for the same ordered swatches, roles, and
locks. At startup marianne prefers a palette in the URL, then a saved local
palette, then the built-in default: Text `#1b1b1f`, Background `#ffffff`, Primary
`#3a7bd5`, Accent `#e5484d`, and Neutral `#8a8f98`.

Every accepted edit is stored locally and reflected in the URL after a `250 ms`
debounce. The share encoding stores each hex color, optional role code, and
optional lock marker in order. It does not store analysis results: every section
recomputes them from the decoded palette. An explicitly empty palette is encoded
as `p=empty`, allowing Clear to survive reloads and shared links rather than
being mistaken for absent state and replaced by the defaults.

See [`src/color/encode.ts`](src/color/encode.ts) for the format and
[`src/hooks/usePalette.ts`](src/hooks/usePalette.ts) for state, history, and
persistence.
