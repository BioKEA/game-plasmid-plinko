// Lightweight web-audio sfx — no asset loading, all synthesized
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return null
    }
  }
  return ctx
}

function blip(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.08) {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(g).connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + duration)
}

function chord(freqs: number[], duration: number, type: OscillatorType = 'sine', gain = 0.06) {
  freqs.forEach(f => blip(f, duration, type, gain))
}

export const sfx = {
  hit(chainIndex: number) {
    const base = 220
    const freq = base * Math.pow(1.06, Math.min(chainIndex, 30))
    blip(freq, 0.08, 'triangle', 0.05)
  },
  target() {
    chord([523, 659, 784], 0.18, 'triangle', 0.06)
  },
  bonus() {
    chord([392, 494, 587, 740], 0.25, 'sawtooth', 0.04)
  },
  launch() {
    blip(140, 0.06, 'square', 0.04)
  },
  catch() {
    chord([523, 784], 0.2, 'sine', 0.08)
  },
  ballLost() {
    blip(180, 0.18, 'sawtooth', 0.06)
    setTimeout(() => blip(120, 0.18, 'sawtooth', 0.05), 80)
  },
  levelComplete() {
    const notes = [523, 659, 784, 1047]
    notes.forEach((n, i) => setTimeout(() => blip(n, 0.2, 'triangle', 0.07), i * 100))
  },
  fever() {
    // Triumphant entry: brass-like saw chord that holds, then bells
    chord([261.63, 329.63, 392.0, 523.25], 1.4, 'sawtooth', 0.05)
    setTimeout(() => chord([523.25, 659.25, 784.0, 1046.5], 1.0, 'triangle', 0.07), 120)
    setTimeout(() => chord([783.99, 1046.5], 0.8, 'sine', 0.06), 380)
  },
  feverBell(index: number) {
    // Ascending pentatonic bell tinkle, cycles through C major pentatonic
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51]
    const f = scale[index % scale.length] * (1 + Math.floor(index / scale.length) * 0.5)
    blip(f, 0.18, 'triangle', 0.06)
  },
  milestone(chain: number) {
    // Higher chains get a richer, brighter chime
    if (chain >= 25) {
      // Genome blast — full chord with bass
      chord([330, 415, 523, 659, 880], 0.5, 'sawtooth', 0.05)
      setTimeout(() => chord([523, 659, 784, 1047], 0.4, 'triangle', 0.06), 120)
    } else if (chain >= 20) {
      chord([392, 494, 587, 784], 0.35, 'triangle', 0.07)
    } else if (chain >= 15) {
      chord([440, 554, 659], 0.3, 'triangle', 0.07)
    } else if (chain >= 10) {
      chord([523, 659, 784], 0.28, 'triangle', 0.07)
    } else if (chain >= 5) {
      chord([523, 659], 0.22, 'triangle', 0.06)
    }
  },
  gameOver() {
    const notes = [392, 349, 294, 220]
    notes.forEach((n, i) => setTimeout(() => blip(n, 0.3, 'sawtooth', 0.07), i * 150))
  },
}
