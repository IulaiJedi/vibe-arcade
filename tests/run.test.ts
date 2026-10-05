import { expect, test } from 'claude-code/testing'

import { FAR, act, newRun, rowKinds, score, step } from '../hooks/run.ts'
import type { ObstacleKind, Run } from '../hooks/run.ts'

const FRAME = 0.05

// The same rows in the same order every run
function fixedRandom() {
  let seed = 11
  return () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
}

// A run under way on an empty track, with one thing a second ahead
function runTowards(kind: ObstacleKind, lane = 0): Run {
  const run = newRun()
  act(run, 'new')
  run.nextRowAt = Infinity
  run.obstacles = [{ lane, d: run.speed, kind }]
  return run
}

// Runs until the thing ahead has passed, making a move just before it arrives
function pass(run: Run, move?: 'jump' | 'slide' | 'left') {
  for (let i = 0; i < 40; i++) {
    if (i === 16 && move) act(run, move)
    step(run, FRAME)
  }
}

test('a run waits for its first key', async () => {
  const run = newRun()
  step(run, 1)
  expect(run.distance).toBe(0)
  act(run, 'jump')
  step(run, FRAME)
  expect(run.state).toBe('running')
  expect(run.distance > 0).toBe(true)
})

test('the runner stays on the three lanes', async () => {
  const run = newRun()
  for (let i = 0; i < 5; i++) act(run, 'left')
  expect(run.lane).toBe(-1)
  for (let i = 0; i < 5; i++) act(run, 'right')
  expect(run.lane).toBe(1)
})

test('a crate is crashed into, or jumped over', async () => {
  const crashed = runTowards('low')
  pass(crashed)
  expect(crashed.state).toBe('over')

  const jumped = runTowards('low')
  pass(jumped, 'jump')
  expect(jumped.state).toBe('running')
})

test('a beam is crashed into even in a jump, or slid under', async () => {
  const jumped = runTowards('high')
  pass(jumped, 'jump')
  expect(jumped.state).toBe('over')

  const slid = runTowards('high')
  pass(slid, 'slide')
  expect(slid.state).toBe('running')
})

test('a wall is only gone around', async () => {
  for (const move of ['jump', 'slide'] as const) {
    const run = runTowards('wall')
    pass(run, move)
    expect(run.state).toBe('over')
  }
  const around = runTowards('wall')
  pass(around, 'left')
  expect(around.state).toBe('running')
})

test('what stands in another lane is no harm', async () => {
  const run = runTowards('wall', 1)
  pass(run)
  expect(run.state).toBe('running')
})

test('tokens in the runner’s lane are taken and count for ten each', async () => {
  const run = newRun()
  act(run, 'new')
  run.nextRowAt = Infinity
  run.coins = [
    { lane: 0, d: 5, isTaken: false },
    { lane: 0, d: 7, isTaken: false },
    { lane: 1, d: 6, isTaken: false },
  ]
  for (let i = 0; i < 30; i++) step(run, FRAME)
  expect(run.tokens).toBe(2)
  expect(score(run)).toBe(Math.floor(run.distance) + 20)
})

test('every row leaves a way through', async () => {
  const random = fixedRandom()
  for (let i = 0; i < 2000; i++) {
    const kinds = rowKinds(random)
    expect(kinds.every((kind) => kind === 'wall')).toBe(false)
    expect(kinds.some((kind) => kind !== null)).toBe(true)
  }
})

test('rows come over the horizon as the run goes on, and the pace picks up', async () => {
  const random = fixedRandom()
  const run = newRun()
  act(run, 'new')
  const speed = run.speed
  step(run, FRAME, random)
  expect(run.obstacles.length > 0).toBe(true)
  expect(run.obstacles.every((obstacle) => obstacle.d <= FAR)).toBe(true)
  run.obstacles = []
  run.nextRowAt = Infinity
  for (let i = 0; i < 200; i++) step(run, FRAME, random)
  expect(run.speed > speed).toBe(true)
})

test('after a crash a key runs again, but not at once', async () => {
  const run = runTowards('wall')
  pass(run)
  expect(run.state).toBe('over')
  run.overFor = 0
  act(run, 'jump')
  expect(run.state).toBe('over')
  step(run, 0.6)
  act(run, 'jump')
  expect(run.state).toBe('running')
  expect(run.distance).toBe(0)
})
