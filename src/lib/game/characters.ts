import type { Upgrade } from './types'
import type { PowerupCharges } from './powerups'
import { emptyCharges } from './powerups'
import { UPGRADES } from './upgrades'

export type CharacterId = 'biologist' | 'engineer' | 'surgeon' | 'alchemist'

export interface CharacterStats {
  ballsBonus: number
  catcherWidthMultiplier: number
  scoreMultiplier: number
  catchExtraBalls: number // +1 = caught ball gives 2 instead of 1
}

export interface CharacterSpec {
  id: CharacterId
  name: string
  title: string
  emoji: string
  color: string
  glow: string
  description: string
  flavor: string
  stats: CharacterStats
  startingUpgrades: string[] // upgrade ids built in for free
  powerupsPerLevel: PowerupCharges // refilled at the start of each level
  difficulty: 'beginner' | 'standard' | 'expert' | 'unique'
}

export const CHARACTERS: Record<CharacterId, CharacterSpec> = {
  biologist: {
    id: 'biologist',
    name: 'BIOLOGIST',
    title: 'The All-Rounder',
    emoji: '🧬',
    color: '#22d3ee',
    glow: 'rgba(34,211,238,0.7)',
    description: '+1 ball every level. 1 random powerup per level.',
    flavor: 'Steady hand. Wide bench. Forgiving runs.',
    stats: { ballsBonus: 1, catcherWidthMultiplier: 1, scoreMultiplier: 1, catchExtraBalls: 0 },
    startingUpgrades: [],
    powerupsPerLevel: emptyCharges(), // resolved per-level (random) at runtime
    difficulty: 'beginner',
  },
  engineer: {
    id: 'engineer',
    name: 'ENGINEER',
    title: 'The Defender',
    emoji: '⚙️',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.75)',
    description: 'Wider catcher. Catches give +2 balls. But pegs score 15% less.',
    flavor: 'Built to last. Slow burn. Long runs.',
    stats: { ballsBonus: 0, catcherWidthMultiplier: 1.5, scoreMultiplier: 0.85, catchExtraBalls: 1 },
    startingUpgrades: ['big-catcher', 'free-shot'],
    powerupsPerLevel: { ...emptyCharges(), magnet: 1 },
    difficulty: 'standard',
  },
  surgeon: {
    id: 'surgeon',
    name: 'SURGEON',
    title: 'The Glass Cannon',
    emoji: '✂️',
    color: '#fb7185',
    glow: 'rgba(251,113,133,0.85)',
    description: 'CRISPR built in. +15% to all scores. But −1 ball per level.',
    flavor: 'High burst, low margin. Aim true.',
    stats: { ballsBonus: -1, catcherWidthMultiplier: 1, scoreMultiplier: 1.15, catchExtraBalls: 0 },
    startingUpgrades: ['crispr'],
    powerupsPerLevel: { ...emptyCharges(), lysis: 1 },
    difficulty: 'expert',
  },
  alchemist: {
    id: 'alchemist',
    name: 'ALCHEMIST',
    title: 'The Tactician',
    emoji: '🧙',
    color: '#e879f9',
    glow: 'rgba(232,121,249,0.85)',
    description: 'No passives. But starts each level with one of every powerup.',
    flavor: 'Powerup chess. Bend the run to your will.',
    stats: { ballsBonus: 0, catcherWidthMultiplier: 1, scoreMultiplier: 1, catchExtraBalls: 0 },
    startingUpgrades: ['branching'],
    powerupsPerLevel: { multiball: 1, magnet: 1, timewarp: 1, lysis: 1 },
    difficulty: 'unique',
  },
}

export const CHARACTER_LIST: CharacterSpec[] = Object.values(CHARACTERS)

export function resolveStartingUpgrades(c: CharacterSpec): Upgrade[] {
  return c.startingUpgrades
    .map(id => UPGRADES.find(u => u.id === id))
    .filter((u): u is Upgrade => !!u)
}
