import type { RunState } from '@/lib/game/types'
import type { BoardSpec } from '@/lib/game/types'
import type { PowerupCharges, PowerupId } from '@/lib/game/powerups'
import type { CharacterSpec } from '@/lib/game/characters'
import { PeggleCanvas, type LevelResult } from './PeggleCanvas'

interface Props {
  board: BoardSpec
  run: RunState
  totalAntes: number
  initialBalls: number
  charges: PowerupCharges
  character: CharacterSpec | null
  onLevelEnd: (result: LevelResult) => void
  onPowerupConsumed: (id: PowerupId) => void
  onChainPeak: (chainCount: number) => void
  onChainReward?: (id: PowerupId) => void
  onJackpot: () => void
  onGenePegCleared: () => void
}

export function GameScreen({
  board,
  run,
  totalAntes,
  initialBalls,
  charges,
  character,
  onLevelEnd,
  onPowerupConsumed,
  onChainPeak,
  onChainReward,
  onJackpot,
  onGenePegCleared,
}: Props) {
  const stats = character?.stats ?? {
    ballsBonus: 0,
    catcherWidthMultiplier: 1,
    scoreMultiplier: 1,
    catchExtraBalls: 0,
  }
  return (
    <div
      className="min-h-screen bg-[#0a0420] text-white relative"
      style={{
        backgroundImage: 'radial-gradient(ellipse at top, rgba(217,70,239,0.18), transparent 60%), radial-gradient(ellipse at bottom, rgba(34,211,238,0.15), transparent 60%)',
      }}
    >
      {/* Top status bar */}
      <div className="border-b-2 border-fuchsia-500/30 px-5 py-3 pr-16 flex items-center justify-between backdrop-blur bg-black/20">
        <div className="flex items-center gap-3">
          <span className="inline-block w-3 h-3 bg-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.9)]" />
          <span className="text-[10px] tracking-[0.3em] text-fuchsia-300 font-mono font-bold">
            BIOKEA · LDC
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-cyan-300/80 font-mono tracking-widest">
            LEVEL {run.ante} / {totalAntes}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalAntes }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 ${i < run.ante - 1 ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : i === run.ante - 1 ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]' : 'border-2 border-cyan-400/40'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-center gap-6 px-4 py-6 max-w-7xl mx-auto">
        {/* Left side: character + board info + upgrades */}
        <div className="lg:w-56 w-full lg:order-1 order-2 space-y-4">
          {character && (
            <div
              className="border-2 bg-black/40 p-4 rounded-sm"
              style={{ borderColor: character.color, boxShadow: `0 0 16px ${character.glow}` }}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">{character.emoji}</div>
                <div>
                  <div className="text-[9px] tracking-[0.3em] font-mono" style={{ color: character.color }}>
                    {character.title}
                  </div>
                  <div className="text-base font-black" style={{ color: character.color }}>
                    {character.name}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="border border-fuchsia-500/30 bg-black/30 p-4 rounded-sm">
            <div className="text-[9px] tracking-[0.3em] text-fuchsia-300 font-mono mb-1">BOARD</div>
            <div className="text-lg font-black text-cyan-300">{board.name}</div>
            <div className="text-xs text-slate-400 mt-1">{board.description}</div>
          </div>

          {run.upgrades.length > 0 && (
            <div className="border border-cyan-500/20 bg-black/30 p-4 rounded-sm">
              <div className="text-[9px] tracking-[0.3em] text-cyan-300 font-mono mb-2">LAB BENCH</div>
              <div className="space-y-2">
                {run.upgrades.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-start gap-2 text-xs group cursor-help"
                    title={u.description}
                  >
                    <span className="text-base mt-px">{u.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-slate-200 truncate">{u.name}</div>
                      <div className="text-[10px] text-slate-500 leading-tight max-h-0 overflow-hidden group-hover:max-h-20 transition-all duration-300">
                        {u.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Center: game canvas */}
        <div className="flex-1 max-w-[600px] w-full lg:order-2 order-1 pt-10 pb-16">
          <PeggleCanvas
            key={`${board.id}-${run.ante}`}
            board={board}
            upgrades={run.upgrades}
            initialBalls={initialBalls}
            charges={charges}
            scoreMultiplier={stats.scoreMultiplier}
            catcherWidthMultiplier={stats.catcherWidthMultiplier}
            catchExtraBalls={stats.catchExtraBalls}
            onComplete={onLevelEnd}
            onPowerupConsumed={onPowerupConsumed}
            onChainPeak={onChainPeak}
            onChainReward={onChainReward}
            onJackpot={onJackpot}
            onGenePegCleared={onGenePegCleared}
          />
        </div>

        {/* Right side: legend */}
        <div className="lg:w-48 w-full lg:order-3 order-3 space-y-4">
          <div className="border border-fuchsia-500/30 bg-black/30 p-4 rounded-sm">
            <div className="text-[9px] tracking-[0.3em] text-fuchsia-300 font-mono mb-3">LEGEND</div>
            <div className="space-y-2 text-xs">
              <LegendRow color="#e879f9" label="Gene · clear all to win" pulse />
              <LegendRow color="#fde047" label="Bonus · ★ jackpot peg" />
              <LegendRow color="#34d399" label="A · adenine" />
              <LegendRow color="#fb7185" label="T · thymine" />
              <LegendRow color="#fbbf24" label="G · guanine" />
              <LegendRow color="#38bdf8" label="C · cytosine" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendRow({ color, label, pulse }: { color: string; label: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${pulse ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
      <span className="text-slate-300">{label}</span>
    </div>
  )
}
