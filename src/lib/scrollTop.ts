/**
 * Scroll the page to the top on a route change. The home view scrolls inside the app
 * container ([data-app-scroller]), not the window, so window.scrollTo alone does nothing.
 */
export function scrollAppToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  document.querySelectorAll<HTMLElement>('[data-app-scroller]').forEach(el => {
    el.scrollTop = 0;
  });
}
