import type { BoardSpec, PegSpec, PegType, Base } from './types'

export const BOARD_WIDTH = 600
export const BOARD_HEIGHT = 760
export const PEG_RADIUS = 8
export const TARGET_RADIUS = 11
export const BONUS_RADIUS = 11

const BASES: Base[] = ['A', 'T', 'G', 'C']

function pickBase(seed: number): Base {
  return BASES[seed % 4]
}

function makePeg(x: number, y: number, type: PegType): PegSpec {
  return { x, y, type }
}

function classicGrid(): PegSpec[] {
  const pegs: PegSpec[] = []
  const rows = 9
  const cols = 11
  const startY = 180
  const rowGap = 52
  const colGap = 46
  const totalWidth = (cols - 1) * colGap
  const startX = (BOARD_WIDTH - totalWidth) / 2

  let i = 0
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : colGap / 2
    const colsThisRow = r % 2 === 0 ? cols : cols - 1
    for (let c = 0; c < colsThisRow; c++) {
      const x = startX + offset + c * colGap
      const y = startY + r * rowGap
      const isTarget = (r === 2 && c === 3) || (r === 4 && c === 2) || (r === 4 && c === 6)
        || (r === 6 && c === 4) || (r === 7 && c === 1) || (r === 7 && c === 8)
      const isBonus = (r === 5 && c === 5)
      const type: PegType = isTarget ? 'TARGET' : isBonus ? 'BONUS' : pickBase(i + r * 3)
      pegs.push(makePeg(x, y, type))
      i++
    }
  }
  return pegs
}

function helixBoard(): PegSpec[] {
  const pegs: PegSpec[] = []
  const startY = 160
  const endY = 700
  const steps = 22
  const amplitude = 130
  const centerX = BOARD_WIDTH / 2

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const y = startY + t * (endY - startY)
    const phase = t * Math.PI * 4
    const x1 = centerX + Math.sin(phase) * amplitude
    const x2 = centerX + Math.sin(phase + Math.PI) * amplitude
    const isTarget = i === 4 || i === 10 || i === 16
    const t1: PegType = isTarget ? 'TARGET' : pickBase(i)
    const t2: PegType = isTarget ? 'TARGET' : pickBase(i + 2)
    pegs.push(makePeg(x1, y, t1))
    pegs.push(makePeg(x2, y, t2))
    if (i % 3 === 0) {
      const rungs = 4
      for (let j = 1; j < rungs; j++) {
        const rx = x1 + ((x2 - x1) * j) / rungs
        pegs.push(makePeg(rx, y, pickBase(i + j)))
      }
    }
  }
  pegs.push(makePeg(centerX, 720, 'BONUS'))
  return pegs
}

function gauntletBoard(): PegSpec[] {
  const pegs: PegSpec[] = []
  const startY = 170
  const rowGap = 50
  const rows = 11

  for (let r = 0; r < rows; r++) {
    const y = startY + r * rowGap
    // Edge funnels — pegs that push toward center
    const edgePegs = 4
    for (let i = 0; i < edgePegs; i++) {
      const inset = 30 + i * 28 + (r % 2) * 14
      pegs.push(makePeg(inset, y, pickBase(r + i)))
      pegs.push(makePeg(BOARD_WIDTH - inset, y, pickBase(r + i + 1)))
    }
    if (r % 2 === 0 && r > 0) {
      const isTarget = r === 2 || r === 6 || r === 8
      pegs.push(makePeg(BOARD_WIDTH / 2, y, isTarget ? 'TARGET' : pickBase(r)))
    }
  }
  // Two extra targets near bottom
  pegs.push(makePeg(BOARD_WIDTH / 2 - 80, startY + (rows - 1) * rowGap, 'TARGET'))
  pegs.push(makePeg(BOARD_WIDTH / 2 + 80, startY + (rows - 1) * rowGap, 'TARGET'))
  pegs.push(makePeg(BOARD_WIDTH / 2, 720, 'BONUS'))
  return pegs
}

