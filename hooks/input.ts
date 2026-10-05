// Catches the keys pressed over the picture, once a click has given it the
// focus, and posts them to the hooks module, which plays them.
//
// Posts made within one frame replace each other, so each post carries the
// last few keys and how many were pressed in all: the hooks module plays the
// ones it has not seen.

import type { ClientModule } from 'claude-code'

const KEPT = 16

type Pressed = { count: number; keys: string[] }

const GameInput: ClientModule<null, Pressed> = (props, surface) => {
  if (surface.state === undefined) {
    const pressed: Pressed = { count: 0, keys: [] }
    surface.onKey((e) => {
      pressed.count += 1
      pressed.keys = [...pressed.keys, e.key.toLowerCase()].slice(-KEPT)
      surface.post({ count: pressed.count, keys: pressed.keys })
    })
    surface.setState(pressed)
  }

  const { Box } = surface.elements
  return Box({ width: '100%', height: '100%' })
}

export default GameInput
