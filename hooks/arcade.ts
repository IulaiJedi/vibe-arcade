// What the mod asks of a game, so that when the pane opens and closes is
// written once for all of them. A game never touches Claude Code itself: it
// says what changed, and the hooks module paints, stores and keeps the clock.

export type Change = {
  // The picture changed
  paint?: boolean
  // The texts around the picture changed too
  redraw?: boolean
  // The time to the next tick changed, so count it afresh
  restart?: boolean
  // Values to keep between sessions, by their names in the store
  save?: Record<string, number>
}

export type Arcade = {
  id: string
  title: string
  // The size of its picture in terminal cells, and for a game whose picture
  // grows with the pane, the taking of the room there is
  size: () => { columns: number; rows: number }
  fit?: (bodyColumns: number, bodyRows: number | undefined) => void
  // How wide it would like the pane beside the transcript, in columns
  wantColumns?: number
  // The names of the values it keeps between sessions, and their reading
  kept: string[]
  restore: (values: Record<string, unknown>) => void
  // The pane opened
  open: () => void
  // How long until the game moves by itself, or null while nothing would
  tickMs: () => number | null
  tick: () => Change
  // A key as the terminal names it: a letter, `left`, `return`
  key: (key: string) => Change
  cells: () => string
  // The keys, as the line under the picture explains them
  label: () => string
  // The score in a few words, for the spinner and the toast
  score: () => string
}