function spiralBoard(): PegSpec[] {
  // Constant arc-length spiral so pegs are never closer than ~32px (ball can always pass)
  const pegs: PegSpec[] = []
  const cx = BOARD_WIDTH / 2
  const cy = 440
  const minR = 70
  const maxR = 270
  const turns = 2.5
  const arcSpacing = 38

  // Walk along the spiral by integrating arc length
  let angle = 0
  let count = 0
  const targetIndices = new Set([3, 11, 18, 27])
  while (true) {
    const t = angle / (turns * Math.PI * 2)
    if (t >= 1) break
    const radius = minR + t * (maxR - minR)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius * 0.95
    if (y >= 175 && y <= 715 && x >= 40 && x <= BOARD_WIDTH - 40) {
      const isTarget = targetIndices.has(count)
      const isBonus = count === 0
      const type: PegType = isTarget ? 'TARGET' : isBonus ? 'BONUS' : pickBase(count)
      pegs.push(makePeg(x, y, type))
    }
    // Advance angle by arcSpacing/radius
    angle += arcSpacing / Math.max(40, radius)
    count++
    if (count > 200) break // safety
  }
  // Top guide pegs to break up the empty top region
  for (let i = 0; i < 4; i++) {
    pegs.push(makePeg(120 + i * 120, 195, pickBase(i + 99)))
  }
  return pegs
}

function chambersBoard(): PegSpec[] {
  const pegs: PegSpec[] = []
  const chambers = [
    { x: 160, y: 260, r: 80 },
    { x: 440, y: 260, r: 80 },
    { x: 300, y: 430, r: 100 },
    { x: 160, y: 600, r: 80 },
    { x: 440, y: 600, r: 80 },
  ]
  let i = 0
  for (const ch of chambers) {
    const ringPoints = 10
    for (let j = 0; j < ringPoints; j++) {
      const angle = (j / ringPoints) * Math.PI * 2
      const x = ch.x + Math.cos(angle) * ch.r
      const y = ch.y + Math.sin(angle) * ch.r
      const isTarget = j === 0
      pegs.push(makePeg(x, y, isTarget ? 'TARGET' : pickBase(i + j)))
    }
    pegs.push(makePeg(ch.x, ch.y, i % 2 === 0 ? 'BONUS' : pickBase(i)))
    i++
  }
  return pegs
}

function promethionBoss(): PegSpec[] {
  // The Promethion: a wide nanopore channel with 5 gene targets reading downward.
  // Channel half-width is now 85 (was 60) so balls can bounce side-to-side and
  // cover both walls in a single shot.
  const pegs: PegSpec[] = []
  const cx = BOARD_WIDTH / 2
  const channelHalf = 85

  // Top funnel — guides ball into the channel
  for (let i = 0; i < 7; i++) {
    const y = 165 + i * 18
    const inset = 50 + i * 22
    pegs.push(makePeg(cx - inset, y, pickBase(i)))
    pegs.push(makePeg(cx + inset, y, pickBase(i + 1)))
  }
  // Pore channel walls
  for (let i = 0; i < 8; i++) {
    const y = 320 + i * 32
    pegs.push(makePeg(cx - channelHalf, y, pickBase(i)))
    pegs.push(makePeg(cx + channelHalf, y, pickBase(i + 2)))
  }
  // 5 gene targets, alternating sides inside the wider channel — easier to land hits
  const targetYs = [330, 388, 446, 504, 562]
  for (let i = 0; i < targetYs.length; i++) {
    const x = cx + (i % 2 === 0 ? -28 : 28)
    pegs.push(makePeg(x, targetYs[i], 'TARGET'))
  }
  // Bottom flare
  for (let i = 0; i < 5; i++) {
    const y = 605 + i * 22
    const inset = 50 + i * 32
    pegs.push(makePeg(cx - inset, y, pickBase(i + 3)))
    pegs.push(makePeg(cx + inset, y, pickBase(i + 5)))
  }
  pegs.push(makePeg(cx - 100, 705, 'BONUS'))
  pegs.push(makePeg(cx + 100, 705, 'BONUS'))
  return pegs
}

