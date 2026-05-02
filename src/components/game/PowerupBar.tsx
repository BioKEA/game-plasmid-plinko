import { POWERUPS, POWERUP_LIST, type PowerupCharges, type PowerupId } from '@/lib/game/powerups'

interface Props {
  charges: PowerupCharges
  armed: PowerupId | null
  onArm: (id: PowerupId | null) => void
  disabled?: boolean
}

export function PowerupBar({ charges, armed, onArm, disabled }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 select-none">
      <span className="text-[9px] font-mono tracking-widest text-fuchsia-300/80">POWERUPS</span>
      {POWERUP_LIST.map((p) => {
        const count = charges[p.id]
        const isArmed = armed === p.id
        const isAvailable = count > 0 && !disabled
        return (
          <button
            key={p.id}
            onClick={() => onArm(isArmed ? null : p.id)}
            disabled={!isAvailable}
            className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-md border-2 transition-all ${
              isAvailable ? 'cursor-pointer hover:scale-105' : 'cursor-default opacity-40'
            }`}
            style={{
              borderColor: isArmed ? p.color : isAvailable ? `${p.color}80` : 'rgba(255,255,255,0.1)',
              backgroundColor: isArmed ? `${p.color}33` : isAvailable ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)',
              boxShadow: isArmed ? `0 0 18px ${p.color}99, inset 0 0 12px ${p.color}40` : 'none',
            }}
            title={`${p.name} — ${p.description}`}
          >
            <span className="text-xl leading-none" aria-hidden>{p.emoji}</span>
            <span
              className="text-[8px] font-mono font-black mt-0.5"
              style={{ color: isAvailable ? p.color : 'rgba(255,255,255,0.4)' }}
            >
              ×{count}
            </span>
            {isArmed && (
              <span
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[7px] font-mono font-bold tracking-widest whitespace-nowrap"
                style={{ color: p.color, textShadow: `0 0 6px ${p.color}` }}
              >
                ARMED
              </span>
            )}
          </button>
        )
      })}
      {armed && (
        <div
          className="ml-2 text-[10px] font-mono leading-tight"
          style={{ color: POWERUPS[armed].color, maxWidth: '160px' }}
        >
          <div className="font-bold tracking-widest">{POWERUPS[armed].shortName}</div>
          <div className="opacity-80">{POWERUPS[armed].description}</div>
        </div>
      )}
    </div>
  )
}
