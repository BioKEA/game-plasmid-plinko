import { useEffect, useRef, useState } from 'react'
import type { RunState, Upgrade, Base, BoardSpec } from '@/lib/game/types'
import { getBoardForAnte, getBossBoard, BOARDS, isBossBoard, generateAnomalyBoard } from '@/lib/game/boards'
import { rollUpgradeChoices, hasUpgrade } from '@/lib/game/upgrades'
import { mulberry32, hashString, todayKey } from '@/lib/game/rng'
import { generateMap, type CampaignMap } from '@/lib/game/map'
import { buildShareString, type AnteResult } from '@/lib/game/share'
import { music } from '@/lib/game/music'
import {
  CHARACTERS,
  type CharacterId,
  type CharacterSpec,
  resolveStartingUpgrades,
} from '@/lib/game/characters'
import {
  POWERUP_LIST,
  emptyCharges,
  type PowerupCharges,
  type PowerupId,
} from '@/lib/game/powerups'
import {
  ACHIEVEMENTS,
  THEMES,
  loadAchievements,
  saveAchievements,
  loadStats,
  saveStats,
  loadClassesWon,
  saveClassesWon,
  loadTheme,
  saveTheme,
  type AchievementId,
  type ThemeId,
} from '@/lib/game/achievements'
import {
  incrementRunsCompleted,
  shouldShowBiodiversityCTA,
  markCTAShownThisSession,
  dismissCTAForever,
} from '@/lib/game/engagement'
import { loadHandle, saveHandle, submitDailyScore } from '@/lib/game/leaderboard'
import { tryClaimGoldenSample } from '@/lib/golden-sample'
import { BiokeaLeaderboardPrompt, shouldShowBiokeaPrompt } from '@/components/BiokeaLeaderboardPrompt'
import { StartScreen } from '@/components/game/StartScreen'
import { GameScreen } from '@/components/game/GameScreen'
import { UpgradePicker } from '@/components/game/UpgradePicker'
import { RunSummary } from '@/components/game/RunSummary'
import { MapScreen } from '@/components/game/MapScreen'
import { RestScreen } from '@/components/game/RestScreen'
import { MuteButton } from '@/components/game/MuteButton'
import { CharacterSelect } from '@/components/game/CharacterSelect'
import { AchievementsScreen } from '@/components/game/AchievementsScreen'
import { AchievementToast } from '@/components/game/AchievementToast'
import type { LevelResult } from '@/components/game/PeggleCanvas'

type Mode = 'daily' | 'campaign'
type Screen =
  | 'menu'
  | 'character-select'
  | 'achievements'
  | 'map'
  | 'playing'
  | 'upgrade'
  | 'rest'
  | 'game-over'

const TOTAL_DAILY_ANTES = 8
const BASE_BALLS_PER_LEVEL = 5
const HIGH_SCORE_KEY = 'plasmid-plinko-high'
const MUTED_KEY = 'plasmid-plinko-muted'
const DAILY_RESULT_KEY = 'plasmid-plinko-daily'

function emptyRun(): RunState {
  const bases: Record<Base, number> = { A: 0, T: 0, G: 0, C: 0 }
  return {
    ante: 1,
    score: 0,
    bases,
    upgrades: [],
    ballsRemaining: BASE_BALLS_PER_LEVEL,
  }
}

