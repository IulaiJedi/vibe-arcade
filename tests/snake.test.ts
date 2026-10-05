import { expect, test } from 'claude-code/testing'

import { FIELD_WIDE, HEADINGS, newSnake, score, step, stepMs, turn } from '../hooks/snakegame.ts'
import type { Snake } from '../hooks/snakegame.ts'

// The same apples in the same places every run
function fixedRandom() {
  let seed = 3
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

// A snake under way, with the apple out of its path
function running(): Snake {
  const snake = newSnake(fixedRandom())
  snake.state = 'running'
  snake.apple = { x: 0, y: 0 }
  return snake
}

test('a new snake waits, three squares long, with an apple off its body', async () => {
  const snake = newSnake(fixedRandom())
  expect(snake.state).toBe('ready')
  expect(snake.body.length).toBe(3)
  expect(snake.body.some((part) => part.x === snake.apple.x && part.y === snake.apple.y)).toBe(false)
  const head = { ...snake.body[0]! }
  step(snake)
  expect(snake.body[0]!.x).toBe(head.x)
})

test('each step moves the snake a square the way it is heading', async () => {
  const snake = running()
  const head = { ...snake.body[0]! }
  step(snake)
  expect(snake.body[0]!.x).toBe(head.x + 1)
  expect(snake.body.length).toBe(3)
  turn(snake, HEADINGS.up!)
  step(snake)
  expect(snake.body[0]!.y).toBe(head.y - 1)
})

test('a snake cannot turn back on itself, even by two quick keys', async () => {
  const snake = running()
  turn(snake, HEADINGS.left!)
  expect(snake.turns.length).toBe(0)
  // Up then left is a turn back done in two steps, and both are taken in order
  turn(snake, HEADINGS.up!)
  turn(snake, HEADINGS.down!)
  expect(snake.turns.length).toBe(1)
  turn(snake, HEADINGS.left!)
  expect(snake.turns.length).toBe(2)
  step(snake)
  step(snake)
  expect(snake.state).toBe('running')
})

test('an apple makes the snake a square longer and a little faster, and another one appears', async () => {
  const random = fixedRandom()
  const snake = running()
  const pace = stepMs(snake)
  snake.apple = { x: snake.body[0]!.x + 1, y: snake.body[0]!.y }
  step(snake, random)
  expect(snake.body.length).toBe(4)
  expect(score(snake)).toBe(10)
  expect(stepMs(snake) < pace).toBe(true)
  expect(snake.body.some((part) => part.x === snake.apple.x && part.y === snake.apple.y)).toBe(false)
})

test('the wall ends the game', async () => {
  const snake = running()
  for (let i = 0; i < FIELD_WIDE; i++) step(snake)
  expect(snake.state).toBe('over')
})

test('its own body ends the game, but the square its tail is leaving does not', async () => {
  const snake = running()
  // Long enough to reach itself by turning three times
  snake.body = [5, 4, 3, 2, 1].map((x) => ({ x, y: 5 }))
  for (const heading of ['down', 'left', 'up'] as const) {
    turn(snake, HEADINGS[heading]!)
    step(snake)
  }
  expect(snake.state).toBe('over')

  const chaser = running()
  // A square of four: the head moves into where the tail just was
  chaser.body = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 6, y: 6 },
    { x: 6, y: 5 },
  ]
  chaser.heading = HEADINGS.up!
  turn(chaser, HEADINGS.right!)
  step(chaser)
  expect(chaser.state).toBe('running')
})
