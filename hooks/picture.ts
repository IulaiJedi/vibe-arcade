// Draws a game as a grid of terminal cells: the well with its frame on the
// left, the score, the lines, the level, the next piece and the best score on
// the right. Colored cells show in any terminal, which pixels do not.

import { COLS, ROWS, TYPES, landingY, pieceCells, shapeCells } from './game.ts'
import type { Game } from './game.ts'

// A square of the well is two cells wide, as a cell is about twice as tall as
// it is wide
const WELL_COLUMNS = COLS * 2
const SIDE_LEFT = WELL_COLUMNS + 4
export const COLUMNS = SIDE_LEFT + 10
export const PICTURE_ROWS = ROWS + 2

const DEFAULT = 0x01000000
const FRAME = 0x808080
const DOT = 0x505050
const LABEL = 0x909090
const VALUE = 0xffffff
const COLORS = [0x00c8d7, 0xe6c229, 0xa259d9, 0x4caf50, 0xe5484d, 0x3d7fe0, 0xf08c2e]

function colorOf(square: number): number {
  return COLORS[square - 1] ?? VALUE
}

export function base64(bytes: Uint8Array): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let text = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    text += letters[a >> 2]! + letters[((a & 3) << 4) | ((b ?? 0) >> 4)]!
    text += b === undefined ? '=' : letters[((b & 15) << 2) | ((c ?? 0) >> 6)]!
    text += c === undefined ? '=' : letters[c & 63]!
  }
  return text
}

// The Raster's cells: three numbers a cell, the glyph, its color and the
// color behind it
export function paint(game: Game, best: number): string {
  const words = new Uint32Array(COLUMNS * PICTURE_ROWS * 3)
  const put = (column: number, row: number, glyph: string, color = DEFAULT, behind = DEFAULT) => {
    if (column < 0 || column >= COLUMNS || row < 0 || row >= PICTURE_ROWS) return
    words.set([glyph.codePointAt(0)!, color, behind], (row * COLUMNS + column) * 3)
  }
  const write = (column: number, row: number, text: string, color: number) => {
    ;[...text].forEach((glyph, i) => put(column + i, row, glyph, color))
  }
  const square = (x: number, y: number, glyph: string, color: number, behind: number) => {
    put(1 + x * 2, 1 + y, glyph, color, behind)
    put(2 + x * 2, 1 + y, glyph, color, behind)
  }

  for (let row = 0; row < PICTURE_ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) put(column, row, ' ')
  }

  const right = WELL_COLUMNS + 1
  const bottom = ROWS + 1
  for (let column = 1; column < right; column++) {
    put(column, 0, '─', FRAME)
    put(column, bottom, '─', FRAME)
  }
  for (let row = 1; row < bottom; row++) {
    put(0, row, '│', FRAME)
    put(right, row, '│', FRAME)
  }
  put(0, 0, '┌', FRAME)
  put(right, 0, '┐', FRAME)
  put(0, bottom, '└', FRAME)
  put(right, bottom, '┘', FRAME)

  game.board.forEach((line, y) =>
    line.forEach((filled, x) => {
      if (filled) square(x, y, ' ', DEFAULT, colorOf(filled))
      else put(2 + x * 2, 1 + y, '·', DOT)
    }),
  )

  if (!game.isOver) {
    const color = colorOf(TYPES.indexOf(game.piece.type) + 1)
    // Where the piece would land, drawn faintly under the piece itself
    const landing = landingY(game)
    for (const [x, y] of pieceCells({ ...game.piece, y: landing })) {
      if (y >= 0) square(x, y, '░', color, DEFAULT)
    }
    for (const [x, y] of pieceCells(game.piece)) {
      if (y >= 0) square(x, y, ' ', DEFAULT, color)
    }
  }

  write(SIDE_LEFT, 1, 'СЧЁТ', LABEL)
  write(SIDE_LEFT, 2, String(game.score), VALUE)
  write(SIDE_LEFT, 4, 'ЛИНИИ', LABEL)
  write(SIDE_LEFT, 5, String(game.lines), VALUE)
  write(SIDE_LEFT, 7, 'УРОВЕНЬ', LABEL)
  write(SIDE_LEFT, 8, String(game.level), VALUE)
  write(SIDE_LEFT, 10, 'ДАЛЕЕ', LABEL)
  const nextColor = colorOf(TYPES.indexOf(game.next) + 1)
  for (const [x, y] of shapeCells(game.next, 0)) {
    put(SIDE_LEFT + x * 2, 12 + y, ' ', DEFAULT, nextColor)
    put(SIDE_LEFT + x * 2 + 1, 12 + y, ' ', DEFAULT, nextColor)
  }
  write(SIDE_LEFT, 17, 'РЕКОРД', LABEL)
  write(SIDE_LEFT, 18, String(Math.max(best, game.score)), VALUE)

  if (game.isOver) {
    const lines = ['', '   ИГРА ОКОНЧЕНА', '', '    r — заново', '']
    lines.forEach((line, i) => {
      const text = line.padEnd(WELL_COLUMNS)
      ;[...text].forEach((glyph, column) => put(1 + column, 8 + i, glyph, VALUE, 0x202020))
    })
  }

  return base64(new Uint8Array(words.buffer))
}
