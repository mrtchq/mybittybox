import React, { useMemo } from 'react';
import { Clock, Activity, FileCode2, Zap, Layers, GitBranch } from 'lucide-react';
import { analyzeContent } from '../utils/contentAnalysis';

interface ContentMetricsWidgetProps {
  content?: string;
  className?: string;
}

export const ContentMetricsWidget: React.FC<ContentMetricsWidgetProps> = ({
  content = '',
  className = '',
}) => {
  const analysis = useMemo(() => analyzeContent(content), [content]);

  // Color theme based on complexity score
  const getComplexityColor = (level: string) => {
    switch (level) {
      case 'Minimal':
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-950/60',
          border: 'border-emerald-500/40',
          bar: 'from-emerald-500 to-teal-400',
          badge: 'bg-emerald-900/50 text-emerald-300 border-emerald-500/30',
        };
      case 'Low':
        return {
          text: 'text-cyan-400',
          bg: 'bg-cyan-950/60',
          border: 'border-cyan-500/40',
          bar: 'from-cyan-500 to-teal-400',
          badge: 'bg-cyan-900/50 text-cyan-300 border-cyan-500/30',
        };
      case 'Moderate':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-950/60',
          border: 'border-amber-500/40',
          bar: 'from-amber-500 to-yellow-400',
          badge: 'bg-amber-900/50 text-amber-300 border-amber-500/30',
        };
      case 'High':
        return {
          text: 'text-orange-400',
          bg: 'bg-orange-950/60',
          border: 'border-orange-500/40',
          bar: 'from-orange-500 to-rose-400',
          badge: 'bg-orange-900/50 text-orange-300 border-orange-500/30',
        };
      case 'Complex':
      default:
        return {
          text: 'text-fuchsia-400',
          bg: 'bg-fuchsia-950/60',
          border: 'border-fuchsia-500/40',
          bar: 'from-fuchsia-500 via-purple-500 to-pink-500',
          badge: 'bg-fuchsia-900/50 text-fuchsia-300 border-fuchsia-500/30',
        };
    }
  };

  const complexityStyle = getComplexityColor(analysis.complexityLevel);

  return (
    <div
      id="studio-content-metrics-widget"
      className={`rounded-2xl bg-gradient-to-br from-[#06182c]/95 via-[#081b33]/90 to-[#040e1d]/95 border border-cyan-500/30 p-3.5 sm:p-4 shadow-xl backdrop-blur-sm ${className}`}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center shadow-inner">
            <FileCode2 className="w-3.5 h-3.5 text-cyan-300" />
          </div>
          <div>
            <h4 className="text-xs font-cyber font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-teal-100 to-amber-200">
              PAGE STATS & READABILITY
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono uppercase tracking-wider bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            LIVE STATS
          </span>
        </div>
      </div>

      {/* Two Main Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
        {/* Metric 1: Estimated Read Time */}
        <div
          id="metric-read-time-card"
          className="p-3 rounded-xl bg-[#020b18]/80 border border-cyan-500/20 flex flex-col justify-between gap-2 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400/80 uppercase flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-400" />
              READING TIME
            </span>
            <span className="text-[9px] font-mono text-zinc-400">Normal pace</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-cyber font-bold text-amber-300 tracking-tight">
              {analysis.readTimeString}
            </span>
            <span className="text-xs font-mono text-amber-400/70">to read</span>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 border-t border-cyan-500/10 pt-1.5">
            <span>{analysis.wordCount.toLocaleString()} words</span>
            <span>•</span>
            <span>{analysis.lineCount.toLocaleString()} lines</span>
            <span>•</span>
            <span>{analysis.charCount.toLocaleString()} chars</span>
          </div>
        </div>

        {/* Metric 2: Code Complexity Score */}
        <div
          id="metric-code-complexity-card"
          className={`p-3 rounded-xl bg-[#020b18]/80 border ${complexityStyle.border} flex flex-col justify-between gap-2 shadow-sm`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400/80 uppercase flex items-center gap-1.5">
              <Activity className={`w-3 h-3 ${complexityStyle.text}`} />
              PAGE COMPLEXITY
            </span>
            <span
              className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${complexityStyle.badge}`}
            >
              {analysis.complexityLevel}
            </span>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-cyber font-bold ${complexityStyle.text}`}>
                  {analysis.complexityScore}
                </span>
                <span className="text-xs font-mono text-zinc-400">/ 100</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-300">
                {analysis.complexityLabel}
              </span>
            </div>

            {/* Progress / Gauge bar */}
            <div className="w-full h-2 rounded-full bg-black/60 border border-cyan-500/20 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${complexityStyle.bar} transition-all duration-300`}
                style={{ width: `${Math.max(4, analysis.complexityScore)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 border-t border-cyan-500/10 pt-1.5">
            <span className="flex items-center gap-1">
              <GitBranch className="w-2.5 h-2.5 text-cyan-400" />
              {analysis.metrics.controlFlowKeywords + analysis.metrics.logicalOperators} logic steps
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Layers className="w-2.5 h-2.5 text-cyan-400" />
              level {analysis.metrics.maxNestingDepth} nesting
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-cyan-400" />
              {analysis.metrics.functions} actions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
