// Seedable PRNG (mulberry32) for deterministic Daily-mode runs.
export type RNG = () => number

export function mulberry32(seed: number): RNG {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 0x811c9dc5 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// UTC so every game in the BioKEA suite agrees on which day "today"
// is. Codon Collider seeds daily mode in UTC and the central
// /mission/games/leaderboard page reads UTC; using local time here
// produced silent score misses for users west of UTC.
export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function dayNumber(launchDate: string, d = new Date()): number {
  const launch = new Date(launchDate + 'T00:00:00')
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const ms = today.getTime() - launch.getTime()
  return Math.max(1, Math.floor(ms / 86400000) + 1)
}

export function pick<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function shuffled<T>(rng: RNG, arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
