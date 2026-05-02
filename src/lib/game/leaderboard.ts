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
