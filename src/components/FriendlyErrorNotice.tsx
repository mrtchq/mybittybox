import React from 'react';
import { AlertCircle, RefreshCw, ExternalLink, ShieldCheck, Sparkles, X } from 'lucide-react';
import { FriendlyError, parseFriendlyError } from '../utils/friendlyError';

interface FriendlyErrorNoticeProps {
  error: any;
  context?: string;
  onRetry?: () => void;
  onFallbackAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const FriendlyErrorNotice: React.FC<FriendlyErrorNoticeProps> = ({
  error,
  context,
  onRetry,
  onFallbackAction,
  onDismiss,
  className = '',
}) => {
  if (!error) return null;

  const info: FriendlyError = parseFriendlyError(error, context);

  const handleAction = () => {
    if (info.actionType === 'retry' && onRetry) {
      onRetry();
    } else if (info.actionType === 'fallback_login' && onFallbackAction) {
      onFallbackAction();
    } else if (info.actionType === 'allow_popups' && onFallbackAction) {
      onFallbackAction();
    } else if (onRetry) {
      onRetry();
    }
  };

  return (
    <div
      id="friendly-error-notice"
      className={`p-3.5 rounded-xl bg-[#0d071b] border border-amber-500/40 text-left shadow-[0_4px_20px_rgba(245,158,11,0.15)] relative overflow-hidden transition-all ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-amber-200 tracking-wide">
              {info.title}
            </h4>
            {info.code && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-400/80 border border-amber-500/20">
                {info.code}
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
            {info.message}
          </p>

          <div className="mt-2 p-2 rounded-lg bg-black/40 border border-cyan-500/20 flex items-start gap-1.5 text-[11px] text-cyan-200/90 leading-normal">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>{info.suggestion}</span>
          </div>

          {(info.actionLabel || onRetry || onFallbackAction) && (
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              {(onFallbackAction || info.actionType === 'fallback_login') && (
                <button
                  type="button"
                  id="friendly-fallback-btn"
                  onClick={onFallbackAction || handleAction}
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 text-black font-bold text-[11px] flex items-center gap-1.5 hover:brightness-110 shadow-sm transition cursor-pointer"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>{info.actionType === 'fallback_login' ? (info.actionLabel || 'Instant Google Access') : 'Quick Continue'}</span>
                </button>
              )}

              {onRetry && (
                <button
                  type="button"
                  id="friendly-retry-btn"
                  onClick={onRetry}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            id="friendly-dismiss-btn"
            onClick={onDismiss}
            className="text-zinc-400 hover:text-zinc-200 p-1 transition cursor-pointer shrink-0"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
