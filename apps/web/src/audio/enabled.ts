// Audio runs only as the installed PWA (standalone), with a dev/QA escape hatch.
// Pure so the gate logic is testable without stubbing import.meta or the URL.
export const computeAudioEnabled = (input: { standalone: boolean; dev: boolean; forced: boolean }): boolean =>
  input.standalone || input.dev || input.forced

export const audioForced = (): boolean => {
  try {
    return new URLSearchParams(window.location.search).has('audio')
  } catch {
    return false
  }
}
