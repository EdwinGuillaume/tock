// Pure environment checks for the install UX. Isolated so the install hook and
// button can be tested by stubbing navigator.userAgent and window.matchMedia.

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari exposes standalone on navigator, not through matchMedia.
  (window.navigator as unknown as { standalone?: boolean }).standalone === true

// Embedded web views (Facebook, Messenger, Instagram) where a PWA cannot be
// installed: beforeinstallprompt never fires and there is no add-to-home-screen.
// The only path is to reopen the link in the system browser.
export const isInAppBrowser = (): boolean =>
  /FBAN|FBAV|FB_IAB|FB4A|FBIOS|Instagram/i.test(window.navigator.userAgent)

export const isIosSafari = (): boolean => {
  const ua = window.navigator.userAgent
  const isIos =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports a Mac UA; disambiguate via touch support.
    (/macintosh/i.test(ua) && 'ontouchend' in window)
  // An in-app web view is never real Safari, even if its UA carries a Safari token.
  const isRealSafari = /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua) && !isInAppBrowser()
  return isIos && isRealSafari
}
