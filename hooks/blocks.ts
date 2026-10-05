// Blocks, the falling-pieces game, as the mod runs it: pieces fall while the
// pane is open, and the game waits where it was left until it opens again.

import type { Arcade, Change } from './arcade.ts'
import { act, fallMs, newGame, tick } from './game.ts'
import type { Action, Game } from './game.ts'
import { KEY_ACTIONS } from './keys.ts'
import { COLUMNS, PICTURE_ROWS, paint } from './picture.ts'

const MOVES: readonly string[] = ['left', 'right', 'rotate', 'down', 'drop']

let game: Game = newGame()
let best = 0

function settled(restart: boolean): Change {
  const change: Change = { paint: true, redraw: true, restart }
  if (game.isOver && game.score > best) {
    best = game.score
    change.save = { best }
  }
  return change
}

export const blocks: Arcade = {
  id: 'blocks',
  title: 'Блоки',
  size: () => ({ columns: COLUMNS, rows: PICTURE_ROWS }),
  kept: ['best'],
  restore: (values) => {
    best = typeof values.best === 'number' ? values.best : 0
  },
  open: () => {},
  tickMs: () => (game.isOver ? null : fallMs(game.level)),
  tick: () => {
    tick(game)
    return settled(false)
  },
  key: (key) => {
    const action = KEY_ACTIONS[key]
    if (action === 'new') {
      if (!game.isOver) return {}
      game = newGame()
      return settled(true)
    }
    if (!action || !MOVES.includes(action)) return {}
    const wasLevel = game.level
    act(game, action as Action)
    // A dropped piece starts the next one's fall afresh, as does a new level
    return settled(action === 'drop' || game.level !== wasLevel)
  },
  cells: () => paint(game, best),
  label: () => (game.isOver ? 'r — заново' : 'a d · w — поворот · s — вниз · пробел — сброс'),
  score: () => 'блоки: ' + game.score,
}
