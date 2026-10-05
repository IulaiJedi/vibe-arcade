// Snake as the mod runs it: the game waits where it was left while the pane
// is closed, and when the pane opens again it holds still until a key.

import type { Arcade } from './arcade.ts'
import { SNAKE_KEYS } from './keys.ts'
import { HEADINGS, newSnake, score, step, stepMs, turn } from './snakegame.ts'
import type { Snake } from './snakegame.ts'
import { SNAKE_COLUMNS, SNAKE_ROWS, paintSnake } from './snakepicture.ts'

let game: Snake = newSnake()
let best = 0
// Stopped by the pane closing, not yet started by a key
let isPaused = false

export const snake: Arcade = {
  id: 'snake',
  title: 'Змейка',
  size: () => ({ columns: SNAKE_COLUMNS, rows: SNAKE_ROWS }),
  // A little wider than the field, for the addresses under it
  wantColumns: SNAKE_COLUMNS + 8,
  kept: ['snakeBest'],
  restore: (values) => {
    best = typeof values.snakeBest === 'number' ? values.snakeBest : 0
  },
  open: () => {
    // A snake picked up at speed runs into the wall before it is seen
    if (game.state === 'running') {
      game.state = 'ready'
      isPaused = true
    }
  },
  tickMs: () => (game.state === 'running' ? stepMs(game) : null),
  tick: () => {
    const had = game.apples
    step(game)
    if (game.state !== 'over') return { paint: true, redraw: game.apples !== had, restart: game.apples !== had }
    if (score(game) <= best) return { paint: true, redraw: true }
    best = score(game)
    return { paint: true, redraw: true, save: { snakeBest: best } }
  },
  key: (key) => {
    const move = SNAKE_KEYS[key]
    if (!move) return {}
    if (game.state === 'over') {
      if (move !== 'new') return {}
      game = newSnake()
      game.state = 'running'
      return { paint: true, redraw: true, restart: true }
    }
    const heading = HEADINGS[move]
    if (heading) turn(game, heading)
    if (game.state === 'running') return {}
    // The first key starts the snake, and counts as a turn too
    game.state = 'running'
    isPaused = false
    return { paint: true, redraw: true, restart: true }
  },
  cells: () => paintSnake(game, best, isPaused),
  label: () => (game.state === 'over' ? 'r — заново' : 'w a s d — повороты'),
  score: () => 'змейка: ' + score(game),
}
