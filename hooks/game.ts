// The rules of the game, with nothing of Claude Code in them: a board, the
// falling piece, and what each move does to both.

export const COLS = 10
export const ROWS = 20

export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const
export type PieceType = (typeof TYPES)[number]

const SHAPES: Record<PieceType, string[]> = {
  I: ['....', '####', '....', '....'],
  O: ['##', '##'],
  T: ['.#.', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
}

// Where a turned piece may shift to when it does not fit in place
const KICKS = [0, -1, 1, -2, 2]

const LINE_SCORES = [0, 100, 300, 500, 800]

export type Piece = { type: PieceType; rot: number; x: number; y: number }

export type Game = {
  // Row by row from the top; 0 is empty, otherwise 1 + the piece's place in TYPES
  board: number[][]
  piece: Piece
  next: PieceType
  bag: PieceType[]
  score: number
  lines: number
  level: number
  isOver: boolean
}

export type Action = 'left' | 'right' | 'rotate' | 'down' | 'drop'

// The squares a piece fills, as [column, row] within its own box
export function shapeCells(type: PieceType, rot: number): [number, number][] {
  let rows = SHAPES[type].map((row) => [...row])
  for (let turn = 0; turn < ((rot % 4) + 4) % 4; turn++) {
    const size = rows.length
    rows = rows.map((row, r) => row.map((_, c) => rows[size - 1 - c]![r]!))
  }
  const cells: [number, number][] = []
  rows.forEach((row, r) =>
    row.forEach((mark, c) => {
      if (mark === '#') cells.push([c, r])
    }),
  )
  return cells
}

export function pieceCells(piece: Piece): [number, number][] {
  return shapeCells(piece.type, piece.rot).map(([c, r]) => [piece.x + c, piece.y + r])
}

export function fits(board: number[][], piece: Piece): boolean {
  return pieceCells(piece).every(([x, y]) => x >= 0 && x < COLS && y < ROWS && (y < 0 || board[y]![x] === 0))
}

function emptyRow(): number[] {
  return Array.from({ length: COLS }, () => 0)
}

// Every seven pieces hold one of each, so no piece stays away for long
function draw(game: Pick<Game, 'bag'>, random: () => number): PieceType {
  if (game.bag.length === 0) {
    const bag = [...TYPES]
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j]!, bag[i]!]
    }
    game.bag = bag
  }
  return game.bag.pop()!
}

function spawn(type: PieceType): Piece {
  return { type, rot: 0, x: Math.floor((COLS - SHAPES[type].length) / 2), y: 0 }
}

export function newGame(random: () => number = Math.random): Game {
  const start = { bag: [] as PieceType[] }
  const first = draw(start, random)
  const next = draw(start, random)
  return {
    board: Array.from({ length: ROWS }, emptyRow),
    piece: spawn(first),
    next,
    bag: start.bag,
    score: 0,
    lines: 0,
    level: 1,
    isOver: false,
  }
}

// How long a piece rests on each row before it falls to the next
export function fallMs(level: number): number {
  return Math.max(100, 800 - (level - 1) * 70)
}

// The row the piece would come to rest on if dropped now
export function landingY(game: Game): number {
  let y = game.piece.y
  while (fits(game.board, { ...game.piece, y: y + 1 })) y += 1
  return y
}

function lock(game: Game, random: () => number) {
  for (const [x, y] of pieceCells(game.piece)) {
    if (y >= 0) game.board[y]![x] = TYPES.indexOf(game.piece.type) + 1
  }
  const kept = game.board.filter((row) => row.some((cell) => cell === 0))
  const cleared = ROWS - kept.length
  game.board = [...Array.from({ length: cleared }, emptyRow), ...kept]
  game.score += LINE_SCORES[cleared]! * game.level
  game.lines += cleared
  game.level = 1 + Math.floor(game.lines / 10)
  game.piece = spawn(game.next)
  game.next = draw(game, random)
  if (!fits(game.board, game.piece)) game.isOver = true
}

// Gravity: the piece falls a row, or settles where it stands
export function tick(game: Game, random: () => number = Math.random) {
  if (game.isOver) return
  const lower = { ...game.piece, y: game.piece.y + 1 }
  if (fits(game.board, lower)) game.piece = lower
  else lock(game, random)
}

export function act(game: Game, action: Action, random: () => number = Math.random) {
  if (game.isOver) return
  const { board, piece } = game
  if (action === 'left' || action === 'right') {
    const moved = { ...piece, x: piece.x + (action === 'left' ? -1 : 1) }
    if (fits(board, moved)) game.piece = moved
  } else if (action === 'rotate') {
    for (const kick of KICKS) {
      const turned = { ...piece, rot: (piece.rot + 1) % 4, x: piece.x + kick }
      if (fits(board, turned)) {
        game.piece = turned
        break
      }
    }
  } else if (action === 'down') {
    const lower = { ...piece, y: piece.y + 1 }
    if (fits(board, lower)) {
      game.piece = lower
      game.score += 1
    }
  } else if (action === 'drop') {
    const y = landingY(game)
    game.score += 2 * (y - piece.y)
    game.piece = { ...piece, y }
    lock(game, random)
  }
}
