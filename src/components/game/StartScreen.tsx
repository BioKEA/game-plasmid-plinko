import { dayNumber, todayKey } from '@/lib/game/rng'

const LAUNCH_DATE = '2026-04-27'

interface Props {
  onStartDaily: () => void
  onStartCampaign: () => void
  onAchievements: () => void
  achievementsCount: number
  totalAchievements: number
  highScore: number | null
  dailyDoneToday: boolean
  dailyTodayScore: number | null
}

export function StartScreen({
  onStartDaily,
  onStartCampaign,
  onAchievements,
  achievementsCount,
  totalAchievements,
  highScore,
  dailyDoneToday,
  dailyTodayScore,
}: Props) {
  const day = dayNumber(LAUNCH_DATE)
  void todayKey
  return (
    <div className="min-h-screen bg-[#0a0420] text-white relative overflow-hidden flex items-center justify-center px-4 py-8"
      style={{
        backgroundImage: 'radial-gradient(ellipse at top, rgba(217,70,239,0.25), transparent 60%), radial-gradient(ellipse at bottom, rgba(34,211,238,0.2), transparent 60%)',
      }}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: 'linear-gradient(rgba(217,70,239,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(217,70,239,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative z-10 text-center space-y-8 max-w-2xl">
        <div className="space-y-2">
          <div className="text-[10px] tracking-[0.4em] text-cyan-400/80 font-mono">
            BIOKEA · LARGE DATA COLLIDER
          </div>
          <h1
            className="text-7xl md:text-8xl font-black tracking-tighter"
            style={{
              background: 'linear-gradient(135deg, #f5d0fe 0%, #e879f9 40%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 24px rgba(232,121,249,0.5))',
            }}
          >
            PLASMID
          </h1>
          <h1
            className="text-7xl md:text-8xl font-black tracking-tighter -mt-4"
            style={{
              background: 'linear-gradient(135deg, #22d3ee 0%, #fbbf24 50%, #fb7185 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 24px rgba(34,211,238,0.5))',
            }}
          >
            PLINKO
          </h1>
        </div>

        <p className="text-slate-300 text-base max-w-md mx-auto leading-relaxed">
          Aim. Drop a primer. Clear every <span className="text-fuchsia-400 font-bold">gene peg</span> on the board.
          Stack <span className="text-cyan-300 font-bold">lab upgrades</span> between rounds.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
          <button
            onClick={onStartDaily}
            className="group relative p-6 border-2 border-fuchsia-400 bg-gradient-to-br from-fuchsia-500/20 to-purple-700/10 hover:from-fuchsia-500/30 hover:to-purple-700/20 transition-all hover:scale-[1.02] text-left rounded-sm"
            style={{ boxShadow: '0 0 28px rgba(232,121,249,0.4)' }}
          >
            <div className="text-[10px] tracking-[0.3em] text-fuchsia-300 font-mono mb-1">DAILY · DAY {day}</div>
            <div className="text-2xl font-black text-white mb-1">DAILY CHALLENGE</div>
            <div className="text-xs text-fuchsia-200/80 mb-3">
              Same boards, same upgrades for everyone. Beat the world.
            </div>
            <div className="text-[10px] font-mono text-fuchsia-300">
              {dailyDoneToday ? `★ DONE · ${dailyTodayScore?.toLocaleString()} pts — REPLAY ▸` : '8 antes · share your score ▸'}
            </div>
          </button>

          <button
            onClick={onStartCampaign}
            className="group relative p-6 border-2 border-cyan-400 bg-gradient-to-br from-cyan-500/20 to-blue-700/10 hover:from-cyan-500/30 hover:to-blue-700/20 transition-all hover:scale-[1.02] text-left rounded-sm"
            style={{ boxShadow: '0 0 28px rgba(34,211,238,0.4)' }}
          >
            <div className="text-[10px] tracking-[0.3em] text-cyan-300 font-mono mb-1">EXPEDITION</div>
            <div className="text-2xl font-black text-white mb-1">CAMPAIGN MODE</div>
            <div className="text-xs text-cyan-200/80 mb-3">
              Branching map. Pick your route. Boss at the top.
            </div>
            <div className="text-[10px] font-mono text-cyan-300">
              5 stages · randomized path ▸
            </div>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono">
          {highScore !== null && highScore > 0 && (
            <div className="text-cyan-300/80">
              HIGH SCORE · <span className="text-cyan-300 font-bold">{highScore.toLocaleString()}</span>
            </div>
          )}
          <button
            onClick={onAchievements}
            className="text-amber-300/80 hover:text-amber-300 transition-colors tracking-widest"
          >
            ★ ACHIEVEMENTS · {achievementsCount}/{totalAchievements}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-4 max-w-lg mx-auto">
          <Tip color="text-emerald-400" label="AIM" body="Mouse to aim, click to fire." />
          <Tip color="text-fuchsia-400" label="CLEAR" body="Hit every glowing gene to advance." />
          <Tip color="text-cyan-400" label="CATCH" body="Land in the bath for a free ball." />
        </div>
      </div>
    </div>
  )
}

function Tip({ color, label, body }: { color: string; label: string; body: string }) {
  return (
    <div className="border border-white/10 bg-white/5 backdrop-blur-sm p-3 text-left rounded-sm">
      <div className={`text-[10px] font-mono font-bold tracking-widest ${color}`}>{label}</div>
      <div className="text-xs text-slate-300 mt-1 leading-snug">{body}</div>
    </div>
  )
}
