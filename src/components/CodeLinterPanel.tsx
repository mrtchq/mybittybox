import React, { useState } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Sparkles,
  Code2,
  Filter
} from 'lucide-react';
import { LintReport, LintIssue } from '../utils/codeLinter';

interface CodeLinterPanelProps {
  report: LintReport;
  isOpen: boolean;
  onToggle: () => void;
  onSelectLine?: (line: number) => void;
  className?: string;
}

export const CodeLinterPanel: React.FC<CodeLinterPanelProps> = ({
  report,
  isOpen,
  onToggle,
  onSelectLine,
  className = '',
}) => {
  const [filter, setFilter] = useState<'all' | 'errors' | 'warnings'>('all');

  const filteredIssues = report.issues.filter(issue => {
    if (filter === 'errors') return issue.severity === 'error';
    if (filter === 'warnings') return issue.severity === 'warning';
    return true;
  });

  return (
    <div 
      id="code-linter-panel"
      className={`rounded-xl border transition-all duration-200 overflow-hidden font-mono text-xs ${
        report.errorsCount > 0
          ? 'border-rose-500/40 bg-[#12040b]/90 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
          : report.warningsCount > 0
          ? 'border-amber-500/40 bg-[#120c04]/90 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
          : 'border-emerald-500/30 bg-[#021008]/80'
      } ${className}`}
    >
      {/* Header bar / toggle */}
      <div 
        onClick={onToggle}
        className="px-3 py-2 flex items-center justify-between cursor-pointer select-none hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {report.errorsCount > 0 ? (
            <div className="flex items-center gap-1.5 text-rose-400 font-bold">
              <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
              <span>{report.errorsCount} Syntax Error{report.errorsCount > 1 ? 's' : ''}</span>
            </div>
          ) : report.warningsCount > 0 ? (
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{report.warningsCount} Syntax Warning{report.warningsCount > 1 ? 's' : ''}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>HTML &amp; CSS Validated · Clean</span>
            </div>
          )}

          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            {report.errorsCount === 0 && report.warningsCount === 0
              ? 'No syntax anomalies detected'
              : 'Real-time pre-generation feedback'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-black/40 border border-zinc-800 text-zinc-400">
            {isOpen ? 'Collapse Linter' : 'Details'}
          </span>
          {isOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </div>
      </div>

      {/* Expanded Issues Drawer */}
      {isOpen && (
        <div className="p-3 border-t border-zinc-800/80 bg-black/50 space-y-2.5 animate-in fade-in duration-150">
          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-2 pb-1 border-b border-zinc-800/60 text-[10px]">
            <div className="flex items-center gap-1 text-zinc-400">
              <Filter className="w-3 h-3 text-cyan-400" />
              <span>Filter:</span>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  filter === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                All ({report.issues.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('errors')}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  filter === 'errors' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-zinc-500 hover:text-rose-400'
                }`}
              >
                Errors ({report.errorsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('warnings')}
                className={`px-1.5 py-0.5 rounded cursor-pointer ${
                  filter === 'warnings' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-500 hover:text-amber-400'
                }`}
              >
                Warnings ({report.warningsCount})
              </button>
            </div>

            <span className="text-zinc-500 text-[9px]">Click line number to locate</span>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="py-2 text-center text-emerald-400/80 text-[11px] flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>No issues in this filter view. Your code is ready to generate!</span>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 cyber-scrollbar">
              {filteredIssues.map(issue => (
                <div
                  key={issue.id}
                  onClick={() => onSelectLine?.(issue.line)}
                  className={`p-2 rounded-lg border transition cursor-pointer flex items-start gap-2.5 group ${
                    issue.severity === 'error'
                      ? 'bg-rose-950/30 border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/50'
                      : 'bg-amber-950/30 border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/50'
                  }`}
                >
                  <button
                    type="button"
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${
                      issue.severity === 'error'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 group-hover:bg-rose-500 group-hover:text-black transition-colors'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 group-hover:bg-amber-500 group-hover:text-black transition-colors'
                    }`}
                    title="Jump to line in editor"
                  >
                    L{issue.line}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] uppercase font-bold px-1 rounded ${
                        issue.severity === 'error' ? 'text-rose-400 bg-rose-950' : 'text-amber-400 bg-amber-950'
                      }`}>
                        {issue.type} · {issue.severity}
                      </span>
                      <span className="text-zinc-200 font-medium text-[11px] leading-tight">
                        {issue.message}
                      </span>
                    </div>

                    {issue.snippet && (
                      <div className="mt-1 text-[10px] text-zinc-400 bg-black/60 px-2 py-0.5 rounded font-mono truncate border border-zinc-800">
                        {issue.snippet}
                      </div>
                    )}

                    {issue.suggestion && (
                      <div className="mt-1 text-[10px] text-cyan-300/80 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                        <span>Fix hint: {issue.suggestion}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
