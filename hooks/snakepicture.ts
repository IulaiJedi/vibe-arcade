// Draws Snake as a grid of terminal cells: a square of the field is two cells
// wide, as a cell is about twice as tall as it is wide.

import { base64 } from './picture.ts'
import { FIELD_TALL, FIELD_WIDE, score } from './snakegame.ts'
import type { Snake } from './snakegame.ts'

export const SNAKE_COLUMNS = FIELD_WIDE * 2 + 2
// A line of text, the frame's top and bottom, and the field between them
export const SNAKE_ROWS = FIELD_TALL + 3

const DEFAULT = 0x01000000
const FRAME = 0x808080
const FIELD = [0x1c3a1c, 0x214421]
const HEAD = 0xa6f07a
const EYE = 0x10200c
const NECK = [0x5fd35a, 0x2f8f3a]
const APPLE = 0xe5484d
const SHINE = 0xffa0a0
const WHITE = 0xffffff
const DIM = 0x909090
const GOLD = 0xf5c518
const HURT = 0xff3030
const PLATE = 0x202020

// A color part of the way from one to another
function between(from: number, to: number, part: number): number {
  const mix = (shift: number) => Math.round(((from >> shift) & 255) * (1 - part) + ((to >> shift) & 255) * part) << shift
  return mix(16) | mix(8) | mix(0)
}

export function paintSnake(snake: Snake, best: number, isPaused: boolean): string {
  const words = new Uint32Array(SNAKE_COLUMNS * SNAKE_ROWS * 3)
  const put = (column: number, row: number, glyph: string, color = DEFAULT, behind = DEFAULT) => {
    if (column < 0 || column >= SNAKE_COLUMNS || row < 0 || row >= SNAKE_ROWS) return
    words.set([glyph.codePointAt(0)!, color, behind], (row * SNAKE_COLUMNS + column) * 3)
  }
  const write = (column: number, row: number, text: string, color: number, behind = DEFAULT) => {
    ;[...text].forEach((glyph, i) => put(column + i, row, glyph, color, behind))
  }
  const square = (x: number, y: number, glyphs: string, color: number, behind: number) => {
    put(1 + x * 2, 2 + y, glyphs[0]!, color, behind)
    put(2 + x * 2, 2 + y, glyphs[1]!, color, behind)
  }

  for (let row = 0; row < SNAKE_ROWS; row++) {
    for (let column = 0; column < SNAKE_COLUMNS; column++) put(column, row, ' ')
  }
  write(0, 0, 'ЯБЛОКИ', DIM)
  write(7, 0, String(snake.apples), GOLD)
  write(18, 0, 'СЧЁТ', DIM)
  write(23, 0, String(score(snake)), WHITE)
  write(34, 0, 'РЕКОРД', DIM)
  write(41, 0, String(Math.max(best, score(snake))), WHITE)

  const right = SNAKE_COLUMNS - 1
  const bottom = SNAKE_ROWS - 1
  for (let column = 1; column < right; column++) {
    put(column, 1, '─', FRAME)
    put(column, bottom, '─', FRAME)
  }
  for (let row = 2; row < bottom; row++) {
    put(0, row, '│', FRAME)
    put(right, row, '│', FRAME)
  }
  put(0, 1, '┌', FRAME)
  put(right, 1, '┐', FRAME)
  put(0, bottom, '└', FRAME)
  put(right, bottom, '┘', FRAME)

  for (let y = 0; y < FIELD_TALL; y++) {
    for (let x = 0; x < FIELD_WIDE; x++) square(x, y, '  ', DEFAULT, FIELD[(x + y) & 1]!)
  }
  square(snake.apple.x, snake.apple.y, '▘ ', SHINE, APPLE)
  // The body darkens towards the tail
  const last = Math.max(1, snake.body.length - 1)
  snake.body.forEach((part, i) => {
    if (i > 0) square(part.x, part.y, '  ', DEFAULT, between(NECK[0]!, NECK[1]!, i / last))
  })
  const head = snake.body[0]!
  square(head.x, head.y, '••', snake.state === 'over' ? HURT : EYE, HEAD)

  // A few lines of text on a dark plate across the middle of the field
  const plate = (lines: [string, number][]) => {
    const width = 28
    const left = Math.floor((SNAKE_COLUMNS - width) / 2)
    const top = Math.floor(SNAKE_ROWS / 2) - 1
    ;[['', WHITE] as [string, number], ...lines, ['', WHITE] as [string, number]].forEach(([text, color], i) => {
      const pad = Math.max(0, Math.floor((width - [...text].length) / 2))
      write(left, top + i, (' '.repeat(pad) + text).padEnd(width), color, PLATE)
    })
  }
  if (snake.state === 'ready') {
    plate([
      ['ЗМЕЙКА', GOLD],
      ['любая клавиша — ' + (isPaused ? 'дальше' : 'старт'), WHITE],
    ])
  } else if (snake.state === 'over') {
    plate([
      ['КОНЕЦ ИГРЫ', HURT],
      ['счёт ' + score(snake), WHITE],
      ['r — заново', DIM],
    ])
  }

  return base64(new Uint8Array(words.buffer))
}
