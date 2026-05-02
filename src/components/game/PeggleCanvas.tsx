import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import type { BoardSpec, Upgrade, Base, PegType } from '@/lib/game/types'
import { BOARD_WIDTH, BOARD_HEIGHT, PEG_RADIUS, TARGET_RADIUS, BONUS_RADIUS, isAnomalyBoard, isBossBoard } from '@/lib/game/boards'
import { hasUpgrade } from '@/lib/game/upgrades'
import { sfx } from '@/lib/game/audio'
import { music } from '@/lib/game/music'
import type { PowerupCharges, PowerupId } from '@/lib/game/powerups'
import { PowerupBar } from '@/components/game/PowerupBar'

interface PegRuntime {
  body: Matter.Body
  spec: { x: number; y: number; type: PegType }
  index: number
  hit: boolean
  cleared: boolean
  flashUntil: number
  clearAt: number // timestamp at which the peg auto-clears; 0 = never
  bonusApplied: boolean // tracks target-bonus +1 ball so we don't double-fire
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface ScorePop {
  x: number
  y: number
  text: string
  color: string
  born: number
  size?: number
  driftX?: number
}

interface MilestonePop {
  text: string
  color: string
  born: number
}

const CHAIN_MILESTONES: Record<number, { text: string; color: string }> = {
  5: { text: 'NICE!', color: '#fbbf24' },
  10: { text: 'GREAT!', color: '#fb923c' },
  15: { text: 'AMAZING!', color: '#e879f9' },
  20: { text: 'EXTREME!', color: '#fb7185' },
  25: { text: 'GENOME BLAST!', color: '#ef4444' },
}

function chainColor(chain: number): { fill: string; glow: string } {
  if (chain >= 25) return { fill: '#ef4444', glow: 'rgba(239,68,68,' }
  if (chain >= 15) return { fill: '#e879f9', glow: 'rgba(232,121,249,' }
  if (chain >= 10) return { fill: '#fb923c', glow: 'rgba(251,146,60,' }
  if (chain >= 5) return { fill: '#fbbf24', glow: 'rgba(251,191,36,' }
  return { fill: '#22d3ee', glow: 'rgba(34,211,238,' }
}

export interface LevelResult {
  score: number
  bases: Record<Base, number>
  ballsLeft: number
  targetsCleared: number
  totalTargets: number
  win: boolean
}

interface Props {
  board: BoardSpec
  upgrades: Upgrade[]
  initialBalls: number
  charges: PowerupCharges
  scoreMultiplier: number
  catcherWidthMultiplier: number
  catchExtraBalls: number
  onComplete: (result: LevelResult) => void
  onPowerupConsumed: (id: PowerupId) => void
  onChainPeak: (chainCount: number) => void
  onJackpot: () => void
  onGenePegCleared: () => void
}

const BASE_COLORS: Record<PegType, { fill: string; glow: string }> = {
  A: { fill: '#34d399', glow: 'rgba(52,211,153,0.7)' },
  T: { fill: '#fb7185', glow: 'rgba(251,113,133,0.7)' },
  G: { fill: '#fbbf24', glow: 'rgba(251,191,36,0.7)' },
  C: { fill: '#38bdf8', glow: 'rgba(56,189,248,0.7)' },
  TARGET: { fill: '#e879f9', glow: 'rgba(232,121,249,1)' },
  BONUS: { fill: '#fde047', glow: 'rgba(253,224,71,1)' },
}

const BALL_RADIUS = 9
const CATCHER_WIDTH = 90
const CATCHER_HEIGHT = 18
const CATCHER_Y = BOARD_HEIGHT - 22
// Hit pegs auto-clear PEG_HIT_LIFETIME_MS after being hit, fading out over the final PEG_FADE_MS.
const PEG_HIT_LIFETIME_MS = 3000
const PEG_FADE_MS = 380

export function PeggleCanvas({
  board,
  upgrades,
  initialBalls,
  charges,
  scoreMultiplier,
  catcherWidthMultiplier,
  catchExtraBalls,
  onComplete,
  onPowerupConsumed,
  onChainPeak,
  onJackpot,
  onGenePegCleared,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const engineRef = useRef<Matter.Engine | null>(null)
  const ballsListRef = useRef<Matter.Body[]>([])
  const pegsRef = useRef<PegRuntime[]>([])
  const catcherRef = useRef<Matter.Body | null>(null)
  const catcherDirRef = useRef(1)
  const caughtCountRef = useRef(0)
  const ballInFlightRef = useRef(false)
  const aimRef = useRef({ x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 })
  const particlesRef = useRef<Particle[]>([])
  const scorePopsRef = useRef<ScorePop[]>([])
  const milestoneRef = useRef<MilestonePop | null>(null)
  const shakeRef = useRef(0)
  const upgradesRef = useRef<Upgrade[]>(upgrades)
  const pegsClearedTotalRef = useRef(0)
  const armedPowerupRef = useRef<PowerupId | null>(null)
  const firstPegThisShotRef = useRef(false)
  const peakChainThisShotRef = useRef(0)
  const magnetThisShotRef = useRef(false)
  const shotStartTimeRef = useRef(0)
  // Position-displacement stuck detection: ring buffer of recent (x,y,t)
  // samples per ball. A ball is "stuck" if its bounding box over the last 1.2s
  // is smaller than ~30px in any dimension. Robust to fast wedge-rattling.
  const ballPositionsRef = useRef<Map<number, { x: number; y: number; t: number }[]>>(new Map())
  const stuckSinceRef = useRef(0)
  // Fever mode — triggered when the last gene peg falls; player loses control,
  // ball auto-bounces through everything for big bonus points.
  const feverActiveRef = useRef(false)
  const feverStartTimeRef = useRef(0)
  const feverScoreRef = useRef(0)
  const trailsRef = useRef<Map<number, { x: number; y: number; t: number }[]>>(new Map())

  const [armedPowerup, setArmedPowerup] = useState<PowerupId | null>(null)
  const [stuckWarning, setStuckWarning] = useState(false)

  const [score, setScore] = useState(0)
  const [bases, setBases] = useState<Record<Base, number>>({ A: 0, T: 0, G: 0, C: 0 })
  const [ballsRemaining, setBallsRemaining] = useState(initialBalls)
  const [targetsRemaining, setTargetsRemaining] = useState(
    board.pegs.filter(p => p.type === 'TARGET').length
  )
  const [shotChain, setShotChain] = useState(0)
  const [shotChainScore, setShotChainScore] = useState(0)

  // Live refs so the physics loop reads current values
  const scoreRef = useRef(score)
  const basesRef = useRef(bases)
  const ballsRef = useRef(ballsRemaining)
  const targetsRef = useRef(targetsRemaining)
  const shotChainRef = useRef(0)
  const shotChainScoreRef = useRef(0)
  const completedRef = useRef(false)

  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { basesRef.current = bases }, [bases])
  useEffect(() => { ballsRef.current = ballsRemaining }, [ballsRemaining])
  useEffect(() => { targetsRef.current = targetsRemaining }, [targetsRemaining])
  useEffect(() => { upgradesRef.current = upgrades }, [upgrades])

  // Catcher size: combine the upgrade and the character's catcher multiplier
  const catcherWidth = (hasUpgrade(upgrades, 'big-catcher') ? CATCHER_WIDTH * 1.5 : CATCHER_WIDTH) * catcherWidthMultiplier

  // Build the world once per board
  useEffect(() => {
    completedRef.current = false
    pegsClearedTotalRef.current = 0
    feverActiveRef.current = false
    feverScoreRef.current = 0
    trailsRef.current.clear()
    setScore(0)
    setBases({ A: 0, T: 0, G: 0, C: 0 })
    setBallsRemaining(initialBalls)
    setTargetsRemaining(board.pegs.filter(p => p.type === 'TARGET').length)
    setShotChain(0)
    setShotChainScore(0)

    const engine = Matter.Engine.create()
    engine.gravity.y = hasUpgrade(upgradesRef.current, 'low-grav') ? 0.55 : 0.7
    engineRef.current = engine

    const world = engine.world
    // Walls
    const wallOpts = { isStatic: true, restitution: 0.5, friction: 0, render: { visible: false } }
    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(BOARD_WIDTH / 2, -25, BOARD_WIDTH, 50, wallOpts),
      Matter.Bodies.rectangle(-25, BOARD_HEIGHT / 2, 50, BOARD_HEIGHT * 2, wallOpts),
      Matter.Bodies.rectangle(BOARD_WIDTH + 25, BOARD_HEIGHT / 2, 50, BOARD_HEIGHT * 2, wallOpts),
    ])

    // Pegs
    const pegRuntimes: PegRuntime[] = board.pegs.map((spec, index) => {
      const radius = spec.type === 'TARGET' ? TARGET_RADIUS : spec.type === 'BONUS' ? BONUS_RADIUS : PEG_RADIUS
      const body = Matter.Bodies.circle(spec.x, spec.y, radius, {
        isStatic: true,
        restitution: 0.85,
        friction: 0,
        label: `peg-${index}`,
      })
      Matter.Composite.add(world, body)
      return { body, spec, index, hit: false, cleared: false, flashUntil: 0, clearAt: 0, bonusApplied: false }
    })
    pegsRef.current = pegRuntimes

    // Catcher
    const catcher = Matter.Bodies.rectangle(BOARD_WIDTH / 2, CATCHER_Y, catcherWidth, CATCHER_HEIGHT, {
      isStatic: true,
      isSensor: true,
      restitution: 0,
      label: 'catcher',
    })
    catcherRef.current = catcher
    Matter.Composite.add(world, catcher)

    // Collision: ball ↔ peg only. Catch detection lives in the physics loop because
    // a brief grazing collision is not a catch — the ball must actually exit through
    // the catcher's footprint.
    Matter.Events.on(engine, 'collisionStart', (evt) => {
      for (const pair of evt.pairs) {
        const aIsBall = pair.bodyA.label.startsWith('ball')
        const bIsBall = pair.bodyB.label.startsWith('ball')
        if (!aIsBall && !bIsBall) continue
        const ballBody = aIsBall ? pair.bodyA : pair.bodyB
        const other = aIsBall ? pair.bodyB : pair.bodyA
        if (other.label.startsWith('peg-')) {
          const idx = parseInt(other.label.split('-')[1], 10)
          const peg = pegsRef.current[idx]
          if (!peg || peg.hit || peg.cleared) continue
          peg.hit = true
          peg.flashUntil = performance.now() + 280
          handlePegHit(peg, ballBody)
        }
      }
    })

    return () => {
      Matter.World.clear(world, false)
      Matter.Engine.clear(engine)
      engineRef.current = null
      ballsListRef.current = []
      pegsRef.current = []
      catcherRef.current = null
      particlesRef.current = []
      scorePopsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, initialBalls])

