// The rules of Snake, with nothing of Claude Code in them: a snake on a
// walled field, the apple it is after, and what a turn and a step do.

export const FIELD_WIDE = 24
export const FIELD_TALL = 18

export type Point = { x: number; y: number }

export type Snake = {
  state: 'ready' | 'running' | 'over'
  // Head first
  body: Point[]
  heading: Point
  // Turns asked for and not yet taken, so two quick keys both count
  turns: Point[]
  apple: Point
  apples: number
}

export const HEADINGS: Record<string, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

function isSame(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y
}

// An apple lands on a free square; null when the snake fills the field
function freeSquare(body: Point[], random: () => number): Point | null {
  const free: Point[] = []
  for (let y = 0; y < FIELD_TALL; y++) {
    for (let x = 0; x < FIELD_WIDE; x++) {
      if (!body.some((part) => part.x === x && part.y === y)) free.push({ x, y })
    }
  }
  return free[Math.floor(random() * free.length)] ?? null
}

export function newSnake(random: () => number = Math.random): Snake {
  const y = Math.floor(FIELD_TALL / 2)
  const x = Math.floor(FIELD_WIDE / 2)
  const body = [0, 1, 2].map((back) => ({ x: x - back, y }))
  return { state: 'ready', body, heading: HEADINGS.right!, turns: [], apple: freeSquare(body, random)!, apples: 0 }
}

export function score(snake: Snake): number {
  return snake.apples * 10
}

// The snake speeds up as it grows, down to a floor
export function stepMs(snake: Snake): number {
  return Math.max(70, 150 - snake.apples * 4)
}

// A snake cannot turn back on itself, and a turn the same way is no turn
export function turn(snake: Snake, heading: Point) {
  const last = snake.turns.at(-1) ?? snake.heading
  if (last.x === heading.x || last.y === heading.y) return
  if (snake.turns.length < 2) snake.turns.push(heading)
}

export function step(snake: Snake, random: () => number = Math.random) {
  if (snake.state !== 'running') return
  snake.heading = snake.turns.shift() ?? snake.heading
  const head = { x: snake.body[0]!.x + snake.heading.x, y: snake.body[0]!.y + snake.heading.y }
  const isEating = isSame(head, snake.apple)
  // The tail's square is free to move into, as the tail moves on
  const inTheWay = isEating ? snake.body : snake.body.slice(0, -1)
  const isOut = head.x < 0 || head.x >= FIELD_WIDE || head.y < 0 || head.y >= FIELD_TALL
  if (isOut || inTheWay.some((part) => isSame(part, head))) {
    snake.state = 'over'
    return
  }
  snake.body.unshift(head)
  if (!isEating) {
    snake.body.pop()
    return
  }
  snake.apples += 1
  const apple = freeSquare(snake.body, random)
  if (apple) snake.apple = apple
  else snake.state = 'over'
}
