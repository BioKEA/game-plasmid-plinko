import type { Upgrade } from './types'

export const UPGRADES: Upgrade[] = [
  {
    id: 'sticky-poly',
    name: 'Sticky Polymerase',
    rarity: 'common',
    emoji: '🧪',
    description: 'Pegs you hit linger longer, building bigger chains.',
  },
  {
    id: 'wide-launcher',
    name: 'Wide Pipette',
    rarity: 'common',
    emoji: '💧',
    description: 'See a longer aiming guide line on every shot.',
  },
  {
    id: 'extra-ball',
    name: 'Spare Aliquot',
    rarity: 'common',
    emoji: '🧫',
    description: '+1 ball at the start of every level.',
  },
  {
    id: 'big-catcher',
    name: 'Wider Eluent Bath',
    rarity: 'common',
    emoji: '🪣',
    description: 'The catcher bucket is 50% wider.',
  },
  {
    id: 'crispr',
    name: 'CRISPR Scissors',
    rarity: 'rare',
    emoji: '✂️',
    description: 'First peg hit each shot is +5× score.',
  },
  {
    id: 'branching',
    name: 'Branching Primer',
    rarity: 'rare',
    emoji: '🌿',
    description: 'Every 5th peg in a chain spawns a tiny secondary spark of points.',
  },
  {
    id: 'magnetic',
    name: 'Magnetic Beads',
    rarity: 'rare',
    emoji: '🧲',
    description: 'Ball curves slightly toward the nearest target peg.',
  },
  {
    id: 'low-grav',
    name: 'Buffer Drift',
    rarity: 'rare',
    emoji: '🌊',
    description: 'Gravity is slightly weaker — more bounces, more chains.',
  },
  {
    id: 'jackpot',
    name: 'Jackpot Cycle',
    rarity: 'legendary',
    emoji: '💎',
    description: 'Every 25th peg cleared awards a massive +5000 jackpot.',
  },
  {
    id: 'free-shot',
    name: 'Recombinant DNA',
    rarity: 'legendary',
    emoji: '🧬',
    description: 'Catching the ball gives you 2 balls back instead of 1.',
  },
  {
    id: 'target-bonus',
    name: 'Promethion Boost',
    rarity: 'legendary',
    emoji: '⚡',
    description: 'Target pegs are worth 3× score and clearing one adds +1 ball.',
  },
]

export function rollUpgradeChoices(
  currentUpgrades: Upgrade[],
  count: number = 3,
  rng: () => number = Math.random,
): Upgrade[] {
  const owned = new Set(currentUpgrades.map(u => u.id))
  const pool = UPGRADES.filter(u => !owned.has(u.id))
  if (pool.length === 0) return []

  const weighted = pool.flatMap(u => {
    const weight = u.rarity === 'common' ? 4 : u.rarity === 'rare' ? 2 : 1
    return Array(weight).fill(u)
  })

  const picks: Upgrade[] = []
  const seen = new Set<string>()
  while (picks.length < count && seen.size < pool.length) {
    const choice = weighted[Math.floor(rng() * weighted.length)]
    if (!seen.has(choice.id)) {
      picks.push(choice)
      seen.add(choice.id)
    }
  }
  return picks
}

export function hasUpgrade(upgrades: Upgrade[], id: string): boolean {
  return upgrades.some(u => u.id === id)
}
