// Procedural synthwave music engine.
// Pad + bass loop continuously; arp + drums layer in based on intensity.

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let started = false
let muted = false
let intensity = 0 // 0..1
let intensityTarget = 0
let nextNoteTime = 0
let step = 0 // 0..15 within bar
let bar = 0 // 0..3 within progression
let schedulerId: number | null = null

const BPM = 92
const SIXTEENTH = 60 / BPM / 4 // seconds per 16th note
const LOOKAHEAD_S = 0.18

// A minor: i - VI - III - VII (Am - F - C - G)
type ChordSpec = { pad: number[]; bass: number; arp: number[] }
const PROGRESSION: ChordSpec[] = [
  { pad: [220.0, 261.63, 329.63], bass: 110.0, arp: [220.0, 261.63, 329.63, 440.0] }, // Am
  { pad: [174.61, 220.0, 261.63], bass: 87.31, arp: [174.61, 220.0, 261.63, 349.23] }, // F
  { pad: [261.63, 329.63, 392.0], bass: 130.81, arp: [261.63, 329.63, 392.0, 523.25] }, // C
  { pad: [196.0, 246.94, 293.66], bass: 98.0, arp: [196.0, 246.94, 293.66, 392.0] }, // G
]

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      const C = window.AudioContext || (window as any).webkitAudioContext
      ctx = new C()
      masterGain = ctx.createGain()
      masterGain.gain.value = muted ? 0 : 0.7
      masterGain.connect(ctx.destination)
    } catch {
      return null
    }
  }
  return ctx
}

function playPad(time: number, freqs: number[], dur: number) {
  const c = ctx
  if (!c || !masterGain) return
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(900, time)
  filter.frequency.linearRampToValueAtTime(1400, time + dur * 0.5)
  filter.frequency.linearRampToValueAtTime(900, time + dur)
  filter.Q.value = 4

  const g = c.createGain()
  g.gain.setValueAtTime(0, time)
  g.gain.linearRampToValueAtTime(0.045, time + 0.5)
  g.gain.setValueAtTime(0.045, time + dur - 0.4)
  g.gain.linearRampToValueAtTime(0, time + dur)

  filter.connect(g).connect(masterGain)

  for (const f of freqs) {
    for (const detune of [-9, 0, 9]) {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      osc.detune.value = detune
      osc.connect(filter)
      osc.start(time)
      osc.stop(time + dur + 0.05)
    }
  }
}

function playBass(time: number, freq: number, dur: number) {
  const c = ctx
  if (!c || !masterGain) return
  const osc = c.createOscillator()
  osc.type = 'square'
  osc.frequency.value = freq
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 600
  const g = c.createGain()
  g.gain.setValueAtTime(0, time)
  g.gain.linearRampToValueAtTime(0.07, time + 0.005)
  g.gain.setValueAtTime(0.06, time + dur - 0.05)
  g.gain.exponentialRampToValueAtTime(0.001, time + dur)
  osc.connect(filter).connect(g).connect(masterGain)
  osc.start(time)
  osc.stop(time + dur + 0.05)
}

function playArp(time: number, freq: number) {
  const c = ctx
  if (!c || !masterGain) return
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq
  const g = c.createGain()
  const peak = 0.04 * intensity
  g.gain.setValueAtTime(0, time)
  g.gain.linearRampToValueAtTime(peak, time + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.15)
  osc.connect(g).connect(masterGain)
  osc.start(time)
  osc.stop(time + 0.18)
}

function playKick(time: number) {
  const c = ctx
  if (!c || !masterGain) return
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(140, time)
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.09)
  const peak = 0.16 * intensity
  g.gain.setValueAtTime(peak, time)
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.18)
  osc.connect(g).connect(masterGain)
  osc.start(time)
  osc.stop(time + 0.2)
}

function playHat(time: number) {
  const c = ctx
  if (!c || !masterGain) return
  const dur = 0.04
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = c.createBufferSource()
  src.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 7500
  const g = c.createGain()
  g.gain.value = 0.045 * intensity
  src.connect(filter).connect(g).connect(masterGain)
  src.start(time)
}

function scheduleStep(time: number, stepIdx: number, barIdx: number) {
  const chord = PROGRESSION[barIdx]
  // Pad: trigger once per bar at step 0
  if (stepIdx === 0) {
    playPad(time, chord.pad, SIXTEENTH * 16)
  }
  // Bass: quarter notes — steps 0, 4, 8, 12
  if (stepIdx % 4 === 0) {
    playBass(time, chord.bass, SIXTEENTH * 4 - 0.05)
  }
  // Arp: 8th-note pattern (steps 0,2,4,6,8,10,12,14) when intensity > 0.15
  if (intensity > 0.15 && stepIdx % 2 === 0) {
    const arpIdx = (stepIdx / 2) % chord.arp.length
    playArp(time, chord.arp[arpIdx])
  }
  // Kick: 4-on-the-floor at quarter notes when intensity > 0.25
  if (intensity > 0.25 && stepIdx % 4 === 0) {
    playKick(time)
  }
  // Hat: offbeats (2, 6, 10, 14) when intensity > 0.4
  if (intensity > 0.4 && stepIdx % 4 === 2) {
    playHat(time)
  }
}

function scheduler() {
  const c = ctx
  if (!c) return
  // Smooth intensity toward target
  intensity += (intensityTarget - intensity) * 0.08
  while (nextNoteTime < c.currentTime + LOOKAHEAD_S) {
    scheduleStep(nextNoteTime, step, bar)
    nextNoteTime += SIXTEENTH
    step++
    if (step >= 16) {
      step = 0
      bar = (bar + 1) % PROGRESSION.length
    }
  }
  schedulerId = window.setTimeout(scheduler, 25)
}

export const music = {
  start() {
    if (started) return
    const c = getCtx()
    if (!c) return
    if (c.state === 'suspended') c.resume().catch(() => {})
    started = true
    nextNoteTime = c.currentTime + 0.1
    step = 0
    bar = 0
    scheduler()
  },
  stop() {
    if (schedulerId !== null) {
      clearTimeout(schedulerId)
      schedulerId = null
    }
    started = false
  },
  setIntensity(value: number) {
    intensityTarget = Math.max(0, Math.min(1, value))
  },
  setMuted(m: boolean) {
    muted = m
    if (masterGain && ctx) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime)
      masterGain.gain.linearRampToValueAtTime(m ? 0 : 0.7, ctx.currentTime + 0.15)
    }
  },
  isMuted() {
    return muted
  },
  isStarted() {
    return started
  },
}
