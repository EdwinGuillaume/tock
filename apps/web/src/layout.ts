// Layout tokens for how the game column reserves space.
//
// The env() expressions live once, in index.css, as --safe-top / --safe-bottom;
// this module only composes them with each call site's own spacing. The custom
// property indirection is deliberate: jsdom drops a bare env() from an inline
// style, so an unwrapped inset could not be asserted in any test. The calc()
// wrapper at zero is for a uniform shape across call sites. Each composer also
// carries its own `, 0px` fallback on the var() itself: if --safe-top /
// --safe-bottom were ever undefined at the element (index.css not loaded, or a
// property renamed on one side only), the bare var() would make the whole
// declaration invalid at computed-value time, and a non-inherited property like
// `height` would fall back to its initial value `auto` -- a worse failure mode
// than the bug this module fixes.
export const safeTop = (extra: number): string => `calc(${extra}px + var(--safe-top, 0px))`
export const safeBottom = (extra: number): string => `calc(${extra}px + var(--safe-bottom, 0px))`

// Bottom chrome of the game column. Two bands stack there: the hand's own box,
// and the band reserved inside the board stage so the hint chip and the 7-split
// gauge clear the board. Each band must be at least as tall as what it reserves
// space for -- see the invariants in tests/layout.test.ts.
//
// HAND_HEIGHT is authored, not derived. CARD_HEIGHT + CARD_SELECTED_LIFT +
// HAND_BOTTOM_GAP would be 124, which would shrink the hand by 6pt on every
// platform for the sake of a tidier formula; the slack is deliberate breathing
// room, and the invariant test is what keeps it honest.
//
// BOARD_BOTTOM_CLEARANCE reserves the overlay column's ~105pt as rendered (hint
// chip + SPLIT_OVERLAY_GAP + split gauge). Its invariant cannot be machine-checked
// because that height is intrinsic to the two components' font metrics.
export const CARD_HEIGHT = 86
export const CARD_SELECTED_LIFT = 20
export const CARD_SELECTED_SCALE = 1.07
export const HAND_BOTTOM_GAP = 18
export const HAND_HEIGHT = 130
export const BOARD_BOTTOM_CLEARANCE = 110
export const SPLIT_OVERLAY_GAP = 8
