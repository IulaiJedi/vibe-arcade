// The rules of Tokensurfers, with nothing of Claude Code in them: a runner on
// three lanes, what comes down the track at them, and what each move does.

export const FAR = 40
export const JUMP_S = 0.65
export const SLIDE_S = 0.6
const START_SPEED = 14
const MAX_SPEED = 30
// How far ahead of the runner a thing is when it reaches them
const HIT = 0.5
// A crash holds the screen this long, so a key mashed in play starts nothing
const OVER_HOLD_S = 0.5

// low is jumped over, high is slid under, a wall is only gone around
export type ObstacleKind = 'low' | 'high' | 'wall'
export type Obstacle = { lane: number; d: number; kind: ObstacleKind }
export type Coin = { lane: number; d: number; isTaken: boolean }

export type Run = {
  state: 'ready' | 'running' | 'over'
  // -1, 0 or 1, and where the runner is drawn while easing over to it
  lane: number
  x: number
  // Seconds left of the jump or the slide; 0 when on their feet
  jump: number
  slide: number
  speed: number
  distance: number
  tokens: number
  obstacles: Obstacle[]
  coins: Coin[]
  // The distance run at which the next row comes over the horizon
  nextRowAt: number
  overFor: number
  // Seconds since the run was made, and when a token was last taken: what the
  // picture animates by
  clock: number
  tokenAt: number
}

export type Move = 'left' | 'right' | 'jump' | 'slide' | 'new'

export function newRun(): Run {
  return {
    state: 'ready',
    lane: 0,
    x: 0,
    jump: 0,
    slide: 0,
    speed: START_SPEED,
    distance: 0,
    tokens: 0,
    obstacles: [],
    coins: [],
    nextRowAt: 0,
    overFor: 0,
    clock: 0,
    tokenAt: -1,
  }
}

export function score(run: Run): number {
  return Math.floor(run.distance) + run.tokens * 10
}

// How high the runner is, 0 on the ground to 1 at the top of the jump
export function jumpHeight(run: Run): number {
  if (run.jump <= 0) return 0
  const through = 1 - run.jump / JUMP_S
  return 4 * through * (1 - through)
}

function clears(run: Run, kind: ObstacleKind): boolean {
  if (kind === 'low') return run.jump > 0
  if (kind === 'high') return run.slide > 0
  return false
}

// Rows come about a second apart, a little closer as the run goes on
function rowGap(run: Run): number {
  return run.speed * (1.25 - Math.min(0.35, run.distance / 2500))
}

// A row always leaves a way through: never three walls, and never nothing
export function rowKinds(random: () => number): (ObstacleKind | null)[] {
  const kinds: (ObstacleKind | null)[] = [0, 1, 2].map(() => {
    const roll = random()
    return roll < 0.35 ? null : roll < 0.6 ? 'low' : roll < 0.8 ? 'high' : 'wall'
  })
  const lane = Math.floor(random() * 3)
  if (!kinds.some((kind) => kind !== 'wall')) kinds[lane] = null
  if (!kinds.some((kind) => kind !== null)) kinds[lane] = 'low'
  return kinds
}

function spawnRow(run: Run, random: () => number) {
  const kinds = rowKinds(random)
  kinds.forEach((kind, i) => {
    if (kind) run.obstacles.push({ lane: i - 1, d: FAR, kind })
  })
  // A line of tokens behind the row, in a lane the row leaves passable
  if (random() < 0.6) {
    const open = [0, 1, 2].filter((i) => kinds[i] !== 'wall')
    const lane = open[Math.floor(random() * open.length)]! - 1
    for (let i = 0; i < 4; i++) run.coins.push({ lane, d: FAR + 3 + i * 2, isTaken: false })
  }
  run.nextRowAt += rowGap(run)
}

export function step(run: Run, seconds: number, random: () => number = Math.random) {
  run.clock += seconds
  if (run.state === 'over') run.overFor += seconds
  if (run.state !== 'running') return
  const moved = run.speed * seconds
  run.distance += moved
  run.speed = Math.min(MAX_SPEED, START_SPEED + run.distance / 60)
  run.jump = Math.max(0, run.jump - seconds)
  run.slide = Math.max(0, run.slide - seconds)
  run.x += (run.lane - run.x) * Math.min(1, seconds * 18)

  for (const coin of run.coins) {
    const was = coin.d
    coin.d -= moved
    if (was > HIT && coin.d <= HIT && coin.lane === run.lane) {
      coin.isTaken = true
      run.tokens += 1
      run.tokenAt = run.clock
    }
  }
  for (const obstacle of run.obstacles) {
    const was = obstacle.d
    obstacle.d -= moved
    if (was > HIT && obstacle.d <= HIT && obstacle.lane === run.lane && !clears(run, obstacle.kind)) {
      run.state = 'over'
      run.overFor = 0
    }
  }
  run.coins = run.coins.filter((coin) => !coin.isTaken && coin.d > -3)
  run.obstacles = run.obstacles.filter((obstacle) => obstacle.d > -3)
  while (run.distance >= run.nextRowAt) spawnRow(run, random)
}

export function act(run: Run, move: Move) {
  if (run.state === 'over') {
    // Any key runs again, once the crash has been seen
    if (run.overFor >= OVER_HOLD_S) Object.assign(run, newRun(), { state: 'running' })
    return
  }
  // The first key starts the run, and counts as a move too
  run.state = 'running'
  if (move === 'left') run.lane = Math.max(-1, run.lane - 1)
  else if (move === 'right') run.lane = Math.min(1, run.lane + 1)
  else if (move === 'jump') {
    if (run.jump === 0) {
      run.jump = JUMP_S
      run.slide = 0
    }
  } else if (move === 'slide') {
    // Sliding in the air drops the runner at once
    run.slide = SLIDE_S
    run.jump = 0
  }
}
