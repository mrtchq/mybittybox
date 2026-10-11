// ─────────────────────────────────────────────────────────────────────────────
// LockLabErrorBoundary — localized crash armor for the Lock Lab / lock-panel
// surfaces. A render-loop or any throw inside a wrapped surface degrades to a
// recoverable panel instead of freezing or white-screening the whole tab.
// ─────────────────────────────────────────────────────────────────────────────
import React, { Component } from 'react';

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
}

export class LockLabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '', count: 0 };

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
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onRecover?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="m-3 p-5 rounded-2xl bg-[#1a0a1f]/90 border border-rose-500/50 text-rose-100 font-mono text-sm"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-rose-300 font-bold tracking-widest">⚠ {this.props.label || 'SURFACE'} RECOVERED</span>
          </div>
          <p className="text-[11px] text-rose-200/80 leading-snug mb-3">
            This panel hit an error and was halted before it could freeze the page. The rest of Bitty Box is still live.
          </p>
          {this.state.message ? (
            <pre className="text-[10px] text-rose-300/70 bg-black/40 rounded p-2 mb-3 max-h-28 overflow-auto whitespace-pre-wrap">
              {this.state.message}
            </pre>
          ) : null}
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-rose-600/30 border border-rose-400/50 text-rose-100 hover:bg-rose-600/50 transition cursor-pointer"
          >
            RELOAD PANEL
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default LockLabErrorBoundary;
