// Verification-only ambient shim for the scoped lock typecheck.
// timeWindow.ts imports react for its component tail (line ~219); locks never
// use that path. This shim lets `tsc -p tsconfig.locks.json` typecheck the pure
// lock subsystem without pulling in @types/react. NOT used by the app build.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useEffect(fn: () => void, deps?: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function useState<T>(initial: T | (() => T)): [T, (next: T) => void];
}
