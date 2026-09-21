// Blocking inline script that sets the diner menu's theme BEFORE first paint,
// so a light-preferring phone never flashes the dark default (FOUC). It runs
// synchronously as the parser reaches it, reads the same localStorage key +
// system preference the useMenuTheme hook uses, and adds `menu-light` to its
// parent `.menu-page` element. useMenuTheme then reconciles at runtime; this
// only fixes the very first paint. Keep the storage key and default logic in
// sync with use-menu-theme.ts.
const script = `(function(){try{var e=document.currentScript.parentElement;var t=localStorage.getItem('plateflow-menu-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}if(t==='light'){e.classList.add('menu-light');}}catch(_){}})();`

// Rendered as the FIRST child of the `.menu-page` wrapper so `currentScript
// .parentElement` resolves to that wrapper. Server-emitted; no hydration.
export function MenuThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
