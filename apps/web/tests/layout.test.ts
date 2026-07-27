import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BOARD_BOTTOM_CLEARANCE, CARD_HEIGHT, CARD_SELECTED_LIFT, CARD_SELECTED_SCALE, HAND_BOTTOM_GAP, HAND_HEIGHT,
  SPLIT_OVERLAY_GAP, safeBottom, safeTop
} from '../src/layout'

describe('safe-area composers', () => {
  it('adds the call site spacing to the top inset', () => {
    expect(safeTop(26)).toBe('calc(26px + var(--safe-top, 0px))')
  })

  it('keeps the calc wrapper at zero so every call site has the same shape', () => {
    expect(safeTop(0)).toBe('calc(0px + var(--safe-top, 0px))')
  })

  it('adds the call site spacing to the bottom inset', () => {
    expect(safeBottom(18)).toBe('calc(18px + var(--safe-bottom, 0px))')
  })
})

describe('index.css backs the custom properties the composers reference', () => {
  // The composers emit var(--safe-top) / var(--safe-bottom); those properties are
  // only ever defined in index.css. Renaming either side without the other would
  // silently resolve to nothing, so assert the link rather than trusting it.
  //
  // Vite statically rewrites `new URL('<literal>', import.meta.url)` into an asset
  // reference (it becomes http://localhost:3000/...), so fileURLToPath rejects it
  // with "The URL must be of scheme file". Resolving via dirname + join never forms
  // that pattern. import.meta.url itself is a normal file:// URL.
  const testDir = dirname(fileURLToPath(import.meta.url))
  const css = readFileSync(join(testDir, '../src/index.css'), 'utf8')

  it('derives --safe-top from the top inset, with a 0px fallback', () => {
    expect(css).toMatch(/--safe-top:\s*env\(safe-area-inset-top,\s*0px\)/)
  })

  it('derives --safe-bottom from the bottom inset, with a 0px fallback', () => {
    expect(css).toMatch(/--safe-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/)
  })
})

describe('bottom-chrome reservation invariants', () => {
  // Invariant 1. The hand band plus the overlay's own gap above it must clear the
  // selected card's VISUAL footprint. The transform composes as R * T * S with a
  // bottom-centre origin, so the card's top is CARD_HEIGHT * CARD_SELECTED_SCALE
  // above its bottom edge before the lift is added -- 112.02pt, not 106pt. The
  // band alone (112pt) is 0.02pt short of that; the 8pt overlay gap is what makes
  // it hold. Modelling only CARD_HEIGHT + CARD_SELECTED_LIFT would stay green
  // through a selection-scale bump that reintroduces the collision.
  it('clears the selected card visual footprint, scale included', () => {
    const footprint = CARD_HEIGHT * CARD_SELECTED_SCALE + CARD_SELECTED_LIFT
    expect(HAND_HEIGHT - HAND_BOTTOM_GAP + SPLIT_OVERLAY_GAP).toBeGreaterThanOrEqual(footprint)
  })

  // Proves the guard above is not vacuous: a plausible "make selection pop more"
  // bump to scale(1.2) would blow past the reserved band even with the overlay
  // gap folded in.
  it('would fail if the selection scale grew past the reserved band', () => {
    const inflated = CARD_HEIGHT * 1.2 + CARD_SELECTED_LIFT
    expect(HAND_HEIGHT - HAND_BOTTOM_GAP + SPLIT_OVERLAY_GAP).toBeLessThan(inflated)
  })

  // Invariant 2 (BOARD_BOTTOM_CLEARANCE >= the overlay column's height) cannot be
  // computed: Hint and SplitControls size themselves from font metrics and jsdom
  // has no layout engine. This floor is the overlay column's measured height
  // (hint chip + SPLIT_OVERLAY_GAP + split gauge ~= 105pt), so the clearance can
  // no longer be cut to a value that lets the overlay cover the board.
  it('reserves at least the overlay column height in the board stage', () => {
    expect(BOARD_BOTTOM_CLEARANCE).toBeGreaterThanOrEqual(105)
  })
})
