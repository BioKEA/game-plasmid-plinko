export type PowerupId = 'multiball' | 'magnet' | 'timewarp' | 'lysis'

export interface PowerupSpec {
  id: PowerupId
  name: string
  shortName: string
  emoji: string
  color: string
  description: string
  flavor: string
}

export const POWERUPS: Record<PowerupId, PowerupSpec> = {
  multiball: {
    id: 'multiball',
    name: 'Plasmid Burst',
    shortName: 'BURST',
    emoji: '🌟',
    color: '#fde047',
    description: 'Next ball splits into 3 on first peg hit.',
    flavor: 'multi-ball pyrotechnics',
  },
  magnet: {
    id: 'magnet',
    name: 'Magnetism',
    shortName: 'MAG',
    emoji: '🧲',
    color: '#22d3ee',
    description: 'Next ball curves toward the nearest gene peg.',
    flavor: 'guided primer',
  },
  timewarp: {
    id: 'timewarp',
    name: 'Buffer Time',
    shortName: 'WARP',
    emoji: '🐢',
    color: '#a78bfa',
    description: 'Next shot has slow gravity — more bounces, more chains.',
    flavor: 'thicker reagents',
  },
  lysis: {
    id: 'lysis',
    name: 'Mass Lysis',
    shortName: 'LYSE',
    emoji: '💥',
    color: '#fb7185',
    description: 'First peg hit clears every peg in a wide blast.',
    flavor: 'no peg survives',
  },
}

export const POWERUP_LIST: PowerupSpec[] = Object.values(POWERUPS)

export type PowerupCharges = Record<PowerupId, number>

export function emptyCharges(): PowerupCharges {
  return { multiball: 0, magnet: 0, timewarp: 0, lysis: 0 }
}

export function totalCharges(c: PowerupCharges): number {
  return c.multiball + c.magnet + c.timewarp + c.lysis
}
