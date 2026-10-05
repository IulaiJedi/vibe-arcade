// Draws a run: three railway tracks running off to the horizon through a
// blocky country, what comes down them, the runner seen from behind.
//
// A terminal cell shows four pixels, two across and two down, as a quadrant
// block in one color on another. The picture keeps to a modest width, so the
// pane leaves the transcript most of the screen, and shrinks to a small pane.
// Everything is laid out in units of a 56 by 52 drawing and scaled to fit.

import { FAR, jumpHeight, score } from './run.ts'
import type { Run } from './run.ts'
import { base64 } from './picture.ts'

const UNITS_WIDE = 56
const UNITS_TALL = 52
const HORIZON = 18
// The row the runner's feet stand on
const GROUND = 47
const CENTER = 28
// A lane's width where the runner stands
const LANE = 14
// How fast things shrink with distance
const DEPTH = 0.18

const DEFAULT = 0x01000000
const SKY = [0x2f7fd8, 0x4a98e6, 0x67b0f0, 0x86c5f6, 0xa8d8fa, 0xc9e8fc]
const SUN = 0xfff0a0
const SUN_HALO = 0xffe066
const CLOUD = 0xffffff
const CLOUD_UNDER = 0xdbe9f5
const PEAK = 0x7f9fc0
const SNOW = 0xf4f8fc
const HILL = 0x3f7f32
const HILL_TOP = 0x4f9a40
const GRASS = [0x5aa846, 0x4c9a3a]
const FLOWERS = [0xffe066, 0xffffff, 0xe5484d]
const CURB = 0xb9b2a4
const GRAVEL = [0x8a7a68, 0x7d6e5d]
const GAP = 0x5e5245
const SLEEPER = 0x5a4030
const RAIL = 0xd0d4d8
const TRUNK = 0x6b4a2b
const LEAVES = [0x2f8f3a, 0x3fa84a, 0x237030]
const ROCK = [0x8d8d8d, 0xb4b4b4, 0x5e5e5e]
const CRATE = [0xb5803c, 0x94682c, 0x7a5424, 0xd6a45a]
const BRICK = [0x8d8d8d, 0x9c9c9c, 0x7f7f7f, 0x5e5e5e, 0xb4b4b4]
const HAZARD = [0xf2c200, 0x2a2a2a, 0xffe066, 0x555555]
const GOLD = 0xf5c518
const GOLD_LIGHT = 0xfff2a0
const GOLD_DARK = 0xb8860b
const SKIN = 0xe8b98a
const HAIR = 0x4a2f1b
const SHIRT = 0xd97757
const PACK = 0x8a4a32
const PACK_LIGHT = 0xa86040
const HURT = 0xff3030
const PANTS = 0x2f4a8a
const SHOE = 0xf0f0f0
const SHADOW = 0x3a2c1e
const WHITE = 0xffffff
const DIM = 0x909090
const PLATE = 0x202020

// The sixteen ways to fill a cell's four quarters, by which are filled: upper
// left 1, upper right 2, lower left 4, lower right 8
const QUADRANTS = ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█'

let columns = UNITS_WIDE
let rows = 27

// Takes the room the pane has, up to the picture's own width, keeping its proportions
export function fitRun(bodyColumns: number, bodyRows: number | undefined) {
  // With the picture go its line of text above and the two lines below
  const most = Math.max(10, (bodyRows ?? 40) - 3)
  columns = Math.max(40, Math.min(UNITS_WIDE, Math.floor(bodyColumns)))
  let pixelRows = Math.round((columns * UNITS_TALL) / 2 / UNITS_WIDE)
  if (pixelRows > most) {
    pixelRows = most
    columns = Math.floor((pixelRows * 2 * UNITS_WIDE) / UNITS_TALL)
  }
  rows = pixelRows + 1
}

export function runSize() {
  return { columns, rows }
}

function fraction(n: number): number {
  return n - Math.floor(n)
}

// The same number for the same place every frame, so the country stays put
function hash(a: number, b = 0): number {
  return fraction(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453)
}

