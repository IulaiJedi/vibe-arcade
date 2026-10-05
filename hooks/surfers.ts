// Tokensurfers as the mod runs it: every time the pane opens a new run waits
// for its first key, and the tokens taken go to a wallet kept between sessions.

import type { Arcade } from './arcade.ts'
import { RUN_KEYS } from './keys.ts'
import { act, newRun, score, step } from './run.ts'
import type { Move, Run } from './run.ts'
import { fitRun, paintRun, runSize } from './runpicture.ts'

const FRAME_MS = 50

let run: Run = newRun()
let best = 0
let wallet = 0

export const surfers: Arcade = {
  id: 'surfers',
  title: 'Tokensurfers',
  size: runSize,
  fit: fitRun,
  // Just the picture's width: the transcript keeps the rest of the screen
  wantColumns: 58,
  kept: ['wallet', 'runBest'],
  restore: (values) => {
    wallet = typeof values.wallet === 'number' ? values.wallet : 0
    best = typeof values.runBest === 'number' ? values.runBest : 0
  },
  open: () => {
    // A run cannot be picked up cold at speed, so each opening is a new one
    run = newRun()
  },
  tickMs: () => FRAME_MS,
  tick: () => {
    const was = run.state
    const had = run.tokens
    step(run, FRAME_MS / 1000)
    // Nothing moves before the first key; after a crash the rubble flies, and
    // then the screen that says so is drawn once
    if (was === 'over') {
      const isSettling = run.overFor < 0.75
      return isSettling ? { paint: true } : {}
    }
    if (was !== 'running') return {}
    if (run.state !== 'over') return { paint: true, redraw: run.tokens !== had }
    wallet += run.tokens
    best = Math.max(best, score(run))
    return { paint: true, redraw: true, save: { wallet, runBest: best } }
  },
  key: (key) => {
    const move = RUN_KEYS[key]
    if (!move) return {}
    act(run, move as Move)
    return { paint: true, redraw: true }
  },
  cells: () => paintRun(run, best, wallet),
  label: () => 'a d — дорожки · w — прыжок · s — подкат',
  score: () => 'tokensurfers: ' + score(run),
}
