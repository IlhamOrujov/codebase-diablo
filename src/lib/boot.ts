/**
 * Runs synchronously in <head> before first paint. It applies the saved theme,
 * sidebar width and motion preference as attributes on <html>, so the first
 * frame already matches the user's choices (no flash, no resize on load).
 * On the sign-in page it also starts the one-time logo reveal (once per browser).
 *
 * This is the only inline script the app ships. It is a constant: it never
 * interpolates request or user data.
 */
export const bootScript = `(function(){var d=document.documentElement,s=null;try{s=window.localStorage}catch(e){}function g(k){try{return s?s.getItem(k):null}catch(e){return null}}var t=g("diablo.theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.setAttribute("data-theme",t);if(g("diablo.sidebar")==="collapsed")d.setAttribute("data-sidebar","collapsed");if(g("diablo.motion")==="reduce")d.setAttribute("data-motion","reduce");if(location.pathname==="/"&&!g("diablo.revealed"))d.setAttribute("data-reveal","")})()`;
