// Motion tokens shared by CSS-driven and Framer-Motion-driven animation.
export const duration = { fast: 0.16, base: 0.3 }
export const echoDuration = 3.2
export const easeAccel = [0.7, 0, 0.84, 0] as const
export const easeSpring = [0.34, 1.56, 0.64, 1] as const

// True when the user asked the OS to reduce motion. Guarded for non-browser
// (test) environments where matchMedia may be absent.
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Lifetime (ms) of the finish-lane entry effect: how long an entry stays mounted
// before useLaneEntryFx removes it. Covers its longest sub-animation (~1.4s).
export const laneEntryFxMs = 1600
