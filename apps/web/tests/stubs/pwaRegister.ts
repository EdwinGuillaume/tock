// Runtime stand-in for vite-plugin-pwa's `virtual:pwa-register/react`, which
// does not exist under Vitest (the PWA plugin is build-only, see vite.config).
// Aliased in the test config so any component that registers the SW resolves
// to inert "no update available" defaults. Tests that need a pending update
// mock `../src/pwa/useServiceWorkerUpdate` directly instead.
type Setter = (value: boolean) => void

export const useRegisterSW = () => ({
  needRefresh: [false, (() => {}) as Setter] as [boolean, Setter],
  offlineReady: [false, (() => {}) as Setter] as [boolean, Setter],
  updateServiceWorker: (_reloadPage?: boolean) => Promise.resolve()
})
