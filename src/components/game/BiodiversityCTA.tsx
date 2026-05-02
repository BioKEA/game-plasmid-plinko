interface Props {
  onMaybeLater: () => void
  onNeverAgain: () => void
}

const SUPPORT_URL = 'https://www.calalive.org/get-involved'

export function BiodiversityCTA({ onMaybeLater, onNeverAgain }: Props) {
  return (
    <div
      className="border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-500/12 via-cyan-500/6 to-emerald-500/4 p-5 rounded-sm space-y-4 text-left"
      style={{ boxShadow: '0 0 28px rgba(52,211,153,0.25)' }}
    >
      <div className="flex items-start gap-4">
        <div className="text-4xl flex-shrink-0">🌿</div>
        <div className="flex-1 space-y-1">
          <div className="text-[10px] tracking-[0.3em] text-emerald-300 font-mono">
            BIOKEA · COMMUNITY
          </div>
          <div className="text-base font-bold text-emerald-100">
            Loving the game?
          </div>
          <p className="text-sm text-emerald-100/80 leading-relaxed">
            Plasmid Plinko is a celebration of real biodiversity work —
            cataloging the species that live in California and your own
            hometown. If you'd like to support the people doing it, or share
            this with someone who'd dig it:
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onMaybeLater}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-sm tracking-wider transition-all rounded-sm"
          style={{ boxShadow: '0 0 22px rgba(52,211,153,0.4), 0 3px 0 #047857' }}
        >
          → SUPPORT / SHARE
        </a>
        <button
          onClick={onMaybeLater}
          className="px-4 py-2.5 border border-white/20 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-mono tracking-wider transition-all rounded-sm"
        >
          maybe later
        </button>
        <button
          onClick={onNeverAgain}
          className="px-4 py-2.5 text-white/40 hover:text-white/70 text-xs font-mono tracking-wider transition-all"
        >
          not interested
        </button>
      </div>

      <div className="text-[10px] font-mono text-emerald-300/60 truncate">
        {SUPPORT_URL.replace(/^https?:\/\//, '')}
      </div>
    </div>
  )
}
