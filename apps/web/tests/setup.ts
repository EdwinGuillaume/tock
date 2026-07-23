import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia; the install / standalone checks need it. Default to
// "no match" (not standalone, not reduced-motion). Individual tests override.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia
}
