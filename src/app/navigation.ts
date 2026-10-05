import { useSyncExternalStore } from 'react';

/**
 * Client-side navigation for the child screens (NFR-5: a task opens without a page load). The
 * snapshot is a counter of navigations, not the URL, so a screen may rewrite its own query with
 * `history.replaceState` without being remounted; `App` keys the current route by it.
 */
const listeners = new Set<() => void>();
let navigations = 0;

function changed() {
  navigations += 1;
  listeners.forEach((listener) => listener());
}

window.addEventListener('popstate', changed);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens `href` (same origin) as the current screen and scrolls to the top. */
export function navigate(href: string): void {
  window.history.pushState({}, '', href);
  window.scrollTo?.(0, 0);
  changed();
}

/** How many navigations happened in this page load; changes on `navigate` and on back/forward. */
export function useNavigationCount(): number {
  return useSyncExternalStore(subscribe, () => navigations);
}

/** True after the first in-app navigation, so a new screen may move focus to its heading. */
export function hasNavigated(): boolean {
  return navigations > 0;
}
