/** Set on <html> before first paint by INTRO_SCRIPT; the landing intro only exists while it is there. */
export const INTRO_ATTR = "data-intro";
export const INTRO_SEEN_KEY = "diablo.site.intro";

/**
 * Decides before first paint whether the landing intro plays: on the home page,
 * once per browser session, never under reduced motion. Without JavaScript the
 * attribute is never set, so the page is never covered.
 */
export const INTRO_SCRIPT = `(function(){try{if(location.pathname!=="/")return;if(sessionStorage.getItem("${INTRO_SEEN_KEY}"))return;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;document.documentElement.setAttribute("${INTRO_ATTR}","")}catch(e){}})()`;