function ballsForLevel(
  upgrades: Upgrade[],
  hardMode: boolean,
  character: CharacterSpec | null,
  isBoss: boolean = false,
): number {
  return BASE_BALLS_PER_LEVEL
    + (hasUpgrade(upgrades, 'extra-ball') ? 1 : 0)
    - (hardMode ? 1 : 0)
    + (isBoss ? 1 : 0)
    + (character?.stats.ballsBonus ?? 0)
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [mode, setMode] = useState<Mode>('campaign')
  const [pendingMode, setPendingMode] = useState<Mode | null>(null)
  const [character, setCharacter] = useState<CharacterSpec | null>(null)
  const [run, setRun] = useState<RunState>(emptyRun())
  const [charges, setCharges] = useState<PowerupCharges>(emptyCharges())
  const [upgradeChoices, setUpgradeChoices] = useState<Upgrade[]>([])
  const [highScore, setHighScore] = useState<number | null>(null)
  const [lastWin, setLastWin] = useState(false)
  const [muted, setMuted] = useState(true)
  const [showCTA, setShowCTA] = useState(false)
  // BiokeaLeaderboardPrompt — auto-opens on daily game-over when no handle.
  const [biokeaPromptOpen, setBiokeaPromptOpen] = useState(false)

  // Open the BioKEA leaderboard prompt on daily game-over unless the
  // player has subscribed via this prompt before, or skipped it this
  // session. Pre-fills any handle that's already stored.
  useEffect(() => {
    if (screen !== 'game-over') return
    if (mode !== 'daily') return
    if (run.score <= 0) return
    if (!shouldShowBiokeaPrompt()) return
    setBiokeaPromptOpen(true)
  }, [screen, mode, run.score])

  // Achievements + stats
  const [achievements, setAchievements] = useState<Set<AchievementId>>(new Set())
  const [classesWon, setClassesWon] = useState<Set<CharacterId>>(new Set())
  const [theme, setTheme] = useState<ThemeId>('synthwave')
  const [toasts, setToasts] = useState<{ id: number; achievement: AchievementId }[]>([])
  const toastIdRef = useRef(0)
  const playerStatsRef = useRef(loadStats())
  const dailyAllPerfectRef = useRef(true)

  // Daily-specific
  const [dailyAnteResults, setDailyAnteResults] = useState<AnteResult[]>([])
  const [dailyCompletedToday, setDailyCompletedToday] = useState(false)
  const [dailyTodayScore, setDailyTodayScore] = useState<number | null>(null)
  const dailyRngRef = useRef<() => number>(Math.random)

  // Campaign-specific
  const [campaignMap, setCampaignMap] = useState<CampaignMap | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [visitedNodeIds, setVisitedNodeIds] = useState<Set<string>>(new Set())
  const [pendingNodeType, setPendingNodeType] = useState<'standard' | 'hard' | 'boss' | null>(null)
  const [pendingBoard, setPendingBoard] = useState<BoardSpec | null>(null)
  const [pendingHardMultiplier, setPendingHardMultiplier] = useState(1)
  const [isLabPick, setIsLabPick] = useState(false)
  const campaignRngRef = useRef<() => number>(Math.random)

  // Init
  useEffect(() => {
    const stored = localStorage.getItem(HIGH_SCORE_KEY)
    setHighScore(stored ? parseInt(stored, 10) || 0 : 0)

    // Default to muted on first visit. Once the player toggles a
    // preference, "0"/"1" is stored and respected.
    const storedMute = localStorage.getItem(MUTED_KEY)
    const m = storedMute === '0' ? false : true
    setMuted(m)
    music.setMuted(m)

    setAchievements(loadAchievements())
    setClassesWon(loadClassesWon())
    setTheme(loadTheme())

    const dailyJson = localStorage.getItem(DAILY_RESULT_KEY)
    if (dailyJson) {
      try {
        const data = JSON.parse(dailyJson)
        if (data.day === todayKey()) {
          setDailyCompletedToday(true)
          setDailyTodayScore(data.score)
        }
      } catch { /* ignore */ }
    }

    // Debug URL shortcuts (?debug=boss, ?debug=ante3, etc.) are dev-
    // only — they would let any visitor jump straight to a high ante
    // and trivialise the Golden Sample 26 unlock + skew leaderboards.
    // import.meta.env.DEV is true under `vite dev` and stripped to
    // false in production builds, so the whole branch is dead code
    // when the games are bundled for biokea.ai.
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const search = window.location.search
      if (search.includes('debug=boss')) {
        setMode('daily')
        setCharacter(CHARACTERS.biologist)
        setRun({ ...emptyRun(), ante: 8 })
        setCharges(rollLevelCharges(CHARACTERS.biologist, Math.random))
        setScreen('playing')
      } else if (search.includes('debug=ante')) {
        const m = search.match(/debug=ante(\d+)/)
        const ante = m ? parseInt(m[1], 10) : 4
        setMode('daily')
        setCharacter(CHARACTERS.biologist)
        setRun({ ...emptyRun(), ante })
        setCharges(rollLevelCharges(CHARACTERS.biologist, Math.random))
        setScreen('playing')
      } else if (search.includes('debug=anomaly')) {
        setMode('campaign')
        setCharacter(CHARACTERS.biologist)
        const anomaly = generateAnomalyBoard(Math.random)
        setPendingBoard(anomaly)
        setPendingNodeType('hard')
        setPendingHardMultiplier(1.5)
        setRun({ ...emptyRun(), ballsRemaining: ballsForLevel([], true, CHARACTERS.biologist, false) })
        setCharges(rollLevelCharges(CHARACTERS.biologist, Math.random))
        setScreen('playing')
      } else if (search.includes('debug=upgrade')) {
        setUpgradeChoices(rollUpgradeChoices([]))
        setScreen('upgrade')
      } else if (search.includes('debug=characters')) {
        setPendingMode('campaign')
        setScreen('character-select')
      } else if (search.includes('debug=achievements')) {
        setScreen('achievements')
      } else if (search.includes('debug=summary')) {
        setMode('daily')
        setCharacter(CHARACTERS.alchemist)
        setRun({ ...emptyRun(), score: 14820, ante: 8, bases: { A: 32, T: 28, G: 24, C: 31 } })
        setDailyAnteResults([
          { cleared: true, perfect: true },
          { cleared: true, perfect: true },
          { cleared: true, perfect: false },
          { cleared: true, perfect: true },
          { cleared: true, perfect: false },
          { cleared: true, perfect: true },
          { cleared: false, perfect: false },
          { cleared: false, perfect: false },
        ])
        setLastWin(false)
        setScreen('game-over')
      }
    }
  }, [])

  // Centralized "show the game-over screen" — increments the engagement
  // counter and decides whether to surface the biodiversity CTA on this
  // particular game-over.
  function goToGameOver() {
    incrementRunsCompleted()
    if (shouldShowBiodiversityCTA()) {
      setShowCTA(true)
      markCTAShownThisSession()
    } else {
      setShowCTA(false)
    }
    setScreen('game-over')
  }

  function unlockAchievement(id: AchievementId) {
    setAchievements(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      saveAchievements(next)
      // Show toast
      const toastId = ++toastIdRef.current
      setToasts(t => [...t, { id: toastId, achievement: id }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== toastId)), 4500)
      return next
    })
  }

  function rollLevelCharges(c: CharacterSpec | null, rng: () => number): PowerupCharges {
    if (!c) return emptyCharges()
    const out: PowerupCharges = { ...c.powerupsPerLevel }
    if (c.id === 'biologist') {
      // +1 random powerup per level
      const list = POWERUP_LIST
      const pick = list[Math.floor(rng() * list.length)]
      out[pick.id] += 1
    }
    return out
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    music.setMuted(next)
    localStorage.setItem(MUTED_KEY, next ? '1' : '0')
  }

  function startMusicIfNeeded() {
    if (!music.isStarted()) music.start()
  }

  function pickMode(m: Mode) {
    setPendingMode(m)
    setScreen('character-select')
  }

  function startWithCharacter(id: CharacterId) {
    const c = CHARACTERS[id]
    setCharacter(c)
    if (pendingMode === 'daily') {
      startDaily(c)
    } else {
      startCampaign(c)
    }
  }

  function startDaily(c: CharacterSpec) {
    startMusicIfNeeded()
    setMode('daily')
    const startUpgrades = resolveStartingUpgrades(c)
    const startRun: RunState = { ...emptyRun(), upgrades: startUpgrades, ballsRemaining: ballsForLevel(startUpgrades, false, c, false) }
    setRun(startRun)
    setDailyAnteResults([])
    dailyAllPerfectRef.current = true
    dailyRngRef.current = mulberry32(hashString('daily-' + todayKey()))
    setLastWin(false)
    setCharges(rollLevelCharges(c, dailyRngRef.current))
    setScreen('playing')
  }

  function startCampaign(c: CharacterSpec) {
    startMusicIfNeeded()
    setMode('campaign')
    const startUpgrades = resolveStartingUpgrades(c)
    setRun({ ...emptyRun(), upgrades: startUpgrades })
    setLastWin(false)
    campaignRngRef.current = mulberry32(Math.floor(Math.random() * 0xffffffff))
    const map = generateMap(campaignRngRef.current)
    setCampaignMap(map)
    setCurrentNodeId(null)
    setVisitedNodeIds(new Set())
    setCharges(rollLevelCharges(c, campaignRngRef.current))
    setScreen('map')
  }

  // ---- Achievement handlers (from PeggleCanvas) ----
  function handleChainPeak(chain: number) {
    if (chain >= 25) unlockAchievement('chain-25')
  }
  function handleJackpot() {
    unlockAchievement('jackpot')
  }
  function handleGenePegCleared() {
    playerStatsRef.current.genePegsCleared += 1
    saveStats(playerStatsRef.current)
    if (playerStatsRef.current.genePegsCleared >= 50) unlockAchievement('genome-hunter')
  }

  function handlePowerupConsumed(id: PowerupId) {
    setCharges(prev => ({ ...prev, [id]: Math.max(0, prev[id] - 1) }))
  }

  // ---- Daily mode flow ----
  function handleDailyLevelEnd(result: LevelResult) {
    music.setIntensity(0)
    if (result.win) unlockAchievement('first-clear')

    const newScore = run.score + result.score
    const updatedBases = {
      A: run.bases.A + result.bases.A,
      T: run.bases.T + result.bases.T,
      G: run.bases.G + result.bases.G,
      C: run.bases.C + result.bases.C,
    }
    const ante: AnteResult = { cleared: result.win, perfect: result.win && result.ballsLeft >= 2 }
    if (!ante.perfect) dailyAllPerfectRef.current = false
    const newAnteResults = [...dailyAnteResults, ante]
    setDailyAnteResults(newAnteResults)

    saveHighScore(newScore)
    setRun({ ...run, score: newScore, bases: updatedBases, ballsRemaining: result.ballsLeft })

    if (!result.win) {
      while (newAnteResults.length < TOTAL_DAILY_ANTES) newAnteResults.push({ cleared: false, perfect: false })
      setDailyAnteResults(newAnteResults)
      saveDailyResult(newScore)
      setLastWin(false)
      goToGameOver()
      return
    }

    if (run.ante >= TOTAL_DAILY_ANTES) {
      saveDailyResult(newScore)
      setLastWin(true)
      // Daily-win achievements
      unlockAchievement('daily-win')
      if (dailyAllPerfectRef.current) unlockAchievement('perfect-daily')
      if (character?.id === 'surgeon') unlockAchievement('ironman')
      // Class win
      if (character) {
        const cw = new Set(classesWon)
        cw.add(character.id)
        setClassesWon(cw)
        saveClassesWon(cw)
        if (cw.size >= 4) unlockAchievement('all-classes')
      }
      goToGameOver()
      return
    }

    const choices = rollUpgradeChoices(run.upgrades, 3, dailyRngRef.current)
    if (choices.length === 0) {
      advanceDailyAnte(null)
    } else {
      setUpgradeChoices(choices)
      setScreen('upgrade')
    }
  }

  function advanceDailyAnte(picked: Upgrade | null) {
    setRun(prev => {
      const newUpgrades = picked ? [...prev.upgrades, picked] : prev.upgrades
      const nextAnte = prev.ante + 1
      const isBoss = nextAnte === TOTAL_DAILY_ANTES
      return {
        ...prev,
        ante: nextAnte,
        upgrades: newUpgrades,
        ballsRemaining: ballsForLevel(newUpgrades, false, character, isBoss),
      }
    })
    setCharges(rollLevelCharges(character, dailyRngRef.current))
    setScreen('playing')
  }

  // ---- Campaign mode flow ----
  function handleCampaignNodePick(nodeId: string) {
    if (!campaignMap) return
    const node = campaignMap.nodes[nodeId]
    setCurrentNodeId(nodeId)
    setVisitedNodeIds(prev => new Set([...prev, nodeId]))

    if (node.type === 'rest') {
      setRun(prev => ({ ...prev, ballsRemaining: ballsForLevel(prev.upgrades, false, character, false) }))
      setScreen('rest')
      return
    }
    if (node.type === 'lab') {
      const choices = rollUpgradeChoices(run.upgrades, 4, campaignRngRef.current)
      if (choices.length === 0) {
        setScreen('map')
        return
      }
      setIsLabPick(true)
      setUpgradeChoices(choices)
      setScreen('upgrade')
      return
    }
    const board: BoardSpec =
      node.type === 'boss' ? getBossBoard(campaignRngRef.current) :
      node.type === 'hard' ? generateAnomalyBoard(campaignRngRef.current) :
      pickRandomBoard(campaignRngRef.current, false)
    setPendingBoard(board)
    setPendingNodeType(node.type)
    setPendingHardMultiplier(node.type === 'hard' ? 1.5 : node.type === 'boss' ? 2 : 1)
    setRun(prev => ({
      ...prev,
      ballsRemaining: ballsForLevel(prev.upgrades, node.type === 'hard', character, node.type === 'boss'),
    }))
    setCharges(rollLevelCharges(character, campaignRngRef.current))
    setScreen('playing')
  }

  function handleCampaignLevelEnd(result: LevelResult) {
    music.setIntensity(0)
    if (result.win) unlockAchievement('first-clear')

    const earned = Math.round(result.score * pendingHardMultiplier)
    const newScore = run.score + earned
    const updatedBases = {
      A: run.bases.A + result.bases.A,
      T: run.bases.T + result.bases.T,
      G: run.bases.G + result.bases.G,
      C: run.bases.C + result.bases.C,
    }
    saveHighScore(newScore)

    setRun(prev => ({
      ...prev,
      score: newScore,
      bases: updatedBases,
      ballsRemaining: result.ballsLeft,
      ante: prev.ante + 1,
    }))

    if (!result.win) {
      setLastWin(false)
      goToGameOver()
      return
    }
    if (pendingNodeType === 'boss' && pendingBoard) {
      // Mark which boss was beaten
      const stats = playerStatsRef.current
      if (pendingBoard.id === 'boss-promethion') stats.bossesBeaten.promethion = true
      if (pendingBoard.id === 'boss-centrifuge') stats.bossesBeaten.centrifuge = true
      saveStats(stats)
      if (stats.bossesBeaten.promethion && stats.bossesBeaten.centrifuge) unlockAchievement('all-bosses')

      unlockAchievement('campaign-win')
      // Class win
      if (character) {
        const cw = new Set(classesWon)
        cw.add(character.id)
        setClassesWon(cw)
        saveClassesWon(cw)
        if (cw.size >= 4) unlockAchievement('all-classes')
      }
      setLastWin(true)
      goToGameOver()
      return
    }
    setScreen('map')
  }

  function handleRestContinue() {
    setScreen('map')
  }

  function handlePickUpgrade(u: Upgrade) {
    if (mode === 'daily') {
      setIsLabPick(false)
      advanceDailyAnte(u)
    } else {
      setRun(prev => ({ ...prev, upgrades: [...prev.upgrades, u] }))
      setIsLabPick(false)
      setScreen('map')
    }
  }

  function handleSkipUpgrade() {
    if (mode === 'daily') {
      setIsLabPick(false)
      advanceDailyAnte(null)
    } else {
      setIsLabPick(false)
      setScreen('map')
    }
  }

  function saveHighScore(score: number) {
    if (highScore !== null && score > highScore) {
      setHighScore(score)
      localStorage.setItem(HIGH_SCORE_KEY, String(score))
    }
  }

  function saveDailyResult(score: number) {
    localStorage.setItem(
      DAILY_RESULT_KEY,
      JSON.stringify({ day: todayKey(), score, results: dailyAnteResults }),
    )
    setDailyCompletedToday(true)
    setDailyTodayScore(score)
  }

  function handleMenu() {
    music.setIntensity(0)
    setScreen('menu')
  }

  function handlePlayAgain() {
    if (!character) {
      setScreen('character-select')
      return
    }
    if (mode === 'daily') startDaily(character)
    else startCampaign(character)
  }

  function handleThemeChange(t: ThemeId) {
    setTheme(t)
    saveTheme(t)
  }

  // Apply theme as a top-level CSS variable layer (read by .theme-bg on screens)
  const themeSpec = THEMES[theme]
  const themeStyle: React.CSSProperties = {
    ['--theme-bg' as string]: themeSpec.bg,
    ['--theme-accent' as string]: themeSpec.accent,
    ['--theme-primary' as string]: themeSpec.primary,
  }
  useEffect(() => {
    document.body.style.backgroundColor = themeSpec.bg
  }, [themeSpec.bg])

  let content: React.ReactNode
  if (screen === 'menu') {
    content = (
      <StartScreen
        onStartDaily={() => pickMode('daily')}
        onStartCampaign={() => pickMode('campaign')}
        onAchievements={() => setScreen('achievements')}
        achievementsCount={achievements.size}
        totalAchievements={Object.keys(ACHIEVEMENTS).length}
        highScore={highScore}
        dailyDoneToday={dailyCompletedToday}
        dailyTodayScore={dailyTodayScore}
      />
    )
  } else if (screen === 'character-select') {
    content = (
      <CharacterSelect
        modeLabel={pendingMode === 'daily' ? 'DAILY' : 'CAMPAIGN'}
        classesWon={classesWon}
        onPick={startWithCharacter}
        onBack={handleMenu}
      />
    )
  } else if (screen === 'achievements') {
    content = (
      <AchievementsScreen
        achievements={achievements}
        currentTheme={theme}
        onChangeTheme={handleThemeChange}
        onBack={handleMenu}
      />
    )
  } else if (screen === 'map' && campaignMap) {
    content = (
      <MapScreen
        map={campaignMap}
        currentNodeId={currentNodeId}
        visitedNodeIds={visitedNodeIds}
        run={run}
        character={character}
        onPickNode={handleCampaignNodePick}
      />
    )
  } else if (screen === 'upgrade') {
    content = (
      <UpgradePicker
        choices={upgradeChoices}
        ante={run.ante + (mode === 'daily' ? 1 : 0)}
        onPick={handlePickUpgrade}
        onSkip={handleSkipUpgrade}
        title={isLabPick ? 'Lab — pick an upgrade.' : 'Stock the bench.'}
      />
    )
  } else if (screen === 'rest') {
    content = (
      <RestScreen
        ballsRefilled={ballsForLevel(run.upgrades, false, character, false)}
        onContinue={handleRestContinue}
      />
    )
  } else if (screen === 'game-over') {
    const isDaily = mode === 'daily'
    const shareString = isDaily ? buildShareString(dailyAnteResults, run.score) : null
    content = (
      <RunSummary
        run={run}
        win={lastWin}
        highScore={highScore ?? 0}
        shareString={shareString}
        modeLabel={isDaily ? 'DAILY' : 'CAMPAIGN'}
        character={character}
        showLeaderboard={isDaily}
        showBiodiversityCTA={showCTA}
        onMaybeLaterCTA={() => setShowCTA(false)}
        onNeverAgainCTA={() => { dismissCTAForever(); setShowCTA(false) }}
        onPlayAgain={handlePlayAgain}
        onMenu={handleMenu}
      />
    )
  } else if (screen === 'playing') {
    let board: BoardSpec
    let initialBalls: number
    let totalAntes: number
    if (mode === 'daily') {
      board = getBoardForAnte(run.ante, TOTAL_DAILY_ANTES)
      const isBoss = run.ante === TOTAL_DAILY_ANTES
      initialBalls = ballsForLevel(run.upgrades, false, character, isBoss)
      totalAntes = TOTAL_DAILY_ANTES
    } else {
      board = pendingBoard ?? BOARDS[0]
      initialBalls = ballsForLevel(run.upgrades, pendingNodeType === 'hard', character, pendingNodeType === 'boss')
      totalAntes = 5
    }
    void isBossBoard
    content = (
      <GameScreen
        board={board}
        run={run}
        totalAntes={totalAntes}
        initialBalls={initialBalls}
        charges={charges}
        character={character}
        onLevelEnd={mode === 'daily' ? handleDailyLevelEnd : handleCampaignLevelEnd}
        onPowerupConsumed={handlePowerupConsumed}
        onChainPeak={handleChainPeak}
        onJackpot={handleJackpot}
        onGenePegCleared={handleGenePegCleared}
      />
    )
  }

  return (
    <div style={themeStyle}>
      {content}
      <MuteButton muted={muted} onToggle={toggleMute} />
      <div className="fixed top-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <AchievementToast key={t.id} achievement={ACHIEVEMENTS[t.achievement]} />
        ))}
      </div>
      {biokeaPromptOpen && (
        <BiokeaLeaderboardPrompt
          trigger="game-end"
          gameSlug="plasmid-plinko"
          gameTitle="Plasmid Plinko"
          score={{ value: run.score.toLocaleString(), label: 'Score', unit: 'pts' }}
          defaultHandle={loadHandle() ?? ''}
          onSubmit={(result) => {
            saveHandle(result.handle)
            setBiokeaPromptOpen(false)
            // Post the run immediately so the player doesn't have to also
            // tap the in-RunSummary Submit button. The Leaderboard panel
            // inside RunSummary will render in submitted state on its
            // next refresh because markSubmittedToday already fired.
            void submitDailyScore({
              day: todayKey(),
              handle: result.handle,
              score: run.score,
              antesCleared: run.upgrades.length,
              characterId: character?.id ?? null,
            }).then(() => {
              // Golden Sample 26: gate on this run's antes so a long-
              // ago level-3 run doesn't fire the reveal on a low-level
              // loss today. I won't tell. That would be cheating.
              void tryClaimGoldenSample({
                handle: result.handle,
                antesCleared: run.upgrades.length,
              })
            })
          }}
          onSkip={() => {
            setBiokeaPromptOpen(false)
            // Returning player skipping the email opt-in: still post
            // the run via existing handle so the score isn't dropped.
            const existing = loadHandle()
            if (existing) {
              void submitDailyScore({
                day: todayKey(),
                handle: existing,
                score: run.score,
                antesCleared: run.upgrades.length,
                characterId: character?.id ?? null,
              }).then(() => {
                void tryClaimGoldenSample({
                  handle: existing,
                  antesCleared: run.upgrades.length,
                })
              })
            }
          }}
        />
      )}
    </div>
  )
}

function pickRandomBoard(rng: () => number, hard: boolean): BoardSpec {
  void hard
  return BOARDS[Math.floor(rng() * BOARDS.length)]
}

export default App
