import type { CampaignMap, MapNode, NodeType } from '@/lib/game/map'
import { nodeBlurb, nodeLabel } from '@/lib/game/map'
import type { RunState } from '@/lib/game/types'
import type { CharacterSpec } from '@/lib/game/characters'

interface Props {
  map: CampaignMap
  currentNodeId: string | null // null when player hasn't picked the start yet
  visitedNodeIds: Set<string>
  run: RunState
  character: CharacterSpec | null
  onPickNode: (nodeId: string) => void
}

const NODE_STYLES: Record<NodeType, { color: string; glow: string; emoji: string; label: string }> = {
  standard: { color: '#22d3ee', glow: 'rgba(34,211,238,0.7)', emoji: '🧫', label: 'Sample' },
  hard: { color: '#fb7185', glow: 'rgba(251,113,133,0.8)', emoji: '☣️', label: 'Anomaly' },
  lab: { color: '#fde047', glow: 'rgba(253,224,71,0.85)', emoji: '⚡', label: 'Lab' },
  rest: { color: '#34d399', glow: 'rgba(52,211,153,0.7)', emoji: '🧪', label: 'Resupply' },
  boss: { color: '#e879f9', glow: 'rgba(232,121,249,1)', emoji: '🧬', label: 'BOSS' },
}

