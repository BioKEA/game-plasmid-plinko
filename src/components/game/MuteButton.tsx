import { Volume2, VolumeX } from 'lucide-react'

interface Props {
  muted: boolean
  onToggle: () => void
}

export function MuteButton({ muted, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full border border-fuchsia-500/40 bg-black/40 backdrop-blur hover:bg-black/60 hover:border-fuchsia-400 transition-all"
      title={muted ? 'Unmute' : 'Mute'}
      aria-label={muted ? 'Unmute' : 'Mute'}
    >
      {muted ? (
        <VolumeX className="w-4 h-4 text-fuchsia-400" />
      ) : (
        <Volume2 className="w-4 h-4 text-fuchsia-300" />
      )}
    </button>
  )
}
