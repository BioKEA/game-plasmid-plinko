// Lightweight engagement tracker for the biodiversity CTA.
// Counts completed runs and remembers the player's dismissal preference.

const RUNS_KEY = 'plasmid-plinko-runs-completed'
const CTA_STATE_KEY = 'plasmid-plinko-cta-state'
const SESSION_SHOWN_KEY = 'plasmid-plinko-cta-shown-session'

// First show after this many completed runs.
const INITIAL_THRESHOLD = 3
// After "maybe later", re-show after this many additional runs.
const RECURRING_THRESHOLD = 3

interface CTAState {
  state: 'never' | 'pending'
  lastShownAtRuns?: number
}

function readState(): CTAState {
  try {
    const raw = localStorage.getItem(CTA_STATE_KEY)
    if (!raw) return { state: 'pending' }
    const parsed = JSON.parse(raw)
    if (parsed && (parsed.state === 'never' || parsed.state === 'pending')) return parsed
  } catch { /* ignore */ }
  return { state: 'pending' }
}

function writeState(s: CTAState) {
  localStorage.setItem(CTA_STATE_KEY, JSON.stringify(s))
}

export function getRunsCompleted(): number {
  return parseInt(localStorage.getItem(RUNS_KEY) ?? '0', 10) || 0
}

export function incrementRunsCompleted(): number {
  const next = getRunsCompleted() + 1
  localStorage.setItem(RUNS_KEY, String(next))
  return next
}

export function shouldShowBiodiversityCTA(): boolean {
  if (typeof window === 'undefined') return false
  // Already shown this session — wait for next reload.
  if (sessionStorage.getItem(SESSION_SHOWN_KEY)) return false
  const s = readState()
  if (s.state === 'never') return false
  const runs = getRunsCompleted()
  const threshold = s.lastShownAtRuns !== undefined
    ? s.lastShownAtRuns + RECURRING_THRESHOLD
    : INITIAL_THRESHOLD
  return runs >= threshold
}

export function markCTAShownThisSession() {
  sessionStorage.setItem(SESSION_SHOWN_KEY, '1')
  // Treat the show itself as a "later" — the next prompt waits 3 more runs.
  writeState({ state: 'pending', lastShownAtRuns: getRunsCompleted() })
}

export function dismissCTAForever() {
  writeState({ state: 'never' })
  sessionStorage.setItem(SESSION_SHOWN_KEY, '1')
}
