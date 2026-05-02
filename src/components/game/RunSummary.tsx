import { useEffect, useState } from 'react'
import type { Base, RunState } from '@/lib/game/types'
import type { CharacterSpec } from '@/lib/game/characters'
import { copyToClipboard } from '@/lib/game/share'
import { Leaderboard } from './Leaderboard'
import { BiodiversityCTA } from './BiodiversityCTA'

interface Props {
  run: RunState
  win: boolean
  highScore: number
  shareString?: string | null
  modeLabel: string
  character: CharacterSpec | null
  showLeaderboard?: boolean
  showBiodiversityCTA?: boolean
  onMaybeLaterCTA?: () => void
  onNeverAgainCTA?: () => void
  onPlayAgain: () => void
  onMenu: () => void
}

const BASE_COLORS: Record<Base, { fill: string; glow: string }> = {
  A: { fill: '#34d399', glow: 'rgba(52,211,153,0.7)' },
  T: { fill: '#fb7185', glow: 'rgba(251,113,133,0.7)' },
  G: { fill: '#fbbf24', glow: 'rgba(251,191,36,0.7)' },
  C: { fill: '#38bdf8', glow: 'rgba(56,189,248,0.7)' },
}

export function RunSummary({
  run,
  win,
  highScore,
  shareString,
  modeLabel,
  character,
  showLeaderboard,
  showBiodiversityCTA,
  onMaybeLaterCTA,
  onNeverAgainCTA,
  onPlayAgain,
  onMenu,
}: Props) {
  const isNewHigh = run.score >= highScore && run.score > 0
  const [copied, setCopied] = useState(false)
  const [confettiOn, setConfettiOn] = useState(false)

  useEffect(() => {
    if (win) setConfettiOn(true)
  }, [win])

  async function handleShare() {
    if (!shareString) return
    const ok = await copyToClipboard(shareString)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div
      className="min-h-screen bg-[#0a0420] text-white px-4 py-8"
      style={{
        backgroundImage: win
          ? 'radial-gradient(ellipse at center, rgba(251,191,36,0.2), transparent 60%)'
          : 'radial-gradient(ellipse at center, rgba(251,113,133,0.18), transparent 60%)',
      }}
    >
      <div className={`max-w-3xl mx-auto space-y-6 text-center ${confettiOn && win ? 'animate-in fade-in slide-in-from-bottom' : ''}`}>
        <div className="space-y-2">
          <div className="text-[10px] tracking-[0.4em] text-fuchsia-400/80 font-mono">
            {modeLabel} · {win ? 'COMPLETE' : 'OVER'}
            {character && (
              <>
                {' · '}
                <span style={{ color: character.color }}>
                  {character.emoji} {character.name}
                </span>
              </>
            )}
          </div>
          <h2
            className="text-5xl md:text-6xl font-black tracking-tight"
            style={{
              background: win
                ? 'linear-gradient(135deg, #fde047 0%, #e879f9 100%)'
                : 'linear-gradient(135deg, #fb7185 0%, #e879f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {win ? 'GENOME SEQUENCED' : 'CONTAMINATED'}
          </h2>
        </div>

        <div className="border-2 border-fuchsia-500/40 bg-black/30 p-6 space-y-4 rounded-sm">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-fuchsia-300 font-mono mb-1">FINAL SCORE</div>
            <div
              className="text-6xl font-black tabular-nums text-cyan-300"
              style={{ textShadow: '0 0 24px rgba(34,211,238,0.7)' }}
            >
              {run.score.toLocaleString()}
            </div>
            {isNewHigh && (
              <div className="text-amber-300 font-bold text-sm mt-2 animate-pulse">★ NEW HIGH SCORE ★</div>
            )}
            {!isNewHigh && highScore > 0 && (
              <div className="text-xs font-mono text-slate-400 mt-1">
                high score · {highScore.toLocaleString()}
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4 pt-2 border-t border-fuchsia-500/20">
            {(['A', 'T', 'G', 'C'] as Base[]).map((b) => (
              <div key={b} className="flex flex-col items-center gap-1">
                <span
                  className="inline-block w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-black"
                  style={{
                    backgroundColor: BASE_COLORS[b].fill,
                    boxShadow: `0 0 12px ${BASE_COLORS[b].glow}`,
                  }}
                >
                  {b}
                </span>
                <span className="text-sm font-bold tabular-nums">{run.bases[b]}</span>
              </div>
            ))}
          </div>

          {run.upgrades.length > 0 && (
            <div className="pt-2 border-t border-fuchsia-500/20">
              <div className="text-[10px] tracking-[0.3em] text-fuchsia-300 font-mono mb-2">UPGRADES INSTALLED</div>
              <div className="flex flex-wrap justify-center gap-2">
                {run.upgrades.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 border border-white/20 bg-white/5 rounded-sm"
                  >
                    <span>{u.emoji}</span>
                    <span className="font-mono">{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {shareString && (
          <div className="space-y-2">
            <div className="border border-cyan-500/30 bg-black/40 px-4 py-3 rounded-sm font-mono text-sm whitespace-pre-line text-cyan-100">
              {shareString}
            </div>
            <button
              onClick={handleShare}
              className="px-6 py-2 border-2 border-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 font-bold text-sm tracking-wider transition-all rounded-sm"
            >
              {copied ? '✓ COPIED' : '📋 COPY RESULT'}
            </button>
          </div>
        )}

        {showLeaderboard && (
          <Leaderboard
            score={run.score}
            antesCleared={run.upgrades.length}
            characterId={character?.id ?? null}
          />
        )}

        {showBiodiversityCTA && onMaybeLaterCTA && onNeverAgainCTA && (
          <BiodiversityCTA
            onMaybeLater={onMaybeLaterCTA}
            onNeverAgain={onNeverAgainCTA}
          />
        )}

        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={onMenu}
            className="px-6 py-3 border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold text-sm tracking-wider transition-all rounded-sm"
          >
            ◂ MENU
          </button>
          <button
            onClick={onPlayAgain}
            className="px-8 py-3 bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black text-base tracking-wider transition-all hover:scale-105 active:scale-95"
            style={{ boxShadow: '0 0 30px rgba(232,121,249,0.6), 0 4px 0 #a21caf' }}
          >
            ▸ NEW RUN
          </button>
        </div>
      </div>
    </div>
  )
}
