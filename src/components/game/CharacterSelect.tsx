import { CHARACTER_LIST, type CharacterId, type CharacterSpec } from '@/lib/game/characters'
import { POWERUPS, type PowerupId } from '@/lib/game/powerups'

interface Props {
  modeLabel: string
  classesWon: Set<CharacterId>
  onPick: (id: CharacterId) => void
  onBack: () => void
}

const DIFFICULTY_LABEL: Record<CharacterSpec['difficulty'], string> = {
  beginner: 'BEGINNER',
  standard: 'STANDARD',
  expert: 'EXPERT',
  unique: 'UNIQUE',
}

export function CharacterSelect({ modeLabel, classesWon, onPick, onBack }: Props) {
  return (
    <div
      className="min-h-screen bg-[#0a0420] text-white px-4 py-10"
      style={{
        backgroundImage: 'radial-gradient(ellipse at top, rgba(232,121,249,0.18), transparent 60%), radial-gradient(ellipse at bottom, rgba(34,211,238,0.15), transparent 60%)',
      }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-xs font-mono tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            ◂ BACK
          </button>
          <div className="text-[10px] tracking-[0.3em] text-fuchsia-300 font-mono">
            {modeLabel} · CHOOSE YOUR CHARACTER
          </div>
          <div className="w-12" />
        </div>

        <div className="text-center space-y-2 pb-4">
          <h2
            className="text-4xl md:text-5xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #f5d0fe 0%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Pick the bench you want.
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Each lab has different starting tools and trade-offs. Win with all four to earn the Quartet badge.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CHARACTER_LIST.map((c) => (
            <CharacterCard
              key={c.id}
              spec={c}
              won={classesWon.has(c.id)}
              onPick={() => onPick(c.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CharacterCard({
  spec,
  won,
  onPick,
}: {
  spec: CharacterSpec
  won: boolean
  onPick: () => void
}) {
  const stats = spec.stats
  const startingPows = Object.entries(spec.powerupsPerLevel) as [PowerupId, number][]
  return (
    <button
      onClick={onPick}
      className="group relative text-left p-5 border-2 rounded-sm transition-all hover:scale-[1.02] hover:-translate-y-1 active:scale-95 bg-black/40 backdrop-blur-sm flex flex-col"
      style={{
        borderColor: spec.color,
        boxShadow: `0 0 24px ${spec.glow}`,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-5xl" aria-hidden>{spec.emoji}</div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-[9px] font-mono font-bold tracking-widest"
            style={{ color: spec.color }}
          >
            {DIFFICULTY_LABEL[spec.difficulty]}
          </span>
          {won && (
            <span className="text-[9px] font-mono font-bold tracking-widest text-amber-300 bg-amber-400/10 border border-amber-400/40 px-1.5 py-0.5">
              ★ MASTERED
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1 mb-3">
        <div className="text-[10px] font-mono tracking-widest text-slate-400">{spec.title}</div>
        <div
          className="text-2xl font-black tracking-tight"
          style={{ color: spec.color, textShadow: `0 0 8px ${spec.glow}` }}
        >
          {spec.name}
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed mb-3">
        {spec.description}
      </p>

      <div className="text-[10px] italic text-slate-500 mb-3">{spec.flavor}</div>

      <div className="space-y-1.5 text-[10px] font-mono mt-auto pt-3 border-t border-white/10">
        <Stat label="balls / level" value={stats.ballsBonus >= 0 ? `+${stats.ballsBonus}` : `${stats.ballsBonus}`} positive={stats.ballsBonus >= 0} />
        <Stat label="catcher" value={`×${stats.catcherWidthMultiplier.toFixed(2)}`} positive={stats.catcherWidthMultiplier >= 1} />
        <Stat label="score mult" value={`×${stats.scoreMultiplier.toFixed(2)}`} positive={stats.scoreMultiplier >= 1} />
        {stats.catchExtraBalls > 0 && (
          <Stat label="catch bonus" value={`+${stats.catchExtraBalls}`} positive={true} />
        )}
        {spec.startingUpgrades.length > 0 && (
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500">starts with</span>
            <span className="text-cyan-300">{spec.startingUpgrades.length} upgrade{spec.startingUpgrades.length > 1 ? 's' : ''}</span>
          </div>
        )}
        {startingPows.some(([, v]) => v > 0) && (
          <div className="pt-1">
            <div className="text-slate-500 mb-1">powerups / level</div>
            <div className="flex gap-1.5">
              {startingPows.map(([pid, count]) => {
                if (count <= 0) return null
                const p = POWERUPS[pid]
                return (
                  <span
                    key={pid}
                    className="text-[10px] inline-flex items-center gap-0.5 px-1 py-0.5 border rounded-sm"
                    style={{ borderColor: p.color, color: p.color, backgroundColor: 'rgba(0,0,0,0.4)' }}
                    title={p.name}
                  >
                    <span className="text-sm">{p.emoji}</span>
                    {count > 1 && <span className="font-bold">×{count}</span>}
                  </span>
                )
              })}
            </div>
          </div>
        )}
        {spec.id === 'biologist' && (
          <div className="pt-1 text-slate-500">+1 random powerup / level</div>
        )}
      </div>

      <div
        className="mt-4 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: spec.color }}
      >
        ▸ START
      </div>
    </button>
  )
}

function Stat({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={positive ? 'text-emerald-300' : 'text-rose-300'}>{value}</span>
    </div>
  )
}
