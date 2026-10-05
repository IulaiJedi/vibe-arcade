// vibe-arcade: opens a game beside the transcript while Claude works and
// hands you back when it's done, or as soon as it needs you. Three games,
// Blocks, Tokensurfers and Snake; the one asked for last is the one that opens.

import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Arcade, Change } from './arcade.ts'
import { blocks } from './blocks.ts'
import { snake } from './snake.ts'
import { surfers } from './surfers.ts'

const PANE = 'vibe-arcade'
const DROP_IN_DELAY_MS = 10000
const COUNTDOWN_SECONDS = 3
const GAMES = [blocks, surfers, snake]
// Where to find the author, at the foot of the pane under every game. Plain
// text: a terminal that cannot hide an address under a word writes both out
const SUBSCRIBE = ['jedicoder.store · t.me/vibecodejedi', 'github.com/IulaiJedi · instagram.com/iulaijedi']

// Whether the person turned the mod on and which game they asked for last,
// both kept between sessions in $.store
let isOn = false
let game: Arcade = blocks

// Where play stands:
//   idle      not playing, whether or not Claude is working
//   waiting   Claude is working; dropping in once the delay passes
//   offered   the terminal was too narrow for the pane to open by itself, so
//             the band above the prompt offers a key that opens it
//   playing   the pane is open and the game runs
//   countdown Claude is done; closing when the count reaches zero
let phase: 'idle' | 'waiting' | 'offered' | 'playing' | 'countdown' = 'idle'
let isTurnRunning = false
// Closed by hand during this turn, so stay out until the next one
let isDismissed = false
let timer: Timer | null = null
let countdown = 0
let tickTimer: Timer | null = null

// How many of the input region's keys have been played
let keysPlayed = 0
// How many letters the pane's field has taken; each one draws the field anew
// and blank, so the letters never pile up in it
let typedDraws = 0

function cancelTimer() {
  timer?.cancel()
  timer = null
}

function isPlaying() {
  return phase === 'playing' || phase === 'countdown'
}

// Carries out what a game said changed
async function apply($: EngineInterface, change: Change) {
  for (const [key, value] of Object.entries(change.save ?? {})) await $.store.set(key, value)
  if (change.restart) scheduleTick($)
  if (!isPlaying()) return
  if (change.redraw) $.ui.invalidate('ui.render')
  if (change.paint) await $.ui.blit({ requestId: PANE, key: game.id, cells: game.cells() }).catch(() => {})
}

function stopTicking() {
  tickTimer?.cancel()
  tickTimer = null
}

// The game's own clock: a falling piece, a frame of a run
function scheduleTick($: EngineInterface) {
  stopTicking()
  const ms = isPlaying() ? game.tickMs() : null
  if (ms === null) return
  tickTimer = $.clock.after(ms, () => {
    const change = game.tick()
    // A change that restarts the clock schedules the next tick itself
    if (!change.restart) scheduleTick($)
    void apply($, change)
  })
}

async function restore($: EngineInterface, one: Arcade) {
  const values: Record<string, unknown> = {}
  for (const key of one.kept) values[key] = await $.store.get(key)
  one.restore(values)
}

function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: game.title, focus: true, columns: game.wantColumns })
}

function armDropIn($: EngineInterface) {
  if (!isOn || !isTurnRunning || isDismissed || phase !== 'idle') return
  phase = 'waiting'
  timer = $.clock.after(DROP_IN_DELAY_MS, () => void dropIn($))
}

async function dropIn($: EngineInterface) {
  if (phase !== 'waiting') return
  timer = null
  const surfaces = await $.session.surfaces()
  if (!surfaces.includes('terminal')) {
    phase = 'idle'
    return
  }
  const opened = await openPane($)
  if (!opened.isPlaced) {
    // A waiting pane would pop up later, long after the moment has passed.
    // One the person opens appears at any width, so offer them a key instead.
    await $.ui.close({ id: PANE })
    phase = 'offered'
    $.ui.invalidate('ui.render')
    return
  }
  startPlaying($)
}

