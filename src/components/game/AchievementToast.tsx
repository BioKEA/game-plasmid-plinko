import type { AchievementSpec } from '@/lib/game/achievements'

interface Props {
  achievement: AchievementSpec
}

export function AchievementToast({ achievement }: Props) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-3 px-4 py-3 border-2 border-amber-400 bg-amber-400/10 backdrop-blur rounded-sm animate-in fade-in slide-in-from-left"
      style={{ boxShadow: '0 0 24px rgba(251,191,36,0.5)' }}
    >
      <div className="text-3xl">{achievement.emoji}</div>
      <div>
        <div className="text-[9px] tracking-[0.3em] text-amber-300 font-mono font-bold">
          ACHIEVEMENT
        </div>
        <div className="text-sm font-black text-amber-100">
          {achievement.name}
        </div>
        <div className="text-[10px] text-amber-200/80">
          {achievement.description}
        </div>
        {achievement.unlocksTheme && (
          <div className="text-[9px] tracking-widest text-fuchsia-300 font-mono mt-1">
            ✦ THEME UNLOCKED
          </div>
        )}
      </div>
    </div>
  )
}
