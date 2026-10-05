import { expect, test } from 'claude-code/testing'

import { COLS, ROWS, act, fallMs, fits, newGame, pieceCells, tick } from '../hooks/game.ts'
import type { Game } from '../hooks/game.ts'

// The same pieces in the same order every run
function fixedRandom() {
  let seed = 7
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

function filled(game: Game) {
  return game.board.flat().filter((cell) => cell !== 0).length
}

test('a new game has an empty well and a piece that fits', async () => {
  const game = newGame(fixedRandom())
  expect(filled(game)).toBe(0)
  expect(fits(game.board, game.piece)).toBe(true)
  expect(game.isOver).toBe(false)
})

test('a piece stops at the walls', async () => {
  const game = newGame(fixedRandom())
  for (let i = 0; i < COLS * 2; i++) act(game, 'left')
  expect(Math.min(...pieceCells(game.piece).map(([x]) => x))).toBe(0)
  for (let i = 0; i < COLS * 2; i++) act(game, 'right')
  expect(Math.max(...pieceCells(game.piece).map(([x]) => x))).toBe(COLS - 1)
})

test('four turns bring a piece back as it was', async () => {
  const game = newGame(fixedRandom())
  act(game, 'down')
  act(game, 'down')
  const before = JSON.stringify(pieceCells(game.piece).sort())
  for (let i = 0; i < 4; i++) act(game, 'rotate')
  expect(JSON.stringify(pieceCells(game.piece).sort())).toBe(before)
})

test('a dropped piece settles on the floor and the next one comes', async () => {
  const random = fixedRandom()
  const game = newGame(random)
  const next = game.next
  act(game, 'drop', random)
  expect(filled(game)).toBe(4)
  expect(game.board[ROWS - 1]!.some((cell) => cell !== 0)).toBe(true)
  expect(game.piece.type).toBe(next)
  expect(game.score > 0).toBe(true)
})

test('gravity lowers the piece a row at a time and settles it at the bottom', async () => {
  const random = fixedRandom()
  const game = newGame(random)
  const y = game.piece.y
  tick(game, random)
  expect(game.piece.y).toBe(y + 1)
  for (let i = 0; i < ROWS; i++) tick(game, random)
  expect(filled(game)).toBe(4)
})

test('a full row clears, scores and lets the rows above fall', async () => {
  const random = fixedRandom()
  const game = newGame(random)
  // The bottom row lacks only the squares an upright I piece fills
  game.board[ROWS - 1] = game.board[ROWS - 1]!.map((_, x) => (x === 0 ? 0 : 1))
  game.board[ROWS - 2]![5] = 2
  game.piece = { type: 'I', rot: 1, x: -2, y: 0 }
  expect(fits(game.board, game.piece)).toBe(true)
  act(game, 'drop', random)
  expect(game.lines).toBe(1)
  expect(game.score >= 100).toBe(true)
  // What stood on the cleared row is now on the floor, with the I's other three squares
  expect(game.board[ROWS - 1]![5]).toBe(2)
  expect(filled(game)).toBe(4)
})

test('the game ends when a new piece has no room', async () => {
  const random = fixedRandom()
  const game = newGame(random)
  for (let i = 0; i < ROWS * 4 && !game.isOver; i++) act(game, 'drop', random)
  expect(game.isOver).toBe(true)
  const score = game.score
  act(game, 'drop', random)
  expect(game.score).toBe(score)
})

test('pieces fall faster as the level rises, down to a floor', async () => {
  expect(fallMs(1) > fallMs(5)).toBe(true)
  expect(fallMs(99)).toBe(100)
})
