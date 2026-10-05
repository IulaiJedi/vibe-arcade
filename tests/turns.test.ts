import { expect, mock, test } from 'claude-code/testing'

// Answers everything the mod asks of Claude Code, and counts the pane opening
// and closing and the board being repainted, which is what the person sees.
// isPlaced(n) says whether the nth open gets room on screen, as it may not in
// a narrow terminal.
function stubClaudeCode(on, { isOn = true, isPlaced = (n) => true, game = undefined } = {}) {
  const pane = { opens: 0, closes: 0, paints: [], toasts: [], stored: {} }
  on('store.get', ($, e) => ({ value: e.key === 'isOn' ? isOn : e.key === 'game' ? game : undefined }))
  on('store.set', ($, e) => {
    pane.stored[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', () => ({ value: undefined }))
  on('session.start', () => ({ cwd: '/work' }))
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('ui.open', () => {
    pane.opens += 1
    return { value: isPlaced(pane.opens) ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' } }
  })
  // What Claude Code itself draws in the band, under anything the mod adds
  on('ui.render', () => ({ type: 'Text', props: {}, children: [''] }))
  on('ui.close', () => {
    pane.closes += 1
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    pane.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.blit', ($, e) => {
    pane.paints.push(e.cells)
    return { value: {} }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.check', () => ({ decision: 'ask' }))
  on('tool.call', () => ({ result: 'ok' }))
  return pane
}

async function startSession($) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
}

function finishTurn($, fields = {}) {
  return $.turn.complete({ turnId: 't1', answer: '', durationMs: 1000, isAborted: false, usage: null, ...fields })
}

const askPermission = ($) => $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' }, tool_use_id: 'u1' })

const PANE_PROPS = { title: 'Блоки', isFocused: true, bodyColumns: 60, placement: 'dock' }

test('opens once Claude has worked for ten seconds', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on)
  await startSession($)

  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(9999)
  expect(pane.opens).toBe(0)
  await clock.advance(1)
  expect(pane.opens).toBe(1)
})

test('stays out of a turn that ends before the delay', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on)
  await startSession($)

  await $.turn.start({ turnId: 't1', text: 'hi' })
  await clock.advance(9000)
  await finishTurn($)
  await clock.advance(15000)
  expect(pane.opens).toBe(0)
})

test('stays out while the mod is off', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on, { isOn: false })
  await startSession($)

  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(30000)
  expect(pane.opens).toBe(0)
})

test('counts down three seconds when Claude finishes, then hands back with the score', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on)
  await startSession($)

  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)
  await finishTurn($)
  await clock.advance(2999)
  expect(pane.closes).toBe(0)
  await clock.advance(1)
  expect(pane.closes).toBe(1)
  expect(pane.toasts.length).toBe(1)
  expect(pane.toasts[0]).toContain('Claude закончил')
})

test('hands back at once when the person interrupts Claude', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on)
  await startSession($)

  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)
  await finishTurn($, { isAborted: true })
  expect(pane.closes).toBe(1)
})

test('hands back at once when Claude asks for permission, and returns after the answer', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on)
  await startSession($)

  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)
  await askPermission($)
  expect(pane.closes).toBe(1)
  expect(pane.toasts[0]).toContain('Claude ждёт вас')

  await $.tool.call({ tool: 'Bash', input: { command: 'rm -rf build' }, tool_use_id: 'u1' })
  await clock.advance(10000)
  expect(pane.opens).toBe(2)
})

test('offers a key instead of opening by itself in a narrow terminal', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on, { isPlaced: (n) => n > 1 })
  await startSession($)

  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)
  expect(pane.opens).toBe(1)

  const band = await $.ui.mount({ plugin: 'vibe-arcade', surface: 'terminal', component: 'AbovePrompt', props: {} })
  await band.press({ key: 'play' })
  expect(pane.opens).toBe(2)
  await band.unmount()
})

test('pieces fall while the pane is open and wait while it is closed', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on)
  await startSession($)

  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)
  await clock.advance(2500)
  const fallen = pane.paints.length
  expect(fallen >= 3).toBe(true)
  expect(new Set(pane.paints).size).toBe(fallen)

  await finishTurn($, { isAborted: true })
  await clock.advance(10000)
  expect(pane.paints.length).toBe(fallen)
})

