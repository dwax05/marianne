import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { usePalette } from '../../hooks/usePalette'
import { encodePalette } from '../../color/encode'
import { paletteHealth } from '../../color/health'
import { SwatchGrid } from './SwatchGrid'
import { ContrastPanel } from './ContrastPanel'
import { CvdPanel } from './CvdPanel'
import { BalancePanel } from './BalancePanel'
import { HarmonyPanel } from './HarmonyPanel'
import { ImagePalettePanel } from './ImagePalettePanel'
import { SuggestPanel } from './SuggestPanel'
import { HarmonyCheckPanel } from './HarmonyCheckPanel'
import { Button } from '../ui/Button'
import { SegmentedControl } from '../ui/SegmentedControl'
import { ThemeToggle } from '../ui/ThemeToggle'
import type { ThemeToggleProps } from '../ui/ThemeToggle'
import {
  BalanceIcon,
  ContrastIcon,
  EyeIcon,
  ImageIcon,
  LinkIcon,
  SparkleIcon,
  SwatchesIcon,
  UndoIcon,
} from '../ui/icons'

type Mode = 'analyze' | 'generate'

export function Studio({ theme, onThemeToggle }: ThemeToggleProps) {
  const pal = usePalette()
  const [mode, setMode] = useState<Mode>('analyze')
  const [copied, setCopied] = useState('')
  const health = useMemo(() => paletteHealth(pal.palette), [pal.palette])

  const flash = (msg: string) => {
    setCopied(msg)
    window.setTimeout(() => setCopied(''), 1500)
  }
  const copyShare = async () => {
    await navigator.clipboard.writeText(pal.shareUrl())
    flash('Share link copied')
  }

  return (
    <div className="relative isolate min-h-screen overflow-x-clip text-fg">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-line/40 bg-surface/70 px-5 py-3 backdrop-blur">
        <a href="#/" className="text-lg font-semibold tracking-tight">
          marianne
        </a>
        <ModeSwitch mode={mode} onChange={setMode} />
        <div className="ml-auto flex items-center gap-2">
          <AnimatePresence>
            {copied && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-good"
              >
                {copied}
              </motion.span>
            )}
          </AnimatePresence>
          <Button
            variant="ghost"
            className="h-8"
            onClick={pal.undo}
            disabled={!pal.canUndo}
          >
            <UndoIcon /> Undo
          </Button>
          <Button variant="surface" className="h-8" onClick={copyShare}>
            <LinkIcon /> Share
          </Button>
          <ThemeToggle theme={theme} onThemeToggle={onThemeToggle} />
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <SwatchGrid
            palette={pal.palette}
            onUpdate={pal.updateSwatch}
            onRole={pal.setRole}
            onToggleLock={pal.toggleLock}
            onReorder={pal.reorderSwatches}
            onRemove={pal.removeSwatch}
            onAdd={() => pal.addSwatch()}
            onSetRoles={pal.setRoles}
          />
        </aside>

        <main className="space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {mode === 'analyze' ? (
                <>
                  <HealthHeader health={health} />
                  <Section
                    icon={<SparkleIcon />}
                    title="Smart palette suggestions"
                    blurb="Personalized additions that fill structural gaps in your palette, including missing light and dark neutral anchors."
                  >
                    <SuggestPanel
                      palette={pal.palette}
                      onAdd={pal.addSwatch}
                      onAddMany={pal.addSwatches}
                    />
                  </Section>
                  <Section
                    icon={<BalanceIcon />}
                    title="Harmony check"
                    blurb="Find colors whose saturation or lightness feels out of step, then preview and apply a palette-aware correction."
                  >
                    <HarmonyCheckPanel
                      palette={pal.palette}
                      onApply={pal.commit}
                    />
                  </Section>
                  <Section
                    icon={<ContrastIcon />}
                    title="Readability (contrast)"
                    blurb="Can people read your text and UI colors on your background? WCAG AA needs 4.5:1 for normal text."
                  >
                    <ContrastPanel
                      palette={pal.palette}
                      onUpdate={pal.updateSwatch}
                    />
                  </Section>
                  <Section
                    icon={<EyeIcon />}
                    title="Color-vision safety"
                    blurb="Colors that look distinct to you can merge for colorblind viewers. This flags pairs that collapse together."
                  >
                    <CvdPanel palette={pal.palette} />
                  </Section>
                  <Section
                    icon={<BalanceIcon />}
                    title="Perceptual balance"
                    blurb="Evenly spaced lightness makes a palette feel intentional. Preview an even OKLCH ramp and apply it if you like."
                  >
                    <BalancePanel palette={pal.palette} onApply={pal.commit} />
                  </Section>
                </>
              ) : (
                <>
                  <Section
                    icon={<ImageIcon />}
                    title="From an image"
                    blurb="Drop in a photo or artwork and pull its dominant colors into a palette. Replace your palette or append the colors."
                  >
                    <ImagePalettePanel
                      onReplace={pal.commit}
                      onAppend={(p) => pal.commit([...pal.palette, ...p])}
                    />
                  </Section>
                  <Section
                    icon={<SwatchesIcon />}
                    title="Generate a palette"
                    blurb="Pick a base color and grow a harmonious set. Replace your palette or append the colors."
                  >
                    <HarmonyPanel
                      palette={pal.palette}
                      onReplace={pal.commit}
                      onAppend={(p) => pal.commit([...pal.palette, ...p])}
                    />
                  </Section>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="text-center font-mono text-xs text-muted/60">
            {encodePalette(pal.palette)}
          </p>
        </main>
      </div>
    </div>
  )
}

function HealthHeader({ health }: { health: ReturnType<typeof paletteHealth> }) {
  const tone =
    health.score >= 85
      ? 'text-good'
      : health.score >= 60
        ? 'text-warn'
        : 'text-bad'
  return (
    <div className="rounded-2xl border border-line/40 bg-surface p-4 shadow-lg shadow-[color:rgb(var(--card-shadow)_/_0.15)]">
      <div className="flex items-center gap-4">
        <div className={`text-4xl font-bold tabular-nums ${tone}`}>
          {health.score}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-muted">
            Palette health
          </div>
          <div className="text-sm text-fg">
            {health.issueCount === 0
              ? 'No issues found — looking good.'
              : `${health.issueCount} ${health.issueCount === 1 ? 'thing' : 'things'} to look at.`}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {health.checks.map((c) => (
          <span
            key={c.key}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted"
            title={c.summary}
          >
            <Dot status={c.status} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Dot({ status }: { status: 'good' | 'warn' | 'bad' }) {
  const color =
    status === 'good' ? 'bg-good' : status === 'warn' ? 'bg-warn' : 'bg-bad'
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
}

function Section({
  icon,
  title,
  blurb,
  children,
}: {
  icon: React.ReactNode
  title: string
  blurb: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-line/40 bg-surface p-4 shadow-lg shadow-[color:rgb(var(--card-shadow)_/_0.15)]">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-muted">{blurb}</p>
      {children}
    </section>
  )
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: Mode
  onChange: (m: Mode) => void
}) {
  return (
    <SegmentedControl
      value={mode}
      onChange={onChange}
      layoutId="mode-pill"
      options={[
        { value: 'analyze', label: 'Analyze' },
        { value: 'generate', label: 'Generate' },
      ]}
    />
  )
}
