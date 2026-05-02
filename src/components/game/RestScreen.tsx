interface Props {
  ballsRefilled: number
  onContinue: () => void
}

export function RestScreen({ ballsRefilled, onContinue }: Props) {
  return (
    <div
      className="min-h-screen bg-[#0a0420] text-white flex items-center justify-center px-4 py-8"
      style={{
        backgroundImage: 'radial-gradient(ellipse at center, rgba(52,211,153,0.18), transparent 60%)',
      }}
    >
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <div className="text-[10px] tracking-[0.4em] text-emerald-400 font-mono">REAGENT STATION</div>
          <h2
            className="text-5xl font-black tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #6ee7b7 0%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Resupply.
          </h2>
        </div>

        <div className="border-2 border-emerald-400/50 bg-emerald-400/5 p-8 rounded-sm space-y-3">
          <div className="text-6xl">🧪</div>
          <div className="text-emerald-300 font-mono text-sm">
            Balls refilled to <span className="font-black text-2xl">{ballsRefilled}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
            Take a breath before the next sample. Your aliquot reservoir is back to full.
          </p>
        </div>

        <button
          onClick={onContinue}
          className="px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-lg tracking-wider transition-all hover:scale-105 active:scale-95"
          style={{ boxShadow: '0 0 30px rgba(52,211,153,0.5), 0 4px 0 #047857' }}
        >
          ▸ BACK TO THE MAP
        </button>
      </div>
    </div>
  )
}