async function acceptOffer($: EngineInterface) {
  if (phase !== 'offered') return
  const { isPlaced } = await openPane($)
  if (isPlaced) startPlaying($)
}

function startPlaying($: EngineInterface) {
  phase = 'playing'
  $.ui.invalidate('ui.render')
  game.open()
  scheduleTick($)
}

async function press($: EngineInterface, key: string) {
  if (isPlaying()) await apply($, game.key(key))
}

// Claude is done or needs the person before they took up an offer to play
function withdrawOffer($: EngineInterface) {
  cancelTimer()
  phase = 'idle'
  $.ui.invalidate('ui.render')
}

// why, when given, heads the toast that sums up the game so far
async function pullOut($: EngineInterface, why?: string) {
  cancelTimer()
  stopTicking()
  phase = 'idle'
  if (why) $.ui.toast(why + ' · ' + game.score())
  await $.ui.close({ id: PANE })
}

function startCountdown($: EngineInterface) {
  phase = 'countdown'
  countdown = COUNTDOWN_SECONDS
  $.ui.invalidate('ui.render')
  timer = $.clock.every(1000, () => {
    countdown -= 1
    if (countdown > 0) $.ui.invalidate('ui.render')
    else void pullOut($, 'Claude закончил')
  })
}

// Claude is about to ask the person something, so they must see the prompt
async function needsYou($: EngineInterface) {
  if (phase === 'waiting' || phase === 'offered') {
    withdrawOffer($)
  } else if (phase !== 'idle') {
    await pullOut($, 'Claude ждёт вас')
  }
}

// /blocks, /tokensurfers and /snake: turns the mod on with that game and opens it
// at once, or with `off` turns the mod off whichever game was asked for
async function runCommand($: EngineInterface, args: string, asked: Arcade) {
  if (args.trim() === 'off') {
    isOn = false
    await $.store.set('isOn', false)
    if (phase !== 'idle') await pullOut($)
    return { text: 'Игры выключены.' }
  }
  isOn = true
  await $.store.set('isOn', true)
  const wasPlaying = isPlaying()
  const isSwitch = asked !== game
  game = asked
  await $.store.set('game', game.id)
  if (!wasPlaying) {
    cancelTimer()
    // Asked for, the pane opens at any width, and the game starts at once
    const { isPlaced } = await openPane($)
    if (isPlaced) startPlaying($)
  } else if (isSwitch) {
    await openPane($)
    startPlaying($)
  }
  return {}
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    isOn = (await $.store.get('isOn')) === true
    const asked = await $.store.get('game')
    game = GAMES.find((one) => one.id === asked) ?? blocks
    await restore($, blocks)
    await restore($, surfers)
    await restore($, snake)
    await $.command.register({
      name: 'blocks',
      description: 'Блоки — падающие фигуры, пока Claude работает',
      argumentHint: '[off]',
    })
    await $.command.register({
      name: 'tokensurfers',
      description: 'Tokensurfers — забег за токенами, пока Claude работает',
      argumentHint: '[off]',
    })
    await $.command.register({
      name: 'snake',
      description: 'Змейка, пока Claude работает',
      argumentHint: '[off]',
    })
    return next(e)
  })

  on('command.run', { command: 'blocks' }, ($, e) => runCommand($, e.args, blocks))

  on('command.run', { command: 'tokensurfers' }, ($, e) => runCommand($, e.args, surfers))

  on('command.run', { command: 'snake' }, ($, e) => runCommand($, e.args, snake))

  on('turn.start', async ($, e, next) => {
    isTurnRunning = true
    isDismissed = false
    if (phase === 'countdown') {
      // A queued prompt started straight away, so keep playing
      cancelTimer()
      phase = 'playing'
      $.ui.invalidate('ui.render')
    }
    armDropIn($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    isTurnRunning = false
    if (phase === 'waiting' || phase === 'offered') {
      withdrawOffer($)
    } else if (phase === 'playing') {
      if (e.isAborted) await pullOut($)
      else startCountdown($)
    }
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const result = await next(e)
    // In auto mode an ask can go to the classifier instead of the person;
    // pulling out anyway costs a moment, missing a real prompt costs more
    if (e.tool_use_id && result.decision === 'ask') await needsYou($)
    return result
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === 'AskUserQuestion') await needsYou($)
    const result = await next(e)
    // Once an answered prompt lets Claude carry on, drop back in
    armDropIn($)
    return result
  })

  on('ui.close', async ($, e, next) => {
    if (e.id !== PANE) return next(e)
    if (e.origin?.kind === 'person' && isTurnRunning) isDismissed = true
    // The pane closed, whoever closed it
    cancelTimer()
    stopTicking()
    phase = 'idle'
    // The next input region counts its keys from zero again
    keysPlayed = 0
    return next(e)
  })

  on('ui.message', async ($, e) => {
    if (e.element !== 'input') return {}
    const { count, keys } = e.data as { count: number; keys: string[] }
    // A count below the last one is a new input region's
    if (count < keysPlayed) keysPlayed = 0
    const fresh = Math.min(count - keysPlayed, keys.length)
    keysPlayed = count
    for (const key of keys.slice(keys.length - fresh)) await press($, key)
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (phase !== 'offered') return next(e)
    const { Box, Button } = $.ui.resolve(e)
    // Keep whatever other mods show in the band
    const others = await next(e)
    return Box({
      flexDirection: 'column',
      children: [
        Button({ key: 'play', label: game.title + ', пока Claude работает', hotkey: '1', plain: true, onPress: () => acceptOffer($) }),
        ...(others ? [others] : []),
      ],
    })
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (!isPlaying()) return next(e)
    return next({ ...e, props: { ...e.props, suffix: ' · ' + game.score() + '…' } })
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e)
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return Text({ children: ['Игры рисуются только в терминале.'] })
    }
    const { Box, Text, Raster, Client, Input } = $.ui.resolve(e)
    const room = e.props.scroll?.bodyRows ?? 40
    const corner = SUBSCRIBE.length + 1
    game.fit?.(e.props.bodyColumns, room - corner - 1)
    const { columns, rows } = game.size()
    // The author's corner sits at the foot of the pane, apart from the lines
    // that say how to play: the rows between are left empty
    const apart = Math.max(1, room - (rows + 2) - corner)
    // The field holds the keyboard from the moment the pane opens, and a
    // letter typed into it is a move, whatever the keyboard layout. Buttons'
    // hotkeys take Latin letters alone, and arrows pressed outside the
    // picture are Claude Code's own.
    const typed = (text: string) => {
      typedDraws += 1
      $.ui.invalidate('ui.render')
      void press($, text.slice(-1).toLowerCase())
    }
    const status =
      phase === 'countdown'
        ? Text({ bold: true, children: ['Claude закончил · возврат через ' + countdown] })
        : Text({ dimColor: true, children: ['Стрелки — после клика по картинке · Esc — к Claude'] })
    return Box({
      flexDirection: 'column',
      children: [
        Raster({ key: game.id, columns, rows, cells: game.cells() }),
        // Laid over the picture, so a click on the game gives it the keys
        Box({
          position: 'absolute',
          top: 0,
          left: 0,
          children: [Client({ key: 'input', module: './input.ts', width: columns, height: rows })],
        }),
        status,
        Input({
          key: 'keys',
          autoFocus: true,
          // A field keeps what was typed until it is drawn with another value
          value: typedDraws % 2 ? ' ' : '',
          label: game.label(),
          // Short, so the line of keys never wraps: the rows are counted
          submitLabel: 'ход',
          onInput: typed,
          onSubmit: () => void press($, 'return'),
        }),
        Box({ height: apart }),
        Text({ bold: true, children: ['Subscribe me'] }),
        ...SUBSCRIBE.map((line) => Text({ dimColor: true, children: [line] })),
      ],
    })
  })
}
