import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

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

// jsdom has no Web Audio; mock Howler so importing AudioEngine (and any real
// createAudioEngine path) never constructs an AudioContext under test. Component
// tests inject a fake engine and never hit this, but the module still imports it.
vi.mock('howler', () => {
  class Howl {
    play() { return 0 }
    stop() {}
    pause() {}
    playing() { return false }
  }
  const Howler = { mute: () => {}, ctx: { resume: () => {} } }
  return { Howl, Howler }
})
