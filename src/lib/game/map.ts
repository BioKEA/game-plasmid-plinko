import type { RNG } from './rng'

export type NodeType = 'standard' | 'hard' | 'lab' | 'rest' | 'boss'

export interface MapNode {
  id: string
  type: NodeType
  row: number
  col: number
  x: number // 0..1 layout
  y: number // 0..1 layout
  next: string[] // ids of next-row nodes this node connects to
}

export interface CampaignMap {
  nodes: Record<string, MapNode>
  byRow: string[][] // node ids per row
  rows: number
}

const ROWS = 5 // including the boss row
const COLS = 4 // max per row

const MIDDLE_TYPES: NodeType[] = ['standard', 'standard', 'standard', 'hard', 'lab', 'rest']

export function generateMap(rng: RNG): CampaignMap {
  const nodes: Record<string, MapNode> = {}
  const byRow: string[][] = []

  for (let r = 0; r < ROWS; r++) {
    const rowNodes: string[] = []
    if (r === 0) {
      // Single start node
      const id = `r${r}c0`
      nodes[id] = { id, type: 'standard', row: r, col: 0, x: 0.5, y: y(r), next: [] }
      rowNodes.push(id)
    } else if (r === ROWS - 1) {
      // Boss row — single node
      const id = `r${r}c0`
      nodes[id] = { id, type: 'boss', row: r, col: 0, x: 0.5, y: y(r), next: [] }
      rowNodes.push(id)
    } else {
      // Middle rows: 2-3 nodes
      const count = r === ROWS - 2 ? 2 : 2 + Math.floor(rng() * 2) // 2 or 3
      const cols = pickCols(rng, count)
      for (let i = 0; i < count; i++) {
        const col = cols[i]
        const id = `r${r}c${col}`
        const type = chooseType(rng, r)
        nodes[id] = { id, type, row: r, col, x: (col + 0.5) / COLS, y: y(r), next: [] }
        rowNodes.push(id)
      }
    }
    byRow.push(rowNodes)
  }

  // Build edges from each row to the next row
  for (let r = 0; r < ROWS - 1; r++) {
    const here = byRow[r]
    const next = byRow[r + 1]
    for (const fromId of here) {
      const from = nodes[fromId]
      if (next.length === 1) {
        from.next = [next[0]]
        continue
      }
      // Pick 1-2 next nodes by horizontal proximity
      const distances = next
        .map((nid) => ({ id: nid, d: Math.abs(nodes[nid].x - from.x) }))
        .sort((a, b) => a.d - b.d)
      const pickCount = next.length >= 3 && rng() < 0.45 ? 2 : 1
      from.next = distances.slice(0, pickCount).map((x) => x.id)
    }
    // Ensure every next-row node is reachable
    const reachable = new Set<string>()
    for (const fromId of here) for (const nid of nodes[fromId].next) reachable.add(nid)
    for (const nid of next) {
      if (!reachable.has(nid)) {
        const closest = here
          .map((fid) => ({ id: fid, d: Math.abs(nodes[fid].x - nodes[nid].x) }))
          .sort((a, b) => a.d - b.d)[0]
        nodes[closest.id].next = [...new Set([...nodes[closest.id].next, nid])]
      }
    }
  }

  return { nodes, byRow, rows: ROWS }
}

function y(r: number): number {
  return 1 - r / (ROWS - 1)
}

function pickCols(rng: RNG, count: number): number[] {
  // Pick `count` distinct cols spread across [0, COLS-1]
  const all = Array.from({ length: COLS }, (_, i) => i)
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.slice(0, count).sort((a, b) => a - b)
}

function chooseType(rng: RNG, row: number): NodeType {
  // Last middle row = always lab or hard (never rest)
  if (row === ROWS - 2) return rng() < 0.5 ? 'lab' : 'hard'
  return MIDDLE_TYPES[Math.floor(rng() * MIDDLE_TYPES.length)]
}

export function nodeLabel(t: NodeType): string {
  switch (t) {
    case 'standard': return 'Sample'
    case 'hard': return 'Anomaly'
    case 'lab': return 'Lab'
    case 'rest': return 'Reagent Resupply'
    case 'boss': return 'BOSS'
  }
}

export function nodeBlurb(t: NodeType): string {
  switch (t) {
    case 'standard': return 'Routine sample. 6 genes to clear.'
    case 'hard': return 'Tougher board with more genes. +50% reward.'
    case 'lab': return 'Pick from 4 upgrades instead of 3.'
    case 'rest': return 'Refill all balls. No board to play.'
    case 'boss': return 'The Promethion or the Centrifuge — final test.'
  }
}
