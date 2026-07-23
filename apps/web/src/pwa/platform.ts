// Pure environment checks for the install UX. Isolated so the install hook and
// button can be tested by stubbing navigator.userAgent and window.matchMedia.

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari exposes standalone on navigator, not through matchMedia.
  (window.navigator as unknown as { standalone?: boolean }).standalone === true

export const isIosSafari = (): boolean => {
  const ua = window.navigator.userAgent
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports a Mac UA; disambiguate via touch support.
    (/macintosh/i.test(ua) && 'ontouchend' in window)
  const isRealSafari = /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua)
  return isIos && isRealSafari
}
