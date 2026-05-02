export type Base = 'A' | 'T' | 'G' | 'C'
export type PegType = Base | 'TARGET' | 'BONUS'

export interface PegSpec {
  x: number
  y: number
  type: PegType
}

export interface BoardSpec {
  id: string
  name: string
  description: string
  pegs: PegSpec[]
}

export interface Upgrade {
  id: string
  name: string
  rarity: 'common' | 'rare' | 'legendary'
  description: string
  emoji: string
}

export interface RunState {
  ante: number
  score: number
  bases: Record<Base, number>
  upgrades: Upgrade[]
  ballsRemaining: number
}

export interface LevelState {
  board: BoardSpec
  hitPegs: Set<number>
  clearedPegs: Set<number>
  targetsRemaining: number
  shotInFlight: boolean
  shotChainCount: number
  shotChainScore: number
}

export type Screen = 'menu' | 'playing' | 'level-complete' | 'upgrade' | 'game-over'