function distance2(a: number, b: number): number {
  const red = ((a >> 16) & 255) - ((b >> 16) & 255)
  const green = ((a >> 8) & 255) - ((b >> 8) & 255)
  const blue = (a & 255) - (b & 255)
  return red * red + green * green + blue * blue
}

export function paintRun(run: Run, best: number, wallet: number): string {
  const wide = columns * 2
  const tall = (rows - 1) * 2
  // Pixels across and down for each unit of the drawing
  const sx = wide / UNITS_WIDE
  const sy = tall / UNITS_TALL
  const pixels = new Uint32Array(wide * tall)

  // A rectangle in units, colored flat or by where in it a pixel lies; a
  // pixel whose color comes out negative is left as it was
  const fill = (left: number, top: number, width: number, height: number, color: number | ((u: number, v: number) => number)) => {
    const x0 = Math.max(0, Math.round(left * sx))
    const y0 = Math.max(0, Math.round(top * sy))
    const x1 = Math.min(wide, Math.max(Math.round((left + width) * sx), Math.round(left * sx) + 1))
    const y1 = Math.min(tall, Math.max(Math.round((top + height) * sy), Math.round(top * sy) + 1))
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const picked =
          typeof color === 'number' ? color : color(((x + 0.5) / sx - left) / width, ((y + 0.5) / sy - top) / height)
        if (picked >= 0) pixels[y * wide + x] = picked
      }
    }
  }
  const disc = (x: number, y: number, rx: number, ry: number, color: number) =>
    fill(x - rx, y - ry, rx * 2, ry * 2, (u, v) => ((u * 2 - 1) ** 2 + (v * 2 - 1) ** 2 <= 1 ? color : -1))

  // The sky, lighter towards the horizon, with the sun and drifting clouds
  SKY.forEach((color, i) => fill(0, i * 3, UNITS_WIDE, 3.5, color))
  disc(45, 5, 3.6, 3.6, SUN_HALO)
  disc(45, 5, 2.6, 2.6, SUN)
  for (const [start, height, size, speed] of [
    [6, 4, 1, 0.5],
    [30, 8, 0.8, 0.3],
    [52, 3, 0.6, 0.4],
  ] as const) {
    const x = fraction((start + run.clock * speed) / 80) * 80 - 12
    disc(x + 4 * size, height + 1.6 * size, 5 * size, 1.4 * size, CLOUD_UNDER)
    disc(x + 4 * size, height + 1 * size, 4.6 * size, 1.3 * size, CLOUD)
    disc(x + 3 * size, height, 2.4 * size, 1.4 * size, CLOUD)
    disc(x + 6 * size, height + 0.3 * size, 1.8 * size, 1.1 * size, CLOUD)
  }
  // Far peaks, then the green hills in front of them, both built of blocks
  for (let i = 0; i < UNITS_WIDE / 3; i++) {
    const height = 2 + Math.floor(hash(i, 7) * 6)
    fill(i * 3, HORIZON - height, 3, height, PEAK)
    if (height >= 6) fill(i * 3, HORIZON - height, 3, 1.2, SNOW)
  }
  for (let i = 0; i < UNITS_WIDE / 2; i++) {
    const height = 1 + Math.floor(hash(i, 50) * 3)
    fill(i * 2, HORIZON - height, 2, height + 0.5, HILL)
    fill(i * 2, HORIZON - height, 2, 0.6, HILL_TOP)
  }

  // The ground, pixel by pixel: where on the track or the grass each one lies
  const firstGround = Math.round(HORIZON * sy)
  for (let y = firstGround; y < tall; y++) {
    const size = Math.max(0.001, ((y + 0.5) / sy - HORIZON) / (GROUND - HORIZON))
    const d = (1 / size - 1) / DEPTH
    const along = d + run.distance
    // The stripes slide towards the runner, which is what reads as speed
    const stripe = Math.floor(along / 3) & 1
    const isNear = size > 0.22
    for (let x = 0; x < wide; x++) {
      // In lanes from the middle of the track
      const across = ((x + 0.5) / sx - CENTER) / (LANE * size)
      const off = Math.abs(across)
      let color: number
      if (off > 1.62) {
        color = GRASS[stripe]!
        if (isNear) {
          const bloom = hash(Math.floor(across * 8), Math.floor(along * 4))
          if (bloom > 0.975) color = FLOWERS[Math.floor(bloom * 1000) % 3]!
        }
      } else if (off > 1.5) {
        color = CURB
      } else {
        const inLane = fraction(across + 1.5) - 0.5
        const side = Math.abs(inLane)
        if (side > 0.46) color = GAP
        else if (side > 0.24 && side < 0.31) color = RAIL
        else if (isNear && side < 0.4 && fraction(along / 1.6) < 0.35) color = SLEEPER
        else color = GRAVEL[stripe]!
      }
      pixels[y * wide + x] = color
    }
  }

  // Where a point on the ground is drawn: lanes across, distance ahead
  const place = (across: number, d: number) => {
    const size = 1 / (1 + DEPTH * d)
    return { size, x: CENTER + across * LANE * size, y: HORIZON + (GROUND - HORIZON) * size }
  }
  // A block standing on the ground: its front, a lit top, and for one off to
  // the side the shaded flank that faces the middle of the track
  const box = (
    across: number,
    d: number,
    width: number,
    height: number,
    lift: number,
    face: number | ((u: number, v: number) => number),
    top: number,
    flank: number,
  ) => {
    const at = place(across, d)
    const left = at.x - (width * at.size) / 2
    const upper = at.y - (lift + height) * at.size
    if (across !== 0) {
      const deep = 1.8 * at.size * Math.min(1.5, Math.abs(across))
      fill(across < 0 ? left + width * at.size : left - deep, upper - 0.6 * at.size, deep, height * at.size, flank)
    }
    fill(left, upper - 1.2 * at.size, width * at.size, 1.3 * at.size, top)
    fill(left, upper, width * at.size, height * at.size, face)
  }

  const crateFace = (u: number, v: number) => {
    if (u < 0.1 || u > 0.9 || v < 0.14 || v > 0.86) return CRATE[2]!
    if (Math.abs(u - v) < 0.09 || Math.abs(u + v - 1) < 0.09) return CRATE[1]!
    return CRATE[0]!
  }
  const brickFace = (u: number, v: number) => {
    const course = Math.floor(v * 6)
    const along = u * 3 + (course % 2) * 0.5
    if (fraction(v * 6) < 0.16 || fraction(along) < 0.08) return BRICK[3]!
    return BRICK[Math.floor(hash(course, Math.floor(along)) * 3)]!
  }
  const hazardFace = (u: number, v: number) => (fraction(u * 5 + v * 0.8) < 0.5 ? HAZARD[0]! : HAZARD[1]!)

  type Drawn = { d: number; draw: () => void }
  const drawn: Drawn[] = []

  // Trees and boulders along both sides of the track
  const firstPlot = Math.floor(run.distance / 5) + 1
  for (let plot = firstPlot; plot < firstPlot + 9; plot++) {
    const d = plot * 5 - run.distance
    for (const side of [-1, 1]) {
      const roll = hash(plot, side)
      const across = side * (2.3 + hash(plot, side * 3) * 1.2)
      if (roll < 0.5) {
        drawn.push({
          d,
          draw: () => {
            const at = place(across, d)
            fill(at.x - 1.3 * at.size, at.y - 7 * at.size, 2.6 * at.size, 7 * at.size, TRUNK)
            box(across, d, 10, 8, 6, (u, v) => (v > 0.8 ? LEAVES[2]! : hash(Math.floor(u * 4) + plot, Math.floor(v * 4)) > 0.6 ? LEAVES[1]! : LEAVES[0]!), LEAVES[1]!, LEAVES[2]!)
          },
        })
      } else if (roll < 0.68) {
        drawn.push({ d, draw: () => box(across, d, 5, 3.5, 0, ROCK[0]!, ROCK[1]!, ROCK[2]!) })
      }
    }
  }

  for (const obstacle of run.obstacles) {
    const { d, lane, kind } = obstacle
    if (kind === 'low') drawn.push({ d, draw: () => box(lane, d, 11, 6, 0, crateFace, CRATE[3]!, CRATE[2]!) })
    else if (kind === 'wall') drawn.push({ d, draw: () => box(lane, d, 12, 17, 0, brickFace, BRICK[4]!, BRICK[3]!) })
    else {
      // A striped beam on two posts, with room to slide under
      drawn.push({
        d,
        draw: () => {
          const at = place(lane, d)
          fill(at.x - 6 * at.size, at.y - 7 * at.size, 1.3 * at.size, 7 * at.size, HAZARD[3]!)
          fill(at.x + 4.7 * at.size, at.y - 7 * at.size, 1.3 * at.size, 7 * at.size, HAZARD[3]!)
          box(lane, d, 12, 4, 7, hazardFace, HAZARD[2]!, HAZARD[1]!)
        },
      })
    }
  }
  for (const coin of run.coins) {
    drawn.push({
      d: coin.d,
      draw: () => {
        const at = place(coin.lane, coin.d)
        // A token turns as it hangs, so it narrows and widens
        const turn = Math.max(0.25, Math.abs(Math.cos(run.clock * 5 + coin.d + run.distance)))
        const y = at.y - 4.5 * at.size
        disc(at.x, y, 2 * at.size * turn, 2 * at.size, GOLD_DARK)
        disc(at.x, y, 1.7 * at.size * turn, 1.7 * at.size, GOLD)
        disc(at.x - 0.3 * at.size * turn, y - 0.4 * at.size, 0.8 * at.size * turn, 0.8 * at.size, GOLD_LIGHT)
      },
    })
  }
  drawn
    .filter((one) => one.d > 0.2 && one.d <= FAR + 12)
    .sort((a, b) => b.d - a.d)
    .forEach((one) => one.draw())

  // The runner
  const x = CENTER + run.x * LANE
  const up = jumpHeight(run)
  const feet = GROUND - up * 10
  const isHurt = run.state === 'over'
  const shirt = isHurt ? HURT : SHIRT
  disc(x, GROUND + 0.8, 3.6 - up * 1.4, 0.7, SHADOW)
  if (run.slide > 0) {
    // Ducked low: knees wide, back bent, head between the shoulders
    fill(x - 3.6, feet - 2, 2.4, 2, PANTS)
    fill(x + 1.2, feet - 2, 2.4, 2, PANTS)
    fill(x - 3.6, feet - 0.8, 2.4, 0.8, SHOE)
    fill(x + 1.2, feet - 0.8, 2.4, 0.8, SHOE)
    fill(x - 3.2, feet - 4.6, 6.4, 3, shirt)
    fill(x - 2, feet - 4.4, 4, 2.4, PACK)
    fill(x - 2, feet - 4.4, 4, 0.6, PACK_LIGHT)
    fill(x - 2.1, feet - 6.4, 4.2, 2.2, HAIR)
  } else {
    const isAir = up > 0
    // The legs and arms take turns while running, and tuck in the air
    const swing = isAir || run.state !== 'running' ? 0 : Math.sin(run.distance * 2.2)
    const tuck = isAir ? 1.2 : 0
    const leg = (side: number, lifted: number) => {
      fill(x + side * 1.5 - 1, feet - 3.8, 2, 3.8 - lifted - tuck, PANTS)
      fill(x + side * 1.5 - 1, feet - 0.9 - lifted - tuck, 2, 0.9, SHOE)
    }
    leg(-1, Math.max(0, swing) * 1.3)
    leg(1, Math.max(0, -swing) * 1.3)
    const arm = (side: number, raised: number) => {
      const top = feet - 7.8 - raised
      fill(x + side * 3.7 - 0.7, top, 1.4, 1.6, shirt)
      fill(x + side * 3.7 - 0.7, top + 1.6, 1.4, 1.8, SKIN)
    }
    arm(-1, isAir ? 2.2 : -swing * 0.9)
    arm(1, isAir ? 2.2 : swing * 0.9)
    fill(x - 3, feet - 8, 6, 4.4, shirt)
    fill(x - 1.9, feet - 7.6, 3.8, 3.2, PACK)
    fill(x - 1.9, feet - 7.6, 3.8, 0.7, PACK_LIGHT)
    fill(x - 0.8, feet - 8.6, 1.6, 0.7, SKIN)
    fill(x - 2.1, feet - 12.2, 4.2, 2.8, HAIR)
    fill(x - 2.1, feet - 9.5, 4.2, 1, SKIN)
  }

  // A burst of sparks for a token just taken, and of rubble for a crash
  const sinceToken = run.clock - run.tokenAt
  if (run.tokenAt >= 0 && sinceToken < 0.35) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const reach = 2 + sinceToken * 16
      fill(x + Math.cos(angle) * reach - 0.3, feet - 6 - Math.sin(angle) * reach, 0.7, 0.7, i % 2 ? GOLD : GOLD_LIGHT)
    }
  }
  if (isHurt && run.overFor < 0.7) {
    for (let i = 0; i < 12; i++) {
      const angle = hash(i, 3) * Math.PI
      const speed = 14 + hash(i, 5) * 16
      const t = run.overFor
      fill(x + Math.cos(angle) * speed * t, feet - 5 - Math.sin(angle) * speed * t + 30 * t * t, 1, 1, [CRATE[0]!, BRICK[0]!, HAZARD[0]!][i % 3]!)
    }
  }

  const words = new Uint32Array(columns * rows * 3)
  const put = (column: number, row: number, glyph: string, color: number, behind: number) => {
    if (column < 0 || column >= columns || row < 0 || row >= rows) return
    words.set([glyph.codePointAt(0)!, color, behind], (row * columns + column) * 3)
  }
  const write = (column: number, row: number, text: string, color: number, behind = DEFAULT) => {
    ;[...text].forEach((glyph, i) => put(column + i, row, glyph, color, behind))
  }

  for (let column = 0; column < columns; column++) put(column, 0, ' ', DEFAULT, DEFAULT)
  const middle = Math.floor(columns * 0.36)
  const right = Math.floor(columns * 0.7)
  write(0, 0, 'ТОКЕНЫ', DIM)
  write(7, 0, String(run.tokens), GOLD)
  write(middle, 0, 'СЧЁТ', DIM)
  write(middle + 5, 0, String(score(run)), WHITE)
  write(right, 0, 'РЕКОРД', DIM)
  write(right + 7, 0, String(Math.max(best, score(run))), WHITE)

  // Each cell takes the two colors most of its four pixels have; the others
  // go to whichever of the two is nearer
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns; column++) {
      const base = row * 2 * wide + column * 2
      const four = [pixels[base]!, pixels[base + 1]!, pixels[base + wide]!, pixels[base + wide + 1]!]
      let first = four[0]!
      let second = -1
      let firstCount = 0
      let secondCount = 0
      for (const color of four) {
        const count = four.filter((other) => other === color).length
        if (color === first) firstCount = count
        else if (count > secondCount) {
          second = color
          secondCount = count
        }
      }
      if (secondCount > firstCount) [first, second] = [second, first]
      let filled = 0
      four.forEach((color, i) => {
        const isFirst = second < 0 || color === first || (color !== second && distance2(color, first) <= distance2(color, second))
        if (isFirst) filled |= 1 << i
      })
      put(column, row + 1, QUADRANTS[filled]!, first, second < 0 ? first : second)
    }
  }

  // A few lines of text on a dark plate across the middle of the picture
  const plate = (lines: [string, number][]) => {
    const width = 30
    const left = Math.floor((columns - width) / 2)
    const top = Math.floor(rows / 2) - 2
    ;[['', WHITE] as [string, number], ...lines, ['', WHITE] as [string, number]].forEach(([text, color], i) => {
      const pad = Math.max(0, Math.floor((width - [...text].length) / 2))
      write(left, top + i, (' '.repeat(pad) + text).padEnd(width), color, PLATE)
    })
  }
  if (run.state === 'ready') {
    plate([
      ['TOKENSURFERS', GOLD],
      ['в кошельке: ' + wallet, DIM],
      ['любая клавиша — старт', WHITE],
    ])
  } else if (isHurt && run.overFor >= 0.5) {
    plate([
      ['СТОЛКНОВЕНИЕ', HURT],
      ['счёт ' + score(run) + ' · токены +' + run.tokens, WHITE],
      ['любая клавиша — заново', DIM],
    ])
  }

  return base64(new Uint8Array(words.buffer))
}