test('letters typed into the field move the piece in either keyboard layout, as do the keys over the board', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on)
  await startSession($)
  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)

  const ui = await $.ui.mount({
    plugin: 'vibe-arcade',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'vibe-arcade',
    props: PANE_PROPS,
  })
  expect(await ui.find({ type: 'Raster' })).toBeDefined()
  // The author's corner stands under every game
  expect(await ui.find({ type: 'Text', text: /Subscribe me/ })).toBeDefined()

  await ui.input({ key: 'keys', text: 'a', kind: 'change' })
  expect(pane.paints.length).toBe(1)
  // The same key under a Russian layout, typed after the field was drawn blank
  await ui.input({ key: 'keys', text: ' ф', kind: 'change' })
  expect(pane.paints.length).toBe(2)
  expect(new Set(pane.paints).size).toBe(2)
  await ui.input({ key: 'keys', text: 'q', kind: 'change' })
  expect(pane.paints.length).toBe(2)

  // Not a turn of the piece: a square one looks the same turned
  await ui.key({ key: 'down', in: 'input' })
  await ui.key({ key: 'left', in: 'input' })
  expect(pane.paints.length).toBe(4)
  expect(new Set(pane.paints).size).toBe(4)

  await ui.key({ key: 'q', in: 'input' })
  expect(pane.paints.length).toBe(4)
  await ui.unmount()
})

test('Tokensurfers opens instead when it was the game asked for last, and waits for a key', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on, { game: 'surfers' })
  await startSession($)
  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)
  expect(pane.opens).toBe(1)

  const ui = await $.ui.mount({
    plugin: 'vibe-arcade',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'vibe-arcade',
    props: { ...PANE_PROPS, title: 'Tokensurfers' },
  })
  // Nothing moves until the first key
  await clock.advance(1000)
  expect(pane.paints.length).toBe(0)

  await ui.input({ key: 'keys', text: 'ц', kind: 'change' })
  await clock.advance(500)
  expect(pane.paints.length >= 10).toBe(true)

  // Closed, the run stops
  await finishTurn($, { isAborted: true })
  const painted = pane.paints.length
  await clock.advance(5000)
  expect(pane.paints.length).toBe(painted)
  await ui.unmount()
})

test('a crash puts the run’s tokens in the wallet kept between sessions', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on, { game: 'surfers' })
  await startSession($)
  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)
  const ui = await $.ui.mount({
    plugin: 'vibe-arcade',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'vibe-arcade',
    props: { ...PANE_PROPS, title: 'Tokensurfers' },
  })
  await ui.input({ key: 'keys', text: 'r', kind: 'change' })
  // Running straight on with no moves ends in a crash well within two minutes
  await clock.advance(120000)
  expect(typeof pane.stored.wallet).toBe('number')
  expect(pane.stored.runBest > 0).toBe(true)
  await ui.unmount()
})

test('Snake holds still until a key, moves by itself after it, and waits again when the pane reopens', async ($, on) => {
  const clock = mock.clock(on)
  const pane = stubClaudeCode(on, { game: 'snake' })
  await startSession($)
  await $.turn.start({ turnId: 't1', text: 'refactor auth' })
  await clock.advance(10000)
  const ui = await $.ui.mount({
    plugin: 'vibe-arcade',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'vibe-arcade',
    props: { ...PANE_PROPS, title: 'Змейка' },
  })
  await clock.advance(1000)
  expect(pane.paints.length).toBe(0)

  // Up, under a Russian layout
  await ui.input({ key: 'keys', text: 'ц', kind: 'change' })
  const started = pane.paints.length
  await clock.advance(450)
  expect(pane.paints.length).toBe(started + 3)

  await finishTurn($, { isAborted: true })
  const painted = pane.paints.length
  await clock.advance(5000)
  expect(pane.paints.length).toBe(painted)

  await $.turn.start({ turnId: 't2', text: 'more' })
  await clock.advance(10000)
  await clock.advance(1000)
  expect(pane.paints.length).toBe(painted)
  await ui.unmount()
})
