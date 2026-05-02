import {
  ACHIEVEMENT_LIST,
  THEME_LIST,
  isThemeUnlocked,
  type AchievementId,
  type ThemeId,
} from '@/lib/game/achievements'

interface Props {
  achievements: Set<AchievementId>
  currentTheme: ThemeId
  onChangeTheme: (t: ThemeId) => void
  onBack: () => void
}

export function AchievementsScreen({ achievements, currentTheme, onChangeTheme, onBack }: Props) {
  const unlockedCount = achievements.size
  const total = ACHIEVEMENT_LIST.length
  return (
    <div
      className="min-h-screen bg-[#0a0420] text-white px-4 py-8"
      style={{
        backgroundImage: 'radial-gradient(ellipse at top, rgba(251,191,36,0.15), transparent 60%), radial-gradient(ellipse at bottom, rgba(34,211,238,0.12), transparent 60%)',
      }}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-xs font-mono tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            ◂ BACK
          </button>
          <div className="text-[10px] tracking-[0.3em] text-amber-300 font-mono">
            BENCH BOOK · {unlockedCount}/{total} EARNED
          </div>
          <div className="w-12" />
        </div>

        <div className="text-center space-y-2">
          <h2
            className="text-5xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #fde047 0%, #e879f9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Achievements
          </h2>
          <p className="text-sm text-slate-400">
            Unlock all the badges. Some unlock new visual themes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ACHIEVEMENT_LIST.map((a) => {
            const got = achievements.has(a.id)
            return (
              <div
                key={a.id}
                className={`p-4 border-2 rounded-sm flex gap-3 items-start transition-all ${
                  got
                    ? 'border-amber-400/70 bg-amber-400/5 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                    : 'border-white/10 bg-white/5 opacity-60'
                }`}
              >
                <div className={`text-3xl ${got ? '' : 'grayscale'}`}>{a.emoji}</div>
                <div className="flex-1 space-y-1">
                  <div className={`text-sm font-black ${got ? 'text-amber-300' : 'text-slate-400'}`}>
                    {a.name}
                  </div>
                  <div className="text-[11px] text-slate-300 leading-snug">
                    {a.description}
                  </div>
                  {a.unlocksTheme && (
                    <div className={`text-[9px] tracking-widest font-mono ${got ? 'text-fuchsia-300' : 'text-slate-500'}`}>
                      ✦ unlocks {a.unlocksTheme} theme
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-4 pt-6 border-t border-white/10">
          <div className="text-center space-y-1">
            <div className="text-[10px] tracking-[0.3em] text-fuchsia-300 font-mono">
              VISUAL THEMES
            </div>
            <h3 className="text-2xl font-black tracking-tight text-white">Pick your vibe</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {THEME_LIST.map((t) => {
              const unlocked = isThemeUnlocked(t.id, achievements)
              const active = currentTheme === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => unlocked && onChangeTheme(t.id)}
                  disabled={!unlocked}
                  className={`p-4 border-2 rounded-sm text-left transition-all ${
                    active
                      ? 'border-cyan-400 bg-cyan-400/15 shadow-[0_0_24px_rgba(34,211,238,0.4)]'
                      : unlocked
                      ? 'border-white/20 bg-white/5 hover:border-cyan-400/60 hover:scale-[1.02] cursor-pointer'
                      : 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex gap-1 mb-2 h-8 rounded-sm overflow-hidden">
                    {t.preview.map((c, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="text-sm font-black text-white">{t.name}</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                    {unlocked ? t.description : '🔒 ' + t.description}
                  </div>
                  {active && (
                    <div className="text-[9px] tracking-widest text-cyan-300 font-mono mt-2">★ ACTIVE</div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
