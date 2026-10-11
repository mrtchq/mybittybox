// ─────────────────────────────────────────────────────────────────────────────
// LockLabErrorBoundary — localized crash armor for the Lock Lab / lock-panel
// surfaces. A render-loop or any throw inside a wrapped surface degrades to a
// recoverable panel instead of freezing or white-screening the whole tab.
//
// A trip is treated as recoverable, not fatal: the boundary re-mounts the
// wrapped surface automatically after a short cooldown (capped, so a genuinely
// broken surface cannot remount itself forever). The manual button remains for
// the case where the automatic retries are exhausted.
// ─────────────────────────────────────────────────────────────────────────────
import React, { Component } from 'react';

/** How long to wait before re-mounting a surface that tripped. */
const AUTO_RETRY_DELAY_MS = 2500;
/** Automatic re-mount attempts before we stop and hand control to the user. */
const MAX_AUTO_RETRIES = 2;

interface Props {
  /** Human label used in the recovery card (e.g. "Lock Lab", "Lock Panel"). */
  label?: string;
  /** Optional callback so the app can reset higher-level state if desired. */
  onRecover?: () => void;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
  count: number;
  autoRetries: number;
}

export class LockLabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '', count: 0, autoRetries: 0 };

  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Keep counts bounded so repeated trips don't themselves loop.
    this.setState((s) => ({ count: s.count + 1 }));
    // Surface in console for the inevitable real-browser repro capture.
    // eslint-disable-next-line no-console
    console.error('[LockLabErrorBoundary] caught crash in', this.props.label || 'surface', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: info.componentStack,
    });

    // Self-heal: re-mount the surface shortly, unless we've already retried
    // enough times to conclude the surface is genuinely broken.
    if (this.state.autoRetries < MAX_AUTO_RETRIES) {
      this.clearRetryTimer();
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.setState((s) => ({
          hasError: false,
          message: '',
          autoRetries: s.autoRetries + 1,
        }));
      }, AUTO_RETRY_DELAY_MS);
    }
  }

  componentWillUnmount() {
    this.clearRetryTimer();
  }

  private clearRetryTimer = () => {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  };

  private handleReset = () => {
    this.clearRetryTimer();
    this.setState({ hasError: false, message: '', autoRetries: 0 });
    this.props.onRecover?.();
  };

  render() {
    if (this.state.hasError) {
      const willAutoRetry = this.state.autoRetries < MAX_AUTO_RETRIES;
      return (
        <div
          role="alert"
          className="m-3 p-5 rounded-2xl bg-[#1a0a1f]/90 border border-amber-500/40 text-amber-100 font-mono text-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-300 font-bold tracking-widest">⚠ {this.props.label || 'SURFACE'} PAUSED</span>
          </div>
          <p className="text-[11px] text-amber-200/80 leading-snug mb-3">
            This panel was paused to protect the page. The rest of Bitty Box is still live.
            {willAutoRetry ? ' It will retry automatically in a moment.' : ' Use the button below to try again.'}
          </p>
          {this.state.message ? (
            <pre className="text-[10px] text-amber-300/70 bg-black/40 rounded p-2 mb-3 max-h-28 overflow-auto whitespace-pre-wrap">
              {this.state.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-amber-600/30 border border-amber-400/50 text-amber-100 hover:bg-amber-600/50 transition cursor-pointer"
          >
            RETRY NOW
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default LockLabErrorBoundary;