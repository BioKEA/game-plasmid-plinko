import { GAME_ID, leaderboard } from '@/lib/leaderboard-client'
import type { CharacterId } from './characters'

export interface LeaderboardRow {
  id: string
  handle: string
  score: number
  antes_cleared: number
  character_id: string | null
  created_at: string
}

const HANDLE_KEY = 'plasmid-plinko-handle'
const DAILY_SUBMIT_KEY = 'plasmid-plinko-daily-submitted'

export function loadHandle(): string | null {
  return localStorage.getItem(HANDLE_KEY)
}

export function saveHandle(handle: string) {
  const clean = sanitizeHandle(handle)
  if (!clean) return
  localStorage.setItem(HANDLE_KEY, clean)
}

export function sanitizeHandle(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 16)
}

export function hasSubmittedToday(day: string): boolean {
  const v = localStorage.getItem(DAILY_SUBMIT_KEY)
  if (!v) return false
  try {
    const data = JSON.parse(v)
    return data.day === day
  } catch {
    return false
  }
}

export function markSubmittedToday(day: string, score: number) {
  localStorage.setItem(DAILY_SUBMIT_KEY, JSON.stringify({ day, score }))
}

export async function submitDailyScore(args: {
  day: string
  handle: string
  score: number
  antesCleared: number
  characterId: CharacterId | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const handle = sanitizeHandle(args.handle)
  if (!handle) return { ok: false, error: 'Handle required' }

  const result = await leaderboard.submitScore({
    gameId: GAME_ID,
    mode: 'daily',
    seed: args.day,
    score: args.score,
    playerHandle: handle,
    metadata: {
      antesCleared: args.antesCleared,
      characterId: args.characterId,
    },
  })

  if (!result.ok) {
    const msg =
      result.reason === 'rate_limited' ? 'Slow down — too many submissions.' :
      result.reason === 'invalid' ? 'Score rejected.' :
      result.reason === 'unconfigured' ? 'Leaderboard offline.' :
      'Network error.'
    return { ok: false, error: msg }
  }
  markSubmittedToday(args.day, args.score)
  return { ok: true }
}

export async function fetchTopScores(day: string, limit = 10): Promise<LeaderboardRow[]> {
  const entries = await leaderboard.getDailyLeaderboard(GAME_ID, day, limit)
  return entries.map(toRow)
}

export type LeaderboardWindow = 'today' | 'week' | 'all'

// Inclusive start of the rolling 7-day window ending today. Lex compare
// on YYYY-MM-DD seeds is chronological, so this is what we hand to the
// seedFrom range filter.
export function weekStart(today: string): string {
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 6)
  return d.toISOString().slice(0, 10)
}

// Collapses cross-day rows to one per handle (their best). Used for the
// week + all-time windows so a single player who's posted every day
// doesn't take up the whole top 10.
function bestByHandle(rows: LeaderboardRow[]): LeaderboardRow[] {
  const best = new Map<string, LeaderboardRow>()
  for (const r of rows) {
    const existing = best.get(r.handle)
    if (!existing || r.score > existing.score) best.set(r.handle, r)
  }
  return Array.from(best.values()).sort((a, b) => b.score - a.score)
}

export async function fetchTop(
  window: LeaderboardWindow,
  today: string,
  limit = 10,
): Promise<LeaderboardRow[]> {
  // Pull a generous slice (limit * 8) so dedupe leaves enough rows for
  // a top N even when a few handles dominate. Today dedupes too — a
  // single client could post twice in one day if they replay across
  // pages — so collapsing to one row per handle keeps the in-game
  // panel and the central /mission/games/leaderboard consistent.
  const opts: { gameId: string; mode: string; limit: number; seed?: string; seedFrom?: string; seedTo?: string } = {
    gameId: GAME_ID,
    mode: 'daily',
    limit: limit * 8,
  }
  if (window === 'today') {
    opts.seed = today
  } else if (window === 'week') {
    opts.seedFrom = weekStart(today)
    opts.seedTo = today
  }
  const entries = await leaderboard.getTopScores(opts)
  return bestByHandle(entries.map(toRow)).slice(0, limit)
}

export async function fetchPlayerRank(day: string, score: number): Promise<number | null> {
  return leaderboard.getPlayerRank({
    gameId: GAME_ID,
    mode: 'daily',
    seed: day,
    score,
  })
}

function toRow(entry: {
  id: string
  player_handle: string
  score: number
  metadata: Record<string, unknown>
  created_at: string
}): LeaderboardRow {
  const meta = entry.metadata ?? {}
  return {
    id: entry.id,
    handle: entry.player_handle,
    score: entry.score,
    antes_cleared: typeof meta.antesCleared === 'number' ? meta.antesCleared : 0,
    character_id: typeof meta.characterId === 'string' ? meta.characterId : null,
    created_at: entry.created_at,
  }
}