  // Update catcher size if upgrade changes mid-game (rare but possible)
  useEffect(() => {
    const c = catcherRef.current
    if (!c) return
    Matter.Body.scale(c, catcherWidth / (c.bounds.max.x - c.bounds.min.x), 1)
  }, [catcherWidth])

  function handlePegHit(peg: PegRuntime, ballBody?: Matter.Body) {
    const now = performance.now()
    const upgs = upgradesRef.current
    const chain = shotChainRef.current + 1
    shotChainRef.current = chain
    setShotChain(chain)
    if (chain > peakChainThisShotRef.current) peakChainThisShotRef.current = chain

    // Schedule the peg to fade out and clear in 3s. The collision handler has
    // already set peg.hit and peg.flashUntil before calling us.
    peg.clearAt = now + PEG_HIT_LIFETIME_MS

    const baseValue =
      peg.spec.type === 'TARGET' ? 100 :
      peg.spec.type === 'BONUS' ? 250 : 10

    let multiplier = 1 + (chain - 1) * 0.4
    if (peg.spec.type === 'TARGET' && hasUpgrade(upgs, 'target-bonus')) multiplier *= 3
    if (chain === 1 && hasUpgrade(upgs, 'crispr')) multiplier *= 5
    // Fever mode: 5× score on every peg
    if (feverActiveRef.current) multiplier *= 5

    const points = Math.round(baseValue * multiplier * scoreMultiplier)
    shotChainScoreRef.current += points
    setShotChainScore(shotChainScoreRef.current)
    if (feverActiveRef.current) feverScoreRef.current += points

    // First peg of the shot — fire any armed powerup effect
    if (!firstPegThisShotRef.current) {
      firstPegThisShotRef.current = true
      const armed = armedPowerupRef.current
      if (armed === 'multiball' && ballBody) {
        spawnMultiball(ballBody.position.x, ballBody.position.y)
      } else if (armed === 'lysis') {
        triggerLysis(peg.spec.x, peg.spec.y)
      }
    }

    // Drive music intensity from chain
    music.setIntensity(Math.min(1, 0.3 + chain * 0.06))

    // Particles
    const colorInfo = BASE_COLORS[peg.spec.type]
    burstParticles(peg.spec.x, peg.spec.y, colorInfo.fill, peg.spec.type === 'TARGET' ? 18 : peg.spec.type === 'BONUS' ? 24 : 8)

    // Score popup — every peg gets one. Special pegs get bigger, brighter copy;
    // small chains get tiny floaters that don't crowd the screen.
    const chainHeat = chainColor(chain)
    const popSize =
      peg.spec.type === 'BONUS' ? 18 :
      peg.spec.type === 'TARGET' ? 16 :
      Math.min(20, 9 + chain * 0.6)
    const popText =
      peg.spec.type === 'BONUS' ? `+${points} BONUS!` :
      peg.spec.type === 'TARGET' ? `+${points} GENE!` :
      `+${points}`
    const popColor =
      peg.spec.type === 'BONUS' || peg.spec.type === 'TARGET'
        ? colorInfo.fill
        : chainHeat.fill
    scorePopsRef.current.push({
      x: peg.spec.x,
      y: peg.spec.y,
      text: popText,
      color: popColor,
      born: now,
      size: popSize,
      driftX: (Math.random() - 0.5) * 12,
    })

    // Milestone callout when crossing a chain threshold.
    // Don't overwrite the FEVER! callout — the player needs to see that one.
    const milestone = CHAIN_MILESTONES[chain]
    if (milestone && milestoneRef.current?.text !== 'FEVER!') {
      milestoneRef.current = { text: milestone.text, color: milestone.color, born: now }
      shakeRef.current = Math.max(shakeRef.current, chain >= 20 ? 18 : 10)
      sfx.milestone(chain)
    }

    // Sound
    if (feverActiveRef.current) {
      sfx.feverBell(chain)
    } else if (peg.spec.type === 'TARGET') sfx.target()
    else if (peg.spec.type === 'BONUS') sfx.bonus()
    else sfx.hit(chain)

    // Branching primer: every 5th peg in chain spawns extra particles + bonus
    if (hasUpgrade(upgs, 'branching') && chain > 0 && chain % 5 === 0) {
      const bonus = 50
      shotChainScoreRef.current += bonus
      setShotChainScore(shotChainScoreRef.current)
      burstParticles(peg.spec.x, peg.spec.y, '#a78bfa', 14)
    }

    // Track collected base if it's an A/T/G/C peg
    if (peg.spec.type === 'A' || peg.spec.type === 'T' || peg.spec.type === 'G' || peg.spec.type === 'C') {
      const k = peg.spec.type
      basesRef.current = { ...basesRef.current, [k]: basesRef.current[k] + 1 }
      setBases(basesRef.current)
    }

    // Light shake on big hits
    if (peg.spec.type === 'TARGET') shakeRef.current = 8
    else if (peg.spec.type === 'BONUS') shakeRef.current = 12

    // Targets indicator updates the moment a gene is HIT (not when it auto-clears
    // 3s later). Player gets immediate feedback on progress.
    if (peg.spec.type === 'TARGET') {
      const remaining = pegsRef.current.filter(
        p => p.spec.type === 'TARGET' && !p.hit,
      ).length
      targetsRef.current = remaining
      setTargetsRemaining(remaining)
      if (remaining === 0 && !feverActiveRef.current) triggerFever()
    }
  }

