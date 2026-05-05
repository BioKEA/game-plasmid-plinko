import { useEffect, useState } from 'react'
import {
  fetchPlayerRank,
  fetchTop,
  hasSubmittedToday,
  loadHandle,
  saveHandle,
  sanitizeHandle,
  submitDailyScore,
  type LeaderboardRow,
  type LeaderboardWindow,
} from '@/lib/game/leaderboard'
import { todayKey } from '@/lib/game/rng'
import { CHARACTERS, type CharacterId } from '@/lib/game/characters'

interface Props {
  score: number
  antesCleared: number
  characterId: CharacterId | null
}

export function Leaderboard({ score, antesCleared, characterId }: Props) {
  const day = todayKey()
  const [view, setView] = useState<LeaderboardWindow>('today')
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(hasSubmittedToday(day))
  const [error, setError] = useState<string | null>(null)
  const [handle, setHandle] = useState<string>(() => loadHandle() ?? '')
  const [editing, setEditing] = useState(!submitted)

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  async function refresh() {
    setRows(null)
    const [top, myRank] = await Promise.all([
      fetchTop(view, day, 10),
      view === 'today' ? fetchPlayerRank(day, score) : Promise.resolve(null),
    ])
    setRows(top)
    setRank(myRank)
  }

  async function handleSubmit() {
    const clean = sanitizeHandle(handle)
    if (!clean) {
      setError('Pick a handle (1–16 letters/numbers).')
      return
    }
    setSubmitting(true)
    setError(null)
    saveHandle(clean)
    const res = await submitDailyScore({
      day,
      handle: clean,
      score,
      antesCleared,
      characterId,
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSubmitted(true)
    setEditing(false)
    await refresh()
  }

  return (
    <div className="border-2 border-cyan-400/40 bg-black/40 p-5 rounded-sm space-y-4 text-left">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] tracking-[0.3em] text-cyan-300 font-mono">
          {view === 'today'
            ? `DAILY LEADERBOARD · ${day}`
            : view === 'week'
            ? 'LAST 7 DAYS · BEST PER PLAYER'
            : 'ALL-TIME · BEST PER PLAYER'}
        </div>
        {view === 'today' && rank !== null && (
          <div className="text-[10px] font-mono text-fuchsia-300">
            YOUR RANK · <span className="text-fuchsia-300 font-bold">#{rank}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {(['today', 'week', 'all'] as const).map((w) => (
          <button
            key={w}
            onClick={() => setView(w)}
            className={`text-[9px] uppercase tracking-[0.18em] font-mono px-3 py-1.5 rounded-sm border transition-colors ${
              view === w
                ? 'bg-cyan-400/15 text-cyan-100 border-cyan-400/60'
                : 'text-slate-400 border-white/10 hover:text-cyan-200 hover:border-cyan-400/30'
            }`}
          >
            {w === 'today' ? 'Today' : w === 'week' ? 'Week' : 'All-time'}
          </button>
        ))}
      </div>

      {!submitted && editing && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
              placeholder="Your handle"
              className="flex-1 bg-black/60 border-2 border-cyan-400/40 focus:border-cyan-400 px-3 py-2 rounded-sm font-mono text-sm text-cyan-100 placeholder-cyan-300/30 outline-none"
              maxLength={16}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || handle.length < 1}
              className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-cyan-950 font-black text-sm tracking-wider transition-all rounded-sm"
            >
              {submitting ? 'SUBMITTING…' : 'SUBMIT SCORE'}
            </button>
          </div>
          {error && (
            <div className="text-xs text-rose-400 font-mono">{error}</div>
          )}
        </div>
      )}

      {submitted && (
        <div className="text-[11px] text-emerald-300 font-mono flex items-center gap-2">
          ✓ Submitted as <span className="font-bold">{loadHandle()}</span>
        </div>
      )}

      <div className="space-y-1">
        {rows === null ? (
          <div className="text-xs text-slate-500 font-mono py-4 text-center">loading scores…</div>
        ) : rows.length === 0 ? (
          <div className="text-xs text-slate-500 font-mono py-4 text-center">
            {view === 'today' ? 'be the first today.' : 'no scores yet.'}
          </div>
        ) : (
          rows.map((row, i) => {
            const me = handle && row.handle === handle && row.score === score
            const c = row.character_id ? CHARACTERS[row.character_id as CharacterId] : null
            const isTop = i === 0
            return (
              <div
                key={row.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm text-xs font-mono ${
                  me
                    ? 'bg-fuchsia-500/15 border border-fuchsia-400/60'
                    : isTop
                    ? 'bg-amber-400/10 border border-amber-400/40'
                    : 'border border-white/5'
                }`}
              >
                <span className={`w-6 text-right ${isTop ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>
                  {i + 1}
                </span>
                {c && (
                  <span title={c.name} className="text-base" style={{ color: c.color }}>
                    {c.emoji}
                  </span>
                )}
                <span className="flex-1 truncate">
                  {row.handle}
                  {me && <span className="ml-2 text-fuchsia-300">(you)</span>}
                </span>
                <span className="text-cyan-300 font-bold tabular-nums">
                  {row.score.toLocaleString()}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
