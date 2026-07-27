import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Button } from '../ui/Button'
import { BalanceIcon, ContrastIcon, EyeIcon, SwatchesIcon } from '../ui/icons'
import { SAMPLES } from '../../color/samples'
import { ArtistPaletteBoard } from '../ui/ArtistPaletteBoard'
import { PaintCanvas } from '../ui/PaintCanvas'
import { ThemeToggle } from '../ui/ThemeToggle'
import type { ThemeToggleProps } from '../ui/ThemeToggle'

// The hero board is her Rainbow of Dreams — every color in one swirl.
const HERO = SAMPLES[0]

const FEATURES = [
  {
    icon: <ContrastIcon width={20} height={20} />,
    title: 'WCAG contrast',
    body: 'Flag color pairs that fail AA/AAA and auto-nudge lightness until they pass.',
    swatch: ['#1b1b1f', '#ffffff'],
  },
  {
    icon: <EyeIcon width={20} height={20} />,
    title: 'Color-vision safe',
    body: 'Simulate protanopia, deuteranopia and tritanopia — catch colors that collapse together.',
    swatch: ['#e5484d', '#2f9e6b'],
  },
  {
    icon: <BalanceIcon width={20} height={20} />,
    title: 'Perceptual balance',
    body: 'Even out lightness and chroma spacing in OKLCH for clean, uniform ramps.',
    swatch: ['#253b4a', '#bd5736', '#e3b95d'],
  },
  {
    icon: <SwatchesIcon width={20} height={20} />,
    title: 'Harmony generator',
    body: 'Grow a full palette from one base color — complementary, triadic, analogous and more.',
    swatch: ['#3a7bd5', '#d53a7b', '#7bd53a'],
  },
]

export function Landing({ theme, onThemeToggle }: ThemeToggleProps) {
  const [activeSample, setActiveSample] = useState(HERO)
  const [selectedPaintId, setSelectedPaintId] = useState('')
  const paints = useMemo(
    () => activeSample.swatch.map((color, index) => ({ id: `paint-${index}`, color })),
    [activeSample],
  )
  const selectedPaint = paints.find((paint) => paint.id === selectedPaintId)

  const loadPaints = (sample: (typeof SAMPLES)[number]) => {
    setActiveSample(sample)
    setSelectedPaintId('')
  }

  return (
    <div className="relative isolate min-h-screen text-fg">
      <PaintCanvas color={selectedPaint?.color ?? null} theme={theme} />
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">marianne</span>
        <div className="flex items-center gap-2">
          <a href="#/app">
            <Button variant="primary">Open studio</Button>
          </a>
          <ThemeToggle theme={theme} onThemeToggle={onThemeToggle} />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-6">
        <section className="grid items-center gap-5 py-10 sm:gap-8 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)] lg:gap-4 lg:py-20">
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted"
            >
              {activeSample.name}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl"
            >
              Fix and craft accessible color palettes
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 }}
              className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted lg:mx-0"
            >
              marianne checks contrast, color-vision safety and perceptual balance
              — then suggests the exact fixes. All in your browser, nothing leaves
              the page.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.18 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <a href="#/app">
                <Button variant="primary" className="px-6 py-3 text-base">
                  Open the studio
                </Button>
              </a>
              <a href="#colors-trap">
                <Button variant="surface" className="px-6 py-3 text-base">
                  Choose paints
                </Button>
              </a>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, rotate: 2 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 250, damping: 24 }}
            className="order-1 -mx-4 lg:order-2 lg:-mr-16 lg:ml-0"
          >
            <ArtistPaletteBoard
              paints={paints}
              selectedPaintId={selectedPaint?.id}
              onPaintSelect={(paint) => setSelectedPaintId(paint.id)}
              className="h-[270px] w-full sm:h-[350px] lg:h-[430px]"
            />
          </motion.div>
        </section>

        {/* Colors Trap — sample palettes named for Miss Goldenweek's paint. */}
        <section id="colors-trap" className="scroll-mt-4 pb-16">
          <p className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-muted">
            Colors Trap
          </p>
          <p className="mx-auto mb-6 max-w-md text-balance text-center text-sm text-muted">
            Load a set of paints onto the board, then choose a color and paint.
          </p>
          <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pt-3 pb-2 [mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]">
            {SAMPLES.map((s) => (
              <Button
                key={s.name}
                type="button"
                variant="card"
                onClick={() => loadPaints(s)}
                aria-pressed={activeSample.name === s.name}
                title={s.effect}
                className={`group w-56 shrink-0 snap-start rounded-2xl p-3 text-left ${activeSample.name === s.name ? '!border-accent ring-1 ring-accent/50' : ''}`}
              >
                <div className="mb-2 flex overflow-hidden rounded-lg">
                  {s.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-8 flex-1"
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <div className="text-sm font-semibold text-fg">{s.name}</div>
                <div className="text-xs text-muted">{s.origin}</div>
              </Button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-2xl border border-line/40 bg-surface p-6 shadow-lg shadow-[#7d684f]/15"
            >
              <div className="mb-4 flex overflow-hidden rounded-lg">
                {f.swatch.map((c) => (
                  <span
                    key={c}
                    className="h-8 flex-1"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-accent">
                {f.icon}
                <h2 className="text-lg font-semibold text-fg">{f.title}</h2>
              </div>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
            </motion.div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-line/60 py-6 text-center text-sm text-muted">
        <div>marianne · client-side color palette optimizer</div>
        <div className="mt-1 text-xs">
          named for Miss Goldenweek — Marianne — who painted colors that moved
          people
        </div>
      </footer>
    </div>
  )
}