export function MapScreen({ map, currentNodeId, visitedNodeIds, run, character, onPickNode }: Props) {
  // Available nodes: if no current, only the start (row 0). Otherwise, the current node's `next`.
  const availableNodeIds = new Set<string>()
  if (!currentNodeId) {
    map.byRow[0].forEach(id => availableNodeIds.add(id))
  } else {
    const cur = map.nodes[currentNodeId]
    cur.next.forEach(id => availableNodeIds.add(id))
  }

  return (
    <div
      className="min-h-screen bg-[#0a0420] text-white relative"
      style={{
        backgroundImage: 'radial-gradient(ellipse at top, rgba(232,121,249,0.18), transparent 60%), radial-gradient(ellipse at bottom, rgba(34,211,238,0.15), transparent 60%)',
      }}
    >
      {/* Header */}
      <div className="border-b-2 border-fuchsia-500/30 px-5 py-3 flex items-center justify-between backdrop-blur bg-black/20">
        <div className="flex items-center gap-3">
          <span className="inline-block w-3 h-3 bg-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.9)]" />
          <span className="text-[10px] tracking-[0.3em] text-fuchsia-300 font-mono font-bold">
            BIOKEA · LDC · CAMPAIGN
          </span>
        </div>
        <div className="text-[10px] text-cyan-300 font-mono tracking-widest">
          SCORE · {run.score.toLocaleString()}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Run state sidebar */}
        <div className="lg:w-64 w-full space-y-4">
          {character && (
            <div
              className="border-2 bg-black/40 p-4 rounded-sm flex items-center gap-3"
              style={{ borderColor: character.color, boxShadow: `0 0 16px ${character.glow}` }}
            >
              <div className="text-3xl">{character.emoji}</div>
              <div>
                <div className="text-[9px] tracking-[0.3em] font-mono" style={{ color: character.color }}>
                  {character.title}
                </div>
                <div className="text-base font-black" style={{ color: character.color }}>
                  {character.name}
                </div>
              </div>
            </div>
          )}
          <div className="border border-fuchsia-500/30 bg-black/30 p-4 rounded-sm">
            <div className="text-[9px] tracking-[0.3em] text-fuchsia-300 font-mono mb-2">CHOOSE YOUR PATH</div>
            <div className="text-sm text-slate-300 leading-relaxed">
              Pick a node to play next. Each path leads upward to the boss. Plan your route — labs and resupplies are limited.
            </div>
          </div>

          {run.upgrades.length > 0 && (
            <div className="border border-cyan-500/20 bg-black/30 p-4 rounded-sm">
              <div className="text-[9px] tracking-[0.3em] text-cyan-300 font-mono mb-2">LAB BENCH</div>
              <div className="space-y-1.5">
                {run.upgrades.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 text-xs">
                    <span className="text-base">{u.emoji}</span>
                    <span className="font-mono text-slate-200">{u.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border border-cyan-500/20 bg-black/30 p-4 rounded-sm">
            <div className="text-[9px] tracking-[0.3em] text-cyan-300 font-mono mb-2">LEGEND</div>
            <div className="space-y-1.5 text-[11px]">
              {(['standard', 'hard', 'lab', 'rest', 'boss'] as NodeType[]).map(t => (
                <div key={t} className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px]"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      border: `1px solid ${NODE_STYLES[t].color}`,
                      boxShadow: `0 0 6px ${NODE_STYLES[t].glow}`,
                    }}
                  >
                    {NODE_STYLES[t].emoji}
                  </span>
                  <span className="text-slate-300">{NODE_STYLES[t].label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* The map */}
        <div className="flex-1 max-w-2xl mx-auto">
          <div
            className="relative w-full bg-black/30 border-2 border-fuchsia-500/30 rounded-sm overflow-hidden"
            style={{ height: 'min(80vh, 720px)', minHeight: '560px' }}
          >
            {/* SVG edges layer */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {Object.values(map.nodes).flatMap((node) =>
                node.next.map((toId) => {
                  const to = map.nodes[toId]
                  const fromVisited = visitedNodeIds.has(node.id)
                  const fromIsCurrent = node.id === currentNodeId
                  const onPath = fromIsCurrent && availableNodeIds.has(toId)
                  const past = fromVisited && visitedNodeIds.has(toId)
                  const stroke = past
                    ? 'rgba(34,211,238,0.6)'
                    : onPath
                    ? 'rgba(232,121,249,0.9)'
                    : 'rgba(255,255,255,0.1)'
                  const width = onPath ? 0.6 : past ? 0.5 : 0.3
                  return (
                    <line
                      key={`${node.id}-${toId}`}
                      x1={node.x * 100}
                      y1={5 + node.y * 90}
                      x2={to.x * 100}
                      y2={5 + to.y * 90}
                      stroke={stroke}
                      strokeWidth={width}
                      strokeDasharray={onPath ? '0' : past ? '0' : '1.5 1.5'}
                    />
                  )
                })
              )}
            </svg>

            {/* Nodes layer */}
            {Object.values(map.nodes).map((node) => {
              const isAvailable = availableNodeIds.has(node.id)
              const isCurrent = node.id === currentNodeId
              const isVisited = visitedNodeIds.has(node.id)
              return (
                <NodeButton
                  key={node.id}
                  node={node}
                  isAvailable={isAvailable}
                  isCurrent={isCurrent}
                  isVisited={isVisited}
                  onClick={() => isAvailable && onPickNode(node.id)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function NodeButton({
  node,
  isAvailable,
  isCurrent,
  isVisited,
  onClick,
}: {
  node: MapNode
  isAvailable: boolean
  isCurrent: boolean
  isVisited: boolean
  onClick: () => void
}) {
  const style = NODE_STYLES[node.type]
  const size = node.type === 'boss' ? 56 : 44

  return (
    <button
      onClick={onClick}
      disabled={!isAvailable}
      className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all ${isAvailable ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
      style={{
        left: `${node.x * 100}%`,
        top: `${5 + node.y * 90}%`,
        width: size,
        height: size,
      }}
      title={`${nodeLabel(node.type)} — ${nodeBlurb(node.type)}`}
    >
      <div
        className={`relative w-full h-full rounded-full flex items-center justify-center text-lg ${isAvailable ? 'animate-pulse' : ''}`}
        style={{
          backgroundColor: isCurrent ? style.color : isVisited ? 'rgba(20,8,48,0.6)' : isAvailable ? 'rgba(20,8,48,0.9)' : 'rgba(8,4,20,0.7)',
          border: `2px solid ${isAvailable || isCurrent ? style.color : isVisited ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.15)'}`,
          boxShadow: isAvailable ? `0 0 18px ${style.glow}` : isCurrent ? `0 0 24px ${style.glow}` : 'none',
          opacity: isVisited && !isCurrent ? 0.45 : 1,
        }}
      >
        <span style={{ filter: !isAvailable && !isCurrent && !isVisited ? 'grayscale(0.6)' : 'none' }}>{style.emoji}</span>
        {node.type === 'boss' && (
          <span
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold tracking-[0.2em] whitespace-nowrap"
            style={{ color: style.color, textShadow: `0 0 6px ${style.glow}` }}
          >
            BOSS
          </span>
        )}
      </div>
    </button>
  )
}
