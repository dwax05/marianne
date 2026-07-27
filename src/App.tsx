import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Landing } from './components/landing/Landing'
import { Studio } from './components/studio/Studio'
import { PaintCanvasSessionProvider } from './components/ui/PaintCanvas'
import { applyTheme } from './theme'
import type { Theme } from './theme'

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
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    applyTheme(nextTheme)
    setTheme(nextTheme)
  }

  return (
    <PaintCanvasSessionProvider>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
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
