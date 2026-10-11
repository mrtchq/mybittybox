// ─────────────────────────────────────────────────────────────────────────────
// useRenderStormGuard — a render-rate watchdog.
//
// A "freeze then crash on button press" is the classic signature of a synchronous
// render-loop: setState -> render -> setState ... until React bails with
// "Maximum update depth exceeded" and the tab locks up. This hook watches the
// render cadence of the component it's mounted in and, if it detects a storm
// (too many renders inside one animation frame window), forces a clean recovery
// by throwing into the nearest Error Boundary instead of letting the loop run
// the main thread into the ground.
//
// Usage: call `useRenderStormGuard('Lock Lab')` at the top of any surface that
// has a history of freezing. Wrap that surface in <LockLabErrorBoundary>.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';

const WINDOW_MS = 1000; // measure over a 1s sliding window
const MAX_RENDERS_PER_WINDOW = 120; // >120 renders/sec = runaway loop, not normal UI

export function useRenderStormGuard(label: string): void {
  const renders = useRef<number[]>([]);
  const tripped = useRef(false);

  // Increment on every render (this hook runs during render, which is what we
  // are measuring). We do NOT call setState here — that would itself loop.
  if (tripped.current) {
    // Already tripped this mount: keep throwing so the boundary can recover.
    throw new Error(`[render-storm] ${label} exceeded ${MAX_RENDERS_PER_WINDOW} renders/${WINDOW_MS}ms — halted to prevent tab freeze.`);
  }

  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const bucket = renders.current;
  // drop timestamps outside the window
  while (bucket.length && now - bucket[0] > WINDOW_MS) bucket.shift();
  bucket.push(now);

  if (bucket.length > MAX_RENDERS_PER_WINDOW) {
    tripped.current = true;
    // eslint-disable-next-line no-console
    console.error(`[render-storm] ${label} render storm detected (${bucket.length} renders in ${WINDOW_MS}ms). Halt + recover.`);
    throw new Error(`[render-storm] ${label} exceeded ${MAX_RENDERS_PER_WINDOW} renders/${WINDOW_MS}ms — halted to prevent tab freeze.`);
  }
}

export default useRenderStormGuard;
