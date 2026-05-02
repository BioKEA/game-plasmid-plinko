import type { Upgrade } from '@/lib/game/types'

interface Props {
  choices: Upgrade[]
  ante: number
  onPick: (upgrade: Upgrade) => void
  onSkip: () => void
  title?: string
}

const RARITY_STYLES: Record<Upgrade['rarity'], { ring: string; label: string; glow: string; bg: string }> = {
  common: {
    ring: 'border-cyan-400/60',
    label: 'text-cyan-300',
    glow: '0 0 20px rgba(34,211,238,0.3)',
    bg: 'bg-cyan-400/5',
  },
  rare: {
    ring: 'border-fuchsia-400/70',
    label: 'text-fuchsia-300',
    glow: '0 0 24px rgba(232,121,249,0.4)',
    bg: 'bg-fuchsia-400/10',
  },
  legendary: {
    ring: 'border-amber-400',
    label: 'text-amber-300',
    glow: '0 0 32px rgba(251,191,36,0.5)',
    bg: 'bg-amber-400/10',
  },
}

export function UpgradePicker({ choices, ante, onPick, onSkip, title = 'Stock the bench.' }: Props) {
  return (
    <div
      className="min-h-screen bg-[#0a0420] text-white flex items-center justify-center px-4 py-8"
      style={{
        backgroundImage: 'radial-gradient(ellipse at center, rgba(217,70,239,0.2), transparent 60%)',
      }}
    >
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="text-[10px] tracking-[0.4em] text-cyan-400/80 font-mono">
            ANTE {ante - 1} CLEARED · CHOOSE A LAB UPGRADE
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">
            {title}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {choices.map((u) => {
            const style = RARITY_STYLES[u.rarity]
            return (
              <button
                key={u.id}
                onClick={() => onPick(u)}
                className={`group text-left p-5 border-2 rounded-sm transition-all hover:scale-[1.02] hover:-translate-y-1 active:scale-95 ${style.ring} ${style.bg}`}
                style={{ boxShadow: style.glow }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{u.emoji}</div>
                  <div className={`text-[9px] font-mono font-bold tracking-widest ${style.label}`}>
                    {u.rarity.toUpperCase()}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className={`text-lg font-black ${style.label}`}>{u.name}</div>
                  <div className="text-sm text-slate-300 leading-snug">{u.description}</div>
                </div>
                <div className={`mt-4 text-[10px] font-mono ${style.label} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  ▸ INSTALL
                </div>
              </button>
            )
          })}
        </div>

        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-xs text-slate-500 hover:text-slate-300 font-mono tracking-wider transition-colors"
          >
            skip — keep the bench bare
          </button>
        </div>
      </div>
    </div>
  )
}