  // Expose a debug hook so we can watch fever in dev (window.__triggerFever)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __triggerFever?: () => void }).__triggerFever = () => {
        if (!ballInFlightRef.current) {
          aimRef.current = { x: BOARD_WIDTH / 2 + 30, y: BOARD_HEIGHT / 2 }
          fireBall()
        }
        // Trigger fever the same frame so the ball stays in play
        triggerFever()
      }
    }
  })

  function triggerFever() {
    feverActiveRef.current = true
    feverStartTimeRef.current = performance.now()
    feverScoreRef.current = 0
    shakeRef.current = 26
    // Big centered callout that holds longer than a normal milestone
    milestoneRef.current = { text: 'FEVER!', color: '#fde047', born: performance.now() }
    // Highlight every remaining peg with a quick particle puff
    for (const p of pegsRef.current) {
      if (!p.cleared && !p.hit) burstParticles(p.spec.x, p.spec.y, '#ffffff', 5)
    }
    music.setIntensity(1)
    sfx.fever()
  }

  // Rescue a wedged ball: clear pegs in a 32px radius (player gets the points),
  // teleport the ball slightly down and randomly to the side, and reset its
  // velocity to a strong downward vector. Run from both manual NUDGE and the
  // 2-second auto-rescue.
  function rescueBall(b: Matter.Body, now: number) {
    const RADIUS = 32
    const radiusSq = RADIUS * RADIUS
    for (const peg of pegsRef.current) {
      if (peg.hit || peg.cleared) continue
      const dx = peg.spec.x - b.position.x
      const dy = peg.spec.y - b.position.y
      if (dx * dx + dy * dy < radiusSq) {
        peg.hit = true
        peg.flashUntil = now + 280
        handlePegHit(peg, b)
      }
    }
    // Teleport position and reset velocity downward
    const offsetX = (Math.random() - 0.5) * 18
    const newY = Math.min(BOARD_HEIGHT - 60, b.position.y + 14)
    Matter.Body.setPosition(b, { x: b.position.x + offsetX, y: newY })
    Matter.Body.setVelocity(b, {
      x: (Math.random() - 0.5) * 6,
      y: 7,
    })
    burstParticles(b.position.x, b.position.y, '#fde047', 16)
  }

  function endFever() {
    feverActiveRef.current = false
    // Force end the shot to transition to level complete; we already won when
    // the last gene fell, so endShot will report win=true.
    if (engineRef.current) {
      for (const b of ballsListRef.current) Matter.Composite.remove(engineRef.current.world, b)
    }
    ballsListRef.current = []
    trailsRef.current.clear()
    endShot()
  }

  function spawnMultiball(x: number, y: number) {
    const engine = engineRef.current
    if (!engine) return
    burstParticles(x, y, '#fde047', 30)
    shakeRef.current = 14
    sfx.bonus()
    for (let i = 0; i < 2; i++) {
      const ball = Matter.Bodies.circle(x, y, BALL_RADIUS, {
        restitution: 0.62,
        friction: 0.005,
        frictionAir: 0.0,
        density: 0.05,
        label: `ball-${performance.now()}-${i}`,
      })
      const angle = -Math.PI / 2 + (i === 0 ? -0.7 : 0.7)
      const speed = 14
      Matter.Body.setVelocity(ball, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed })
      Matter.Composite.add(engine.world, ball)
      ballsListRef.current.push(ball)
    }
  }

  function triggerLysis(cx: number, cy: number) {
    const radius = 110
    burstParticles(cx, cy, '#fb7185', 40)
    shakeRef.current = 18
    sfx.bonus()
    for (const p of pegsRef.current) {
      if (p.hit || p.cleared) continue
      const dx = p.spec.x - cx
      const dy = p.spec.y - cy
      if (dx * dx + dy * dy <= radius * radius) {
        p.hit = true
        p.flashUntil = performance.now() + 280
        handlePegHit(p)
      }
    }
  }

  function burstParticles(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 4
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 600 + Math.random() * 400,
        color,
        size: 2 + Math.random() * 2,
      })
    }
  }

  function fireBall() {
    if (ballInFlightRef.current || completedRef.current) return
    if (ballsRef.current <= 0) return
    if (!music.isStarted()) music.start()
    music.setIntensity(0.3)

    const aim = aimRef.current
    const startX = BOARD_WIDTH / 2
    const startY = 60
    const dx = aim.x - startX
    const dy = Math.max(40, aim.y - startY)
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const power = 16
    const vx = (dx / len) * power
    const vy = (dy / len) * power

    const ball = Matter.Bodies.circle(startX, startY, BALL_RADIUS, {
      restitution: 0.62,
      friction: 0.005,
      frictionAir: 0.0,
      density: 0.05,
      label: 'ball-primary',
    })
    Matter.Body.setVelocity(ball, { x: vx, y: vy })

    if (engineRef.current) {
      // Apply timewarp gravity for this shot
      const armed = armedPowerupRef.current
      const baseGravity = hasUpgrade(upgradesRef.current, 'low-grav') ? 0.55 : 0.7
      engineRef.current.gravity.y = armed === 'timewarp' ? baseGravity * 0.55 : baseGravity
      Matter.Composite.add(engineRef.current.world, ball)
    }
    ballsListRef.current = [ball]
    ballInFlightRef.current = true
    caughtCountRef.current = 0
    firstPegThisShotRef.current = false
    peakChainThisShotRef.current = 0
    shotChainRef.current = 0
    shotChainScoreRef.current = 0
    shotStartTimeRef.current = performance.now()
    stuckSinceRef.current = 0
    ballPositionsRef.current.clear()
    milestoneRef.current = null
    setStuckWarning(false)
    setShotChain(0)
    setShotChainScore(0)
    // Consume the armed powerup once the shot is launched
    magnetThisShotRef.current = false
    if (armedPowerupRef.current) {
      const used = armedPowerupRef.current
      onPowerupConsumed(used)
      // Magnet effect persists for the duration of the shot
      if (used === 'magnet') magnetThisShotRef.current = true
      armedPowerupRef.current = null
      setArmedPowerup(null)
    }
    sfx.launch()
  }

  function endShot() {
    // Remove all remaining balls from world
    if (engineRef.current) {
      for (const b of ballsListRef.current) Matter.Composite.remove(engineRef.current.world, b)
    }
    ballsListRef.current = []
    ballInFlightRef.current = false

    // Finalize any pegs that were hit but haven't yet reached their auto-clear
    // time. These are pegs hit in the last 3 seconds before the shot ended.
    // Pegs that already auto-cleared earlier are skipped — the auto-clear loop
    // already did the bookkeeping (gene callback, target-bonus, totals).
    let clearedThisShot = 0
    for (const peg of pegsRef.current) {
      if (peg.hit && !peg.cleared) {
        peg.cleared = true
        clearedThisShot++
        pegsClearedTotalRef.current += 1
        if (engineRef.current) Matter.Composite.remove(engineRef.current.world, peg.body)
        if (peg.spec.type === 'TARGET') {
          onGenePegCleared()
          if (!peg.bonusApplied && hasUpgrade(upgradesRef.current, 'target-bonus')) {
            peg.bonusApplied = true
            ballsRef.current += 1
            setBallsRemaining(ballsRef.current)
          }
        }
      }
    }

    // Report peak chain to parent (for achievements)
    if (peakChainThisShotRef.current > 0) {
      onChainPeak(peakChainThisShotRef.current)
    }

    // Add chain score to total
    const earned = shotChainScoreRef.current
    scoreRef.current += earned
    setScore(scoreRef.current)

    // Reset chain UI a moment after shot ends
    setTimeout(() => {
      shotChainRef.current = 0
      shotChainScoreRef.current = 0
      setShotChain(0)
      setShotChainScore(0)
    }, 1500)

    // Jackpot upgrade
    if (hasUpgrade(upgradesRef.current, 'jackpot')) {
      const jackpotsBefore = Math.floor((pegsClearedTotalRef.current - clearedThisShot) / 25)
      const jackpotsAfter = Math.floor(pegsClearedTotalRef.current / 25)
      const newJackpots = jackpotsAfter - jackpotsBefore
      if (newJackpots > 0) {
        const jackpot = newJackpots * 5000
        scoreRef.current += jackpot
        setScore(scoreRef.current)
        scorePopsRef.current.push({
          x: BOARD_WIDTH / 2,
          y: BOARD_HEIGHT / 2,
          text: `JACKPOT +${jackpot}!`,
          color: '#fde047',
          born: performance.now(),
        })
        shakeRef.current = 16
        sfx.bonus()
        onJackpot()
      }
    }

    // Sync targets indicator (it already updates on hit, but keep this for safety)
    targetsRef.current = pegsRef.current.filter(p => p.spec.type === 'TARGET' && !p.cleared && !p.hit).length
    setTargetsRemaining(targetsRef.current)

    // Catcher: each caught ball returns balls to your reservoir.
    // Cap counted catches at 2/shot so multiball can't farm infinite balls.
    const caught = Math.min(2, caughtCountRef.current)
    if (caught > 0) {
      const perCatchBonus = 1 + (hasUpgrade(upgradesRef.current, 'free-shot') ? 1 : 0) + catchExtraBalls
      const bonus = caught * perCatchBonus
      ballsRef.current += bonus
      setBallsRemaining(ballsRef.current)
      sfx.catch()
      scorePopsRef.current.push({
        x: catcherRef.current!.position.x,
        y: catcherRef.current!.position.y - 20,
        text: bonus > 1 ? `+${bonus} BALLS!` : '+1 BALL',
        color: '#34d399',
        born: performance.now(),
      })
    } else {
      sfx.ballLost()
    }

    // Check completion
    if (targetsRef.current === 0) {
      completedRef.current = true
      sfx.levelComplete()
      setTimeout(() => onComplete({
        score: scoreRef.current,
        bases: basesRef.current,
        ballsLeft: ballsRef.current,
        targetsCleared: pegsRef.current.filter(p => p.spec.type === 'TARGET' && p.cleared).length,
        totalTargets: pegsRef.current.filter(p => p.spec.type === 'TARGET').length,
        win: true,
      }), 1200)
    } else if (ballsRef.current === 0) {
      completedRef.current = true
      sfx.gameOver()
      setTimeout(() => onComplete({
        score: scoreRef.current,
        bases: basesRef.current,
        ballsLeft: 0,
        targetsCleared: pegsRef.current.filter(p => p.spec.type === 'TARGET' && p.cleared).length,
        totalTargets: pegsRef.current.filter(p => p.spec.type === 'TARGET').length,
        win: false,
      }), 1200)
    }
  }

  // Render + physics loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const ctx: CanvasRenderingContext2D = ctx2d

    let animId = 0
    let last = performance.now()
    const dpr = window.devicePixelRatio || 1
    canvas.width = BOARD_WIDTH * dpr
    canvas.height = BOARD_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    function loop(now: number) {
      const dt = Math.min(32, now - last)
      last = now
      const engine = engineRef.current
      // Slow physics during fever for spectacle. Reduce gravity + restitution
      // so the ball keeps bouncing without falling off.
      const inFever = feverActiveRef.current
      const timeScale = inFever ? 0.5 : 1
      if (engine) {
        // During fever, drop gravity so the ball keeps bouncing for the show.
        // Outside fever, leave gravity alone — fireBall sets it per-shot
        // (timewarp powerup, low-grav upgrade).
        if (inFever) engine.gravity.y = 0.22
        const scaled = dt * timeScale
        const steps = Math.max(1, Math.ceil(scaled / 16.6))
        const stepDt = scaled / steps
        for (let s = 0; s < steps; s++) Matter.Engine.update(engine, stepDt)
      }

      // Catcher movement
      const catcher = catcherRef.current
      if (catcher) {
        const speed = 1.4 * (dt / 16)
        const minX = catcherWidth / 2 + 8
        const maxX = BOARD_WIDTH - catcherWidth / 2 - 8
        let nx = catcher.position.x + catcherDirRef.current * speed
        if (nx < minX) { nx = minX; catcherDirRef.current = 1 }
        if (nx > maxX) { nx = maxX; catcherDirRef.current = -1 }
        Matter.Body.setPosition(catcher, { x: nx, y: CATCHER_Y })
      }

      // Fever auto-targeting + bottom rebound: keep the ball in play while it
      // rampages through whatever's left.
      if (inFever && ballsListRef.current.length > 0) {
        const live = pegsRef.current.filter(p => !p.cleared && !p.hit)
        for (const ball of ballsListRef.current) {
          // 1) Floor rebound + position clamp — keep the ball strictly inside
          //    the play area. Without this, magnet alone can't fight gravity
          //    and the ball escapes off the bottom.
          if (ball.position.y > BOARD_HEIGHT - 30) {
            Matter.Body.setPosition(ball, { x: ball.position.x, y: BOARD_HEIGHT - 30 })
            Matter.Body.setVelocity(ball, { x: ball.velocity.x, y: -Math.abs(ball.velocity.y) * 0.85 - 3 })
          } else if (ball.position.y < 80) {
            Matter.Body.setPosition(ball, { x: ball.position.x, y: 80 })
            Matter.Body.setVelocity(ball, { x: ball.velocity.x, y: Math.abs(ball.velocity.y) * 0.85 + 3 })
          }
          // 2) Side walls
          if (ball.position.x < 30) {
            Matter.Body.setPosition(ball, { x: 30, y: ball.position.y })
            Matter.Body.setVelocity(ball, { x: Math.abs(ball.velocity.x) * 0.9 + 2, y: ball.velocity.y })
          } else if (ball.position.x > BOARD_WIDTH - 30) {
            Matter.Body.setPosition(ball, { x: BOARD_WIDTH - 30, y: ball.position.y })
            Matter.Body.setVelocity(ball, { x: -(Math.abs(ball.velocity.x) * 0.9 + 2), y: ball.velocity.y })
          }
          // 3) Magnet toward nearest unhit peg, strong enough to bend the
          //    trajectory between bounces.
          if (live.length > 0) {
            let nearest = live[0]
            let nearestDist = Infinity
            for (const p of live) {
              const dx = p.spec.x - ball.position.x
              const dy = p.spec.y - ball.position.y
              const d = dx * dx + dy * dy
              if (d < nearestDist) { nearestDist = d; nearest = p }
            }
            const dx = nearest.spec.x - ball.position.x
            const dy = nearest.spec.y - ball.position.y
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            // Apply force scaled by ball mass so it actually moves
            Matter.Body.applyForce(ball, ball.position, {
              x: (dx / len) * 0.008,
              y: (dy / len) * 0.008,
            })
          }
        }
        // Record trail positions per ball for the rainbow streak
        for (const ball of ballsListRef.current) {
          let trail = trailsRef.current.get(ball.id)
          if (!trail) { trail = []; trailsRef.current.set(ball.id, trail) }
          trail.push({ x: ball.position.x, y: ball.position.y, t: now })
          while (trail.length > 14) trail.shift()
        }
        if (shakeRef.current < 4) shakeRef.current = 4
      }

      // Magnetic — apply if upgrade installed OR magnet powerup armed for this shot
      const magnetActive =
        !inFever && ballInFlightRef.current && (
          hasUpgrade(upgradesRef.current, 'magnetic') ||
          magnetThisShotRef.current
        )
      if (magnetActive) {
        const targets = pegsRef.current.filter(p => p.spec.type === 'TARGET' && !p.cleared)
        if (targets.length > 0) {
          for (const ball of ballsListRef.current) {
            let nearest = targets[0]
            let nearestDist = Infinity
            for (const t of targets) {
              const dx = t.spec.x - ball.position.x
              const dy = t.spec.y - ball.position.y
              const d = dx * dx + dy * dy
              if (d < nearestDist) { nearestDist = d; nearest = t }
            }
            const dx = nearest.spec.x - ball.position.x
            const dy = nearest.spec.y - ball.position.y
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const force = magnetThisShotRef.current ? 0.0004 : 0.00015
            Matter.Body.applyForce(ball, ball.position, { x: (dx / len) * force, y: (dy / len) * force })
          }
        }
      }

      // Auto-clear hit pegs after their lifetime — they fade out and disappear
      // even mid-shot. This drives the visual progression and keeps long shots
      // (especially fever) from leaving the board cluttered with "lit" pegs.
      for (const peg of pegsRef.current) {
        if (peg.hit && !peg.cleared && peg.clearAt > 0 && now >= peg.clearAt) {
          peg.cleared = true
          pegsClearedTotalRef.current += 1
          if (engineRef.current) Matter.Composite.remove(engineRef.current.world, peg.body)
          if (peg.spec.type === 'TARGET') {
            onGenePegCleared()
            if (!peg.bonusApplied && hasUpgrade(upgradesRef.current, 'target-bonus')) {
              peg.bonusApplied = true
              ballsRef.current += 1
              setBallsRemaining(ballsRef.current)
            }
          }
        }
      }

      // Fever end conditions: total time, all pegs cleared, or no balls.
      if (inFever) {
        const elapsed = now - feverStartTimeRef.current
        const remainingPegs = pegsRef.current.filter(p => !p.cleared && !p.hit).length
        if (elapsed > 6000 || remainingPegs === 0 || ballsListRef.current.length === 0) {
          endFever()
        }
      }

      // Track balls leaving the screen — end shot when ALL balls are gone.
      // (Skipped during fever — gravity is low enough that balls stay on screen,
      //  and we manage exits via endFever above.)
      if (ballInFlightRef.current && !inFever) {
        const catcher = catcherRef.current
        // First pass: mark balls that pass through the catcher's footprint while descending
        if (catcher) {
          const catcherTop = catcher.position.y - CATCHER_HEIGHT / 2 - 4
          const catcherBottom = catcher.position.y + CATCHER_HEIGHT / 2 + 4
          const half = catcherWidth / 2
          for (const b of ballsListRef.current) {
            if ((b as Matter.Body & { __caught?: boolean }).__caught) continue
            const inX = Math.abs(b.position.x - catcher.position.x) < half + BALL_RADIUS
            const inY = b.position.y >= catcherTop && b.position.y <= catcherBottom
            if (inX && inY && b.velocity.y > 0) {
              ;(b as Matter.Body & { __caught?: boolean }).__caught = true
            }
          }
        }
        const stillIn: Matter.Body[] = []
        for (const b of ballsListRef.current) {
          if (b.position.y > BOARD_HEIGHT + 30) {
            if ((b as Matter.Body & { __caught?: boolean }).__caught) caughtCountRef.current++
            if (engineRef.current) Matter.Composite.remove(engineRef.current.world, b)
          } else {
            stillIn.push(b)
          }
        }
        ballsListRef.current = stillIn
        if (stillIn.length === 0) {
          ballsRef.current -= 1
          setBallsRemaining(ballsRef.current)
          endShot()
        } else {
          // Position-displacement stuck detection. Sample each ball's position
          // every frame; track its bounding box over the last 1200ms. If the
          // most-active ball's bounding box is smaller than 28px in both
          // dimensions for that whole window, the ball is wedged — flag stuck.
          for (const b of stillIn) {
            let buf = ballPositionsRef.current.get(b.id)
            if (!buf) { buf = []; ballPositionsRef.current.set(b.id, buf) }
            buf.push({ x: b.position.x, y: b.position.y, t: now })
            // Trim entries older than 1.2s
            while (buf.length > 0 && now - buf[0].t > 1200) buf.shift()
          }

          let bestRange = 0
          for (const b of stillIn) {
            const buf = ballPositionsRef.current.get(b.id)
            if (!buf || buf.length < 8 || buf[buf.length - 1].t - buf[0].t < 900) continue
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
            for (const p of buf) {
              if (p.x < minX) minX = p.x
              if (p.x > maxX) maxX = p.x
              if (p.y < minY) minY = p.y
              if (p.y > maxY) maxY = p.y
            }
            const range = Math.max(maxX - minX, maxY - minY)
            if (range > bestRange) bestRange = range
          }

          const STUCK_RANGE_PX = 28
          if (bestRange === 0 || bestRange > STUCK_RANGE_PX) {
            stuckSinceRef.current = 0
            if (stuckWarning) setStuckWarning(false)
          } else {
            if (stuckSinceRef.current === 0) stuckSinceRef.current = now
            const stuckFor = now - stuckSinceRef.current
            if (stuckFor > 600 && !stuckWarning) setStuckWarning(true)
            // Auto-rescue after 2s — clear surrounding pegs (player gets credit!)
            // and bump the ball out of the wedge.
            if (stuckFor > 2000) {
              for (const b of stillIn) rescueBall(b, now)
              stuckSinceRef.current = 0
              ballPositionsRef.current.clear()
            }
          }
          // Hard timeout: force-end after 14s total
          if (now - shotStartTimeRef.current > 14000) {
            for (const b of stillIn) {
              if (engineRef.current) Matter.Composite.remove(engineRef.current.world, b)
            }
            ballsListRef.current = []
            ballsRef.current -= 1
            setBallsRemaining(ballsRef.current)
            setStuckWarning(false)
            endShot()
          }
        }
      }

      // Update particles
      const partsAlive: Particle[] = []
      for (const p of particlesRef.current) {
        p.life += dt
        p.x += p.vx * (dt / 16)
        p.y += p.vy * (dt / 16)
        p.vy += 0.12 * (dt / 16)
        p.vx *= 0.99
        if (p.life < p.maxLife) partsAlive.push(p)
      }
      particlesRef.current = partsAlive

      // Update score pops (cull old)
      scorePopsRef.current = scorePopsRef.current.filter(s => now - s.born < 1000)

      // Shake decay
      shakeRef.current = Math.max(0, shakeRef.current - 0.5)

      render(ctx, now)
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, catcherWidth])

  function render(ctx: CanvasRenderingContext2D, now: number) {
    const shake = shakeRef.current
    const sx = (Math.random() - 0.5) * shake
    const sy = (Math.random() - 0.5) * shake

    ctx.save()
    ctx.translate(sx, sy)

    // Background
    const grad = ctx.createRadialGradient(BOARD_WIDTH / 2, 100, 50, BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 600)
    grad.addColorStop(0, '#1b0840')
    grad.addColorStop(0.5, '#0a0420')
    grad.addColorStop(1, '#04020e')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)

    // Grid lines
    ctx.strokeStyle = 'rgba(217,70,239,0.06)'
    ctx.lineWidth = 1
    for (let x = 0; x < BOARD_WIDTH; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, BOARD_HEIGHT); ctx.stroke()
    }
    for (let y = 0; y < BOARD_HEIGHT; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BOARD_WIDTH, y); ctx.stroke()
    }

    // Aim line — draw as a series of glowing dots so the player can read the trajectory clearly
    if (!ballInFlightRef.current && !completedRef.current && !feverActiveRef.current && ballsRef.current > 0) {
      const aim = aimRef.current
      const startX = BOARD_WIDTH / 2
      const startY = 60
      const dx = aim.x - startX
      const dy = Math.max(40, aim.y - startY)
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const ux = dx / len
      const uy = dy / len
      const guideLen = hasUpgrade(upgradesRef.current, 'wide-launcher') ? 320 : 200
      const dotCount = hasUpgrade(upgradesRef.current, 'wide-launcher') ? 14 : 9
      const dotSpacing = guideLen / dotCount
      const armed = armedPowerupRef.current

      ctx.save()
      const aimColor = armed === 'magnet' ? 'rgba(34,211,238,' : 'rgba(232,121,249,'
      const phase = (now / 350) % 1
      for (let i = 0; i < dotCount; i++) {
        const t = (i + phase) / dotCount
        const x = startX + ux * dotSpacing * (i + phase)
        const y = startY + uy * dotSpacing * (i + phase)
        const alpha = 0.85 - t * 0.7
        const r = 3.5 - t * 2
        ctx.fillStyle = aimColor + alpha + ')'
        ctx.shadowColor = aimColor + '0.9)'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(x, y, Math.max(1.2, r), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.restore()

      // Launcher base
      ctx.fillStyle = '#1f0744'
      ctx.strokeStyle = '#e879f9'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(232,121,249,0.8)'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(startX, startY, 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#e879f9'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('5\'', startX, startY)
    }

    // Pegs
    for (const peg of pegsRef.current) {
      if (peg.cleared) continue
      const r =
        peg.spec.type === 'TARGET' ? TARGET_RADIUS :
        peg.spec.type === 'BONUS' ? BONUS_RADIUS : PEG_RADIUS
      const colorInfo = BASE_COLORS[peg.spec.type]
      const flashing = peg.flashUntil > now
      const flashAmount = flashing ? Math.max(0, (peg.flashUntil - now) / 280) : 0

      // Hit pegs fade out over their final PEG_FADE_MS before clearing.
      let pegAlpha = 1
      if (peg.hit && peg.clearAt > 0) {
        const remaining = peg.clearAt - now
        if (remaining <= PEG_FADE_MS) {
          pegAlpha = Math.max(0, remaining / PEG_FADE_MS)
        }
      }
      if (pegAlpha <= 0) continue

      ctx.save()
      ctx.globalAlpha = pegAlpha

      // Outer glow
      ctx.shadowColor = colorInfo.glow
      ctx.shadowBlur = peg.spec.type === 'TARGET' ? 18 : peg.spec.type === 'BONUS' ? 22 : 8
      ctx.fillStyle = peg.hit ? mixColor(colorInfo.fill, '#ffffff', 0.4) : colorInfo.fill
      ctx.beginPath()
      ctx.arc(peg.spec.x, peg.spec.y, r + flashAmount * 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // Inner letter for bases
      if (peg.spec.type === 'A' || peg.spec.type === 'T' || peg.spec.type === 'G' || peg.spec.type === 'C') {
        ctx.fillStyle = peg.hit ? '#ffffff' : 'rgba(0,0,0,0.55)'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(peg.spec.type, peg.spec.x, peg.spec.y + 1)
      } else if (peg.spec.type === 'TARGET') {
        // Pulsing ring around target
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'
        ctx.lineWidth = 1.5
        const pulse = 2 + Math.sin(now / 200) * 2
        ctx.beginPath()
        ctx.arc(peg.spec.x, peg.spec.y, r + pulse, 0, Math.PI * 2)
        ctx.stroke()
      } else if (peg.spec.type === 'BONUS') {
        // Star
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.font = 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('★', peg.spec.x, peg.spec.y + 1)
      }

      ctx.restore()
    }

    // Rainbow trails behind every ball during fever
    if (feverActiveRef.current) {
      for (const ball of ballsListRef.current) {
        const trail = trailsRef.current.get(ball.id)
        if (!trail || trail.length < 2) continue
        for (let i = 0; i < trail.length; i++) {
          const t = trail[i]
          const ageNorm = (i + 1) / trail.length // 0..1, newest = 1
          const hue = (now / 4 + i * 28) % 360
          const radius = BALL_RADIUS * (0.4 + ageNorm * 0.7)
          ctx.save()
          ctx.globalAlpha = ageNorm * 0.85
          ctx.shadowColor = `hsl(${hue}, 90%, 60%)`
          ctx.shadowBlur = 18
          ctx.fillStyle = `hsl(${hue}, 95%, ${55 + ageNorm * 15}%)`
          ctx.beginPath()
          ctx.arc(t.x, t.y, radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }
    }

    // Balls (1 normally, more when multiball is in play)
    for (const ball of ballsListRef.current) {
      ctx.save()
      ctx.shadowColor = magnetThisShotRef.current ? 'rgba(34,211,238,1)' : 'rgba(232,121,249,1)'
      ctx.shadowBlur = 24
      ctx.fillStyle = '#fdf4ff'
      ctx.beginPath()
      ctx.arc(ball.position.x, ball.position.y, BALL_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = magnetThisShotRef.current ? 'rgba(34,211,238,0.9)' : 'rgba(232,121,249,0.9)'
      ctx.beginPath()
      ctx.arc(ball.position.x - 2, ball.position.y - 2, BALL_RADIUS / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Catcher
    const catcher = catcherRef.current
    if (catcher) {
      const cx = catcher.position.x
      const cy = catcher.position.y
      ctx.save()
      ctx.shadowColor = 'rgba(34,211,238,0.8)'
      ctx.shadowBlur = 12
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = 3
      // U-shape catcher
      ctx.beginPath()
      ctx.moveTo(cx - catcherWidth / 2, cy - CATCHER_HEIGHT / 2)
      ctx.lineTo(cx - catcherWidth / 2, cy + CATCHER_HEIGHT / 2)
      ctx.lineTo(cx + catcherWidth / 2, cy + CATCHER_HEIGHT / 2)
      ctx.lineTo(cx + catcherWidth / 2, cy - CATCHER_HEIGHT / 2)
      ctx.stroke()
      // fluid fill
      const fluid = ctx.createLinearGradient(0, cy - CATCHER_HEIGHT / 2, 0, cy + CATCHER_HEIGHT / 2)
      fluid.addColorStop(0, 'rgba(34,211,238,0.0)')
      fluid.addColorStop(1, 'rgba(34,211,238,0.45)')
      ctx.fillStyle = fluid
      ctx.fillRect(cx - catcherWidth / 2 + 2, cy - CATCHER_HEIGHT / 2 + 2, catcherWidth - 4, CATCHER_HEIGHT - 4)
      ctx.restore()

      // Bottom rail
      ctx.strokeStyle = 'rgba(232,121,249,0.3)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, BOARD_HEIGHT - 4)
      ctx.lineTo(BOARD_WIDTH, BOARD_HEIGHT - 4)
      ctx.stroke()
    }

    // Particles
    for (const p of particlesRef.current) {
      const alpha = 1 - p.life / p.maxLife
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Score pops
    for (const pop of scorePopsRef.current) {
      const age = now - pop.born
      const t = age / 1000
      const alpha = 1 - t
      const yOff = -t * 36
      const xOff = (pop.driftX ?? 0) * t
      const size = pop.size ?? 14
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = pop.color
      ctx.shadowColor = pop.color
      ctx.shadowBlur = size > 14 ? 10 : 6
      ctx.font = `bold ${size}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(pop.text, pop.x + xOff, pop.y + yOff)
      ctx.restore()
    }

    // Chain badge near the lead ball — scales and heats up with chain count.
    // During fever, the badge cycles through the rainbow.
    if (ballInFlightRef.current && shotChainRef.current >= 1) {
      const ball = ballsListRef.current[0]
      if (ball) {
        const chain = shotChainRef.current
        const c = feverActiveRef.current
          ? { fill: `hsl(${(now / 4) % 360}, 95%, 65%)`, glow: `hsla(${(now / 4) % 360}, 95%, 65%,` }
          : chainColor(chain)
        // Glow ring
        const ringRadius = BALL_RADIUS + 6 + Math.min(28, chain * 1.2)
        const grad = ctx.createRadialGradient(
          ball.position.x, ball.position.y, BALL_RADIUS,
          ball.position.x, ball.position.y, ringRadius,
        )
        grad.addColorStop(0, c.glow + Math.min(0.55, 0.15 + chain * 0.025) + ')')
        grad.addColorStop(1, c.glow + '0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(ball.position.x, ball.position.y, ringRadius, 0, Math.PI * 2)
        ctx.fill()

        // Badge text — only show from chain 2+ to avoid clutter on first hit
        if (chain >= 2) {
          const fontSize = Math.min(38, 14 + chain * 1.0)
          ctx.save()
          ctx.fillStyle = c.fill
          ctx.shadowColor = c.glow + '0.9)'
          ctx.shadowBlur = 14
          ctx.font = `900 ${fontSize}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(`×${chain}`, ball.position.x, ball.position.y - BALL_RADIUS - fontSize / 2 - 6)
          ctx.restore()
        }
      }
    }

    // Milestone callout — centered, scales in then fades
    // Fever vignette + rainbow wash flooding the play area
    if (feverActiveRef.current) {
      const elapsed = now - feverStartTimeRef.current
      const fade = Math.min(1, elapsed / 220)
      const hueOffset = (now / 6) % 360

      // 1) Heavy edge vignette — focuses attention
      const vignette = ctx.createRadialGradient(
        BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_WIDTH * 0.25,
        BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_WIDTH * 0.75,
      )
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vignette.addColorStop(1, `rgba(0, 0, 0, ${0.85 * fade})`)
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)

      // 2) Rainbow color wash on top (additive)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      const wash = ctx.createRadialGradient(
        BOARD_WIDTH / 2, BOARD_HEIGHT / 2, 0,
        BOARD_WIDTH / 2, BOARD_HEIGHT / 2, BOARD_WIDTH * 0.7,
      )
      wash.addColorStop(0, `hsla(${hueOffset}, 95%, 55%, ${0.30 * fade})`)
      wash.addColorStop(0.5, `hsla(${(hueOffset + 120) % 360}, 95%, 55%, ${0.18 * fade})`)
      wash.addColorStop(1, `hsla(${(hueOffset + 240) % 360}, 95%, 50%, 0)`)
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT)
      ctx.restore()

      // 3) Pulsing rainbow border ring around the play area
      const ringWidth = 6 + Math.sin(now / 120) * 3
      ctx.save()
      ctx.lineWidth = ringWidth
      ctx.strokeStyle = `hsla(${hueOffset}, 95%, 60%, ${0.85 * fade})`
      ctx.shadowColor = `hsla(${hueOffset}, 95%, 60%, 1)`
      ctx.shadowBlur = 24
      ctx.strokeRect(ringWidth / 2, ringWidth / 2, BOARD_WIDTH - ringWidth, BOARD_HEIGHT - ringWidth)
      ctx.restore()
    }

    if (milestoneRef.current) {
      const m = milestoneRef.current
      const isFever = m.text === 'FEVER!'
      const age = now - m.born
      const dur = isFever ? 2400 : 1400
      if (age > dur) {
        milestoneRef.current = null
      } else {
        const t = age / dur
        const fadeIn = Math.min(1, t / 0.08)
        const fadeOut = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
        const alpha = Math.max(0, Math.min(1, fadeIn * fadeOut))
        const scale = t < 0.12 ? 0.6 + (t / 0.12) * (isFever ? 0.7 : 0.5) : (isFever ? 1.3 : 1.1) - Math.min(0.2, (t - 0.12) * 0.18)
        const fontSize = isFever ? 90 : 60
        // Fever text cycles through rainbow colors
        const color = isFever ? `hsl(${(now / 4) % 360}, 95%, 65%)` : m.color
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(BOARD_WIDTH / 2, BOARD_HEIGHT / 2 - 80)
        ctx.scale(scale, scale)
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = isFever ? 36 : 24
        ctx.font = `900 ${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(m.text, 0, 0)
        ctx.restore()
      }
    }

    ctx.restore()
  }

  // Mouse/touch handlers
  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * BOARD_WIDTH
    const y = ((e.clientY - rect.top) / rect.height) * BOARD_HEIGHT
    aimRef.current = { x, y: Math.max(80, y) }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    handlePointerMove(e)
    fireBall()
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-[600px] aspect-[600/760] mx-auto select-none">
      {/* HUD top row */}
      <div className="absolute -top-12 left-0 right-0 flex items-center justify-between px-2 text-white pointer-events-none z-10">
        <div className="flex items-center gap-3">
          <div className="text-[10px] tracking-[0.25em] text-fuchsia-300 font-mono">SCORE</div>
          <div className="text-2xl font-black tabular-nums text-cyan-300" style={{ textShadow: '0 0 10px rgba(34,211,238,0.8)' }}>{score.toLocaleString()}</div>
          {shotChain > 0 && (
            <div className="text-sm font-black text-amber-300 animate-pulse">+{shotChainScore} ×{shotChain}</div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] tracking-[0.25em] text-fuchsia-300 font-mono">GENES</div>
          <div className="flex gap-1">
            {Array.from({ length: board.pegs.filter(p => p.type === 'TARGET').length }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < (board.pegs.filter(p => p.type === 'TARGET').length - targetsRemaining) ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.9)]' : 'border border-fuchsia-500/40'}`}
              />
            ))}
          </div>
          <div className="text-[10px] tracking-[0.25em] text-fuchsia-300 font-mono ml-3">BALLS</div>
          <div className="text-2xl font-black tabular-nums text-fuchsia-300" style={{ textShadow: '0 0 10px rgba(232,121,249,0.8)' }}>{ballsRemaining}</div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        className={`w-full h-full rounded-md cursor-crosshair border-2 ${
          isBossBoard(board)
            ? 'border-fuchsia-400 shadow-[0_0_60px_rgba(232,121,249,0.5)]'
            : isAnomalyBoard(board)
            ? 'border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.55)] animate-pulse'
            : 'border-fuchsia-500/40 shadow-[0_0_40px_rgba(232,121,249,0.25)]'
        }`}
        style={{ imageRendering: 'auto', touchAction: 'none' }}
      />

      {/* Stuck-ball nudge button */}
      {stuckWarning && (
        <button
          onClick={() => {
            const t = performance.now()
            for (const b of ballsListRef.current) rescueBall(b, t)
            setStuckWarning(false)
            stuckSinceRef.current = 0
            ballPositionsRef.current.clear()
          }}
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20 px-5 py-3 bg-amber-500/90 hover:bg-amber-400 text-amber-950 font-black text-sm tracking-widest rounded-sm border-2 border-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.7)] animate-pulse pointer-events-auto"
        >
          ▼ NUDGE BALL
        </button>
      )}

      {/* Powerup bar (always visible above the bases) */}
      <div className="absolute -bottom-12 left-0 right-0 flex items-center justify-center gap-6 text-white pointer-events-auto z-10 flex-wrap">
        <PowerupBar
          charges={charges}
          armed={armedPowerup}
          onArm={(id) => {
            armedPowerupRef.current = id
            setArmedPowerup(id)
          }}
          disabled={ballInFlightRef.current || completedRef.current}
        />
        <div className="flex items-center gap-3 pointer-events-none">
          {(['A', 'T', 'G', 'C'] as Base[]).map(b => (
            <div key={b} className="flex items-center gap-1.5 text-[11px] font-mono">
              <span
                className="inline-block w-3.5 h-3.5 rounded-full"
                style={{
                  backgroundColor: BASE_COLORS[b].fill,
                  boxShadow: `0 0 8px ${BASE_COLORS[b].glow}`,
                }}
              />
              <span className="font-bold tabular-nums">{bases[b]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function mixColor(c1: string, c2: string, amount: number): string {
  const hex = (c: string) => {
    const h = c.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = hex(c1)
  const [r2, g2, b2] = hex(c2)
  const r = Math.round(r1 + (r2 - r1) * amount)
  const g = Math.round(g1 + (g2 - g1) * amount)
  const b = Math.round(b1 + (b2 - b1) * amount)
  return `rgb(${r},${g},${b})`
}