function centrifugeBoss(): PegSpec[] {
  // Concentric rings — clear all 8 target pegs distributed across rings
  const pegs: PegSpec[] = []
  const cx = BOARD_WIDTH / 2
  const cy = 440
  const rings = [
    { r: 70, count: 8 },
    { r: 130, count: 14 },
    { r: 195, count: 20 },
    { r: 260, count: 26 },
  ]
  let i = 0
  for (const ring of rings) {
    const targetEvery = Math.floor(ring.count / 2)
    for (let n = 0; n < ring.count; n++) {
      const angle = (n / ring.count) * Math.PI * 2
      const x = cx + Math.cos(angle) * ring.r
      const y = cy + Math.sin(angle) * ring.r * 0.65
      if (y < 150 || y > 720 || x < 25 || x > BOARD_WIDTH - 25) continue
      const isTarget = (n === 0 && ring.r > 100) || (ring.r > 150 && n === targetEvery) || (ring.r > 200 && n === Math.floor(ring.count / 4))
      pegs.push(makePeg(x, y, isTarget ? 'TARGET' : pickBase(i + n)))
    }
    i += 1
  }
  pegs.push(makePeg(cx, cy, 'BONUS'))
  return pegs
}

export const BOARDS: BoardSpec[] = [
  { id: 'classic', name: 'Standard Pegboard', description: 'Hex grid · 6 genes', pegs: classicGrid() },
  { id: 'helix', name: 'Double Helix', description: 'Twisted strand · 6 genes', pegs: helixBoard() },
  { id: 'gauntlet', name: 'Sequencing Gauntlet', description: 'Funnel walls · 5 genes', pegs: gauntletBoard() },
  { id: 'spiral', name: 'Centrifuge Spiral', description: 'Spinning ring · 4 genes', pegs: spiralBoard() },
  { id: 'chambers', name: 'Reaction Chambers', description: 'Five rings · 5 genes', pegs: chambersBoard() },
]

const _promethion: BoardSpec = { id: 'boss-promethion', name: 'THE PROMETHION', description: 'Boss · 5 genes · the nanopore', pegs: promethionBoss() }
const _centrifuge: BoardSpec = { id: 'boss-centrifuge', name: 'CENTRIFUGE CORE', description: 'Boss · 6 genes · concentric chaos', pegs: centrifugeBoss() }

export const BOSS_BOARDS: BoardSpec[] = [_promethion, _centrifuge]

export function isBossBoard(board: BoardSpec): boolean {
  return board.id.startsWith('boss-')
}

export function isAnomalyBoard(board: BoardSpec): boolean {
  return board.id.startsWith('anomaly-')
}

export function getBoardForAnte(ante: number, totalAntes: number = 8): BoardSpec {
  if (ante === totalAntes) return _promethion // Daily ends with Promethion
  return BOARDS[(ante - 1) % BOARDS.length]
}

export function getBossBoard(rng: () => number): BoardSpec {
  return BOSS_BOARDS[Math.floor(rng() * BOSS_BOARDS.length)]
}

// Anomaly variant: pick a base board and convert two random non-target pegs to
// gene targets. Anomaly boards always have +2 genes vs. their base.
export function generateAnomalyBoard(rng: () => number): BoardSpec {
  const base = BOARDS[Math.floor(rng() * BOARDS.length)]
  const newPegs: PegSpec[] = base.pegs.map(p => ({ ...p }))
  const candidateIndices: number[] = []
  for (let i = 0; i < newPegs.length; i++) {
    if (newPegs[i].type !== 'TARGET' && newPegs[i].type !== 'BONUS') candidateIndices.push(i)
  }
  // Pick two from the upper-middle area so they don't all cluster at the bottom
  candidateIndices.sort((a, b) => newPegs[a].y - newPegs[b].y)
  const upperPool = candidateIndices.slice(0, Math.max(8, Math.floor(candidateIndices.length * 0.6)))
  for (let i = 0; i < 2 && upperPool.length > 0; i++) {
    const k = Math.floor(rng() * upperPool.length)
    const pegIdx = upperPool[k]
    newPegs[pegIdx].type = 'TARGET'
    upperPool.splice(k, 1)
  }
  // Update description: bump gene count by 2 if it has a "N genes" phrase
  const description = base.description.replace(/(\d+)(\s+genes?)/, (_m, n: string, rest: string) => {
    return String(parseInt(n, 10) + 2) + rest
  })
  return {
    id: 'anomaly-' + base.id,
    name: 'ANOMALY · ' + base.name,
    description,
    pegs: newPegs,
  }
}

export function targetPegCount(board: BoardSpec): number {
  return board.pegs.filter(p => p.type === 'TARGET').length
}
