import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Landing } from './components/landing/Landing'
import { Studio } from './components/studio/Studio'
import {
  CanvasBackdrop,
  PaintCanvasSessionProvider,
} from './components/ui/PaintCanvas'
import { applyTheme, themeTransitionRadius } from './theme'
import type { Theme, ThemeTransitionOrigin } from './theme'

/** Minimal hash router: '#/app...' => studio, everything else => landing. */
function useRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

function App({ initialTheme = 'light' }: { initialTheme?: Theme }) {
  const hash = useRoute()
  const [theme, setTheme] = useState(initialTheme)
  const view = hash.startsWith('#/app') ? 'app' : 'landing'
  // Tracks the in-flight theme transition so overlapping toggles don't fight:
  // an older transition's `finished` handler must not strip `theme-transition`
  // (which disables the default cross-fade) off a newer, still-running one.
  const activeTransition = useRef<ViewTransition | null>(null)
  const transitionSeq = useRef(0)
  const toggleTheme = (origin: ThemeTransitionOrigin) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    const updateTheme = () => {
      applyTheme(nextTheme)
      setTheme(nextTheme)
    }

    if (
      !document.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      updateTheme()
      return
    }

    // Finish any in-flight transition instantly before capturing a new one, so
    // we never stack two animations (which flashes on rapid toggling).
    activeTransition.current?.skipTransition()

    const root = document.documentElement
    root.classList.add('theme-transition')
    const seq = ++transitionSeq.current

    const transition = document.startViewTransition(() => {
      flushSync(updateTheme)
    })
    activeTransition.current = transition

    void transition.ready
      .then(() => {
        const radius = themeTransitionRadius(
          origin,
          window.innerWidth,
          window.innerHeight,
        )

        root.animate(
          {
            clipPath: [
              `circle(0px at ${origin.x}px ${origin.y}px)`,
              `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
            ],
          },
          {
            duration: 850,
            easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
      .catch(() => {
        // A skipped transition still leaves the newly selected theme applied.
      })

    void transition.finished.finally(() => {
      // Only the latest transition owns the class + ref; a stale one bails out.
      if (transitionSeq.current !== seq) return
      root.classList.remove('theme-transition')
      activeTransition.current = null
    })
  }

  return (
    <PaintCanvasSessionProvider>
      <CanvasBackdrop theme={theme} />
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative z-10"
        >
          {view === 'app' ? (
            <Studio theme={theme} onThemeToggle={toggleTheme} />
          ) : (
            <Landing theme={theme} onThemeToggle={toggleTheme} />
          )}
        </motion.div>
      </AnimatePresence>
    </PaintCanvasSessionProvider>
  )
}

export default App
