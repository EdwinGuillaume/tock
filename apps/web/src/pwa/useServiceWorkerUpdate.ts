import { useRegisterSW } from 'virtual:pwa-register/react'

export type ServiceWorkerUpdate = {
  needRefresh: boolean
  offlineReady: boolean
  update: () => void
  dismiss: () => void
}

// Thin, testable wrapper over vite-plugin-pwa's register hook. Registration is
// immediate on mount (the hook's default), so mounting UpdateBanner once in App
// is what registers the service worker.
export const useServiceWorkerUpdate = (): ServiceWorkerUpdate => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW()
  return {
    needRefresh,
    offlineReady,
    update: () => { void updateServiceWorker(true) },
    dismiss: () => {
      setNeedRefresh(false)
      setOfflineReady(false)
    }
  }
}
