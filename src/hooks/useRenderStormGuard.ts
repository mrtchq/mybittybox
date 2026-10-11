// ─────────────────────────────────────────────────────────────────────────────
// useRenderStormGuard — a render-rate watchdog.
//
// A "freeze then crash on button press" is the classic signature of a synchronous
// render-loop: setState -> render -> setState ... until React bails with
// "Maximum update depth exceeded" and the tab locks up. This hook watches the
// render cadence of the component it's mounted in and, if it detects a
// *sustained* storm, forces a clean recovery by throwing into the nearest Error
// Boundary instead of letting the loop run the main thread into the ground.
//
// DESIGN RULES (learned the hard way — a watchdog that fires on healthy UI is
// worse than no watchdog, because it swaps a working panel for an error card):
//   1. The ceiling must sit well above any legitimate burst. A busy surface
//      (animations, a panel opening, an undebounced keystroke) can spike; only a
//      runaway loop *sustains* an absurd rate.
//   2. Exceedance is counted PER WINDOW, not per render. Counting per render
//      meant a single short burst instantly satisfied an "N consecutive" rule.
//   3. A burst that subsides clears the counter, so a transient spike never trips.
//
// Usage: call `useRenderStormGuard('Lock Lab')` at the top of any surface that
// has a history of freezing. Wrap that surface in <LockLabErrorBoundary>.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';

const WINDOW_MS = 1000; // measure over a 1s sliding window
// >240 renders/sec sustained is a runaway loop, not normal UI. Deliberately
// double the original ceiling so animation-heavy surfaces have headroom.
const MAX_RENDERS_PER_WINDOW = 240;
// Must stay above the ceiling for this many *separate* windows (~2s) before we
// accept it is a genuine runaway and halt. A one-window spike is ignored.
const SUSTAINED_WINDOWS = 2;

export function useRenderStormGuard(label: string): void {
  const renders = useRef<number[]>([]);
  const exceededWindows = useRef(0);
  const lastExceededAt = useRef(0);
  const tripped = useRef(false);

  // Already tripped this mount: keep throwing so the boundary can recover.
  if (tripped.current) {
    throw new Error(`[render-storm] ${label} halted to prevent tab freeze.`);
  }

  // Count on every render (this hook runs during render, which is what we are
  // measuring). We do NOT call setState here — that would itself loop.
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const bucket = renders.current;
  // drop timestamps outside the window
  while (bucket.length && now - bucket[0] > WINDOW_MS) bucket.shift();
  bucket.push(now);

  if (bucket.length > MAX_RENDERS_PER_WINDOW) {
    // Count at most one exceedance per window, so SUSTAINED_WINDOWS measures
    // elapsed time rather than number of renders.
    if (lastExceededAt.current === 0 || now - lastExceededAt.current >= WINDOW_MS) {
      exceededWindows.current += 1;
      lastExceededAt.current = now;
      // eslint-disable-next-line no-console
      console.warn(
        `[render-storm] ${label}: ${bucket.length} renders in the last ${WINDOW_MS}ms ` +
          `(window ${exceededWindows.current}/${SUSTAINED_WINDOWS} over the ${MAX_RENDERS_PER_WINDOW} ceiling).`
      );
    }

    if (exceededWindows.current >= SUSTAINED_WINDOWS) {
      tripped.current = true;
      // eslint-disable-next-line no-console
      console.error(
        `[render-storm] ${label} sustained >${MAX_RENDERS_PER_WINDOW} renders/${WINDOW_MS}ms for ` +
          `${SUSTAINED_WINDOWS} windows — runaway render loop. Halt + recover.`
      );
      throw new Error(
        `[render-storm] ${label} sustained >${MAX_RENDERS_PER_WINDOW} renders/${WINDOW_MS}ms — halted to prevent tab freeze.`
      );
    }
  } else if (exceededWindows.current !== 0) {
    // The burst subsided — stay mounted and forget the warning.
    exceededWindows.current = 0;
    lastExceededAt.current = 0;
  }
}

export default useRenderStormGuard;