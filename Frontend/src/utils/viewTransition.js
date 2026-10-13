import { flushSync } from "react-dom";

// Slightly longer than the page animation in style.scss
const TRANSITION_MS = 650;

// When the transition currently on screen (a page change or one started here) will be over
let settledAt = 0;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Called by the router so updates made here wait for a page change to finish. */
export function noteViewTransition() {
  settledAt = performance.now() + TRANSITION_MS;
}

// Runs a state update as a view transition, so a big change on screen (a
// loading screen giving way to the page, results arriving) cross-fades instead
// of snapping. Falls back to a plain update where the API is missing.
export function withViewTransition(update) {
  if (typeof document === "undefined" || !document.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }

  const start = () => {
    noteViewTransition();
    const transition = document.startViewTransition(() => flushSync(update));
    // A newer transition can cut this one short; that is not an error
    transition.ready.catch(() => {});
  };

  // Starting a transition cancels the one in progress, so queue behind it
  const wait = settledAt - performance.now();
  if (wait > 0) {
    setTimeout(start, wait);
  } else {
    start();
  }
}
