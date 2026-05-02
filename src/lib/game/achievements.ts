import type { CharacterId } from './characters'

export type AchievementId =
  | 'first-clear'
  | 'daily-win'
  | 'campaign-win'
  | 'chain-25'
  | 'jackpot'
  | 'all-bosses'
  | 'all-classes'
  | 'genome-hunter'
  | 'ironman'
  | 'perfect-daily'

export interface AchievementSpec {
  id: AchievementId
  name: string
  description: string
  emoji: string
  unlocksTheme?: ThemeId
}

export type ThemeId = 'synthwave' | 'lab-clean' | 'bloom' | 'promethion'

export interface ThemeSpec {
  id: ThemeId
  name: string
  description: string
  bg: string
  accent: string
  primary: string
  preview: string[]
}

export const ACHIEVEMENTS: Record<AchievementId, AchievementSpec> = {
  'first-clear': {
    id: 'first-clear',
    name: 'First Sequence',
    description: 'Clear your first board.',
    emoji: '🧫',
  },
  'daily-win': {
    id: 'daily-win',
    name: 'Daily Done',
    description: 'Win a Daily Challenge.',
    emoji: '📅',
    unlocksTheme: 'bloom',
  },
  'campaign-win': {
    id: 'campaign-win',
    name: 'Genome Sequenced',
    description: 'Beat the Campaign boss.',
    emoji: '🏆',
    unlocksTheme: 'lab-clean',
  },
  'chain-25': {
    id: 'chain-25',
    name: 'Cascade',
    description: 'Hit a 25-peg chain in one shot.',
    emoji: '🔥',
  },
  'jackpot': {
    id: 'jackpot',
    name: 'Jackpot Cycle',
    description: 'Trigger the +5000 jackpot bonus.',
    emoji: '💎',
  },
  'all-bosses': {
    id: 'all-bosses',
    name: 'Boss Buster',
    description: 'Defeat the Promethion and the Centrifuge.',
    emoji: '👑',
    unlocksTheme: 'promethion',
  },
  'all-classes': {
    id: 'all-classes',
    name: 'Quartet',
    description: 'Win a run with all four characters.',
    emoji: '🎭',
  },
  'genome-hunter': {
    id: 'genome-hunter',
    name: 'Genome Hunter',
    description: 'Clear 50 gene pegs across all runs.',
    emoji: '🎯',
  },
  'ironman': {
    id: 'ironman',
    name: 'Ironman',
    description: 'Win a daily as the Surgeon.',
    emoji: '🛡️',
  },
  'perfect-daily': {
    id: 'perfect-daily',
    name: 'Pristine',
    description: 'Win every Daily ante with 2+ balls remaining.',
    emoji: '✨',
  },
}

export const ACHIEVEMENT_LIST: AchievementSpec[] = Object.values(ACHIEVEMENTS)

export const THEMES: Record<ThemeId, ThemeSpec> = {
  synthwave: {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'The default neon biotech vibe.',
    bg: '#0a0420',
    accent: '#e879f9',
    primary: '#22d3ee',
    preview: ['#0a0420', '#e879f9', '#22d3ee'],
  },
  bloom: {
    id: 'bloom',
    name: 'Bloom',
    description: 'Brighter pinks. Beat a Daily to unlock.',
    bg: '#1a0420',
    accent: '#f472b6',
    primary: '#fde047',
    preview: ['#1a0420', '#f472b6', '#fde047'],
  },
  'lab-clean': {
    id: 'lab-clean',
    name: 'Lab Clean',
    description: 'Frosted whites. Beat the Campaign to unlock.',
    bg: '#0f1729',
    accent: '#06b6d4',
    primary: '#a78bfa',
    preview: ['#0f1729', '#06b6d4', '#a78bfa'],
  },
  promethion: {
    id: 'promethion',
    name: 'Promethion',
    description: 'Cyan-dominant. Beat both bosses to unlock.',
    bg: '#02101a',
    accent: '#0ea5e9',
    primary: '#10b981',
    preview: ['#02101a', '#0ea5e9', '#10b981'],
  },
}

export const THEME_LIST: ThemeSpec[] = Object.values(THEMES)

const ACHIEVEMENTS_KEY = 'plasmid-plinko-achievements'
const THEME_KEY = 'plasmid-plinko-theme'
const STATS_KEY = 'plasmid-plinko-stats'
const CLASSES_WON_KEY = 'plasmid-plinko-classes-won'

export interface PlayerStats {
  genePegsCleared: number
  bossesBeaten: { promethion: boolean; centrifuge: boolean }
}

export function loadAchievements(): Set<AchievementId> {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

export function saveAchievements(s: Set<AchievementId>) {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...s]))
}

export function loadTheme(): ThemeId {
  const t = localStorage.getItem(THEME_KEY) as ThemeId | null
  if (t && THEMES[t]) return t
  return 'synthwave'
}

export function saveTheme(t: ThemeId) {
  localStorage.setItem(THEME_KEY, t)
}

export function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (!raw) return { genePegsCleared: 0, bossesBeaten: { promethion: false, centrifuge: false } }
    return JSON.parse(raw)
  } catch {
    return { genePegsCleared: 0, bossesBeaten: { promethion: false, centrifuge: false } }
  }
}

export function saveStats(s: PlayerStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s))
}

export function loadClassesWon(): Set<CharacterId> {
  try {
    const raw = localStorage.getItem(CLASSES_WON_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

export function saveClassesWon(s: Set<CharacterId>) {
  localStorage.setItem(CLASSES_WON_KEY, JSON.stringify([...s]))
}

export function isThemeUnlocked(theme: ThemeId, achievements: Set<AchievementId>): boolean {
  if (theme === 'synthwave') return true
  for (const a of ACHIEVEMENT_LIST) {
    if (a.unlocksTheme === theme && achievements.has(a.id)) return true
  }
  return false
}
