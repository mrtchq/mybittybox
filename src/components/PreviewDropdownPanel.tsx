import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ExternalLink, 
  RefreshCw, 
  Monitor, 
  Tablet, 
  Smartphone, 
  Eye, 
  EyeOff, 
  Sparkles,
  ChevronUp,
  Lock,
  Unlock,
  KeyRound,
  Clock,
  Flame,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Hand,
  Zap,
  RotateCcw
} from 'lucide-react';
import { CyberScrambleText } from './CyberScrambleText';
import { getRenderedHtml } from '../utils/bittyEngine';
import { BittyMetadata } from '../types';
import { ceremonyLeaves, type CeremonyLeaf } from '../locks/ceremony';

interface PreviewDropdownPanelProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  metadata?: Partial<BittyMetadata>;
  title?: string;
  bittyUrl?: string;
  onPreviewInTab?: () => void;
}

type ViewportMode = 'desktop' | 'tablet' | 'mobile';
type PreviewTab = 'lock' | 'content';

export const PreviewDropdownPanel: React.FC<PreviewDropdownPanelProps> = ({
  isOpen,
  onClose,
  content,
  metadata,
  title,
  bittyUrl,
  onPreviewInTab,
}) => {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [refreshCount, setRefreshCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Active lock primitives detection
  const hasPasscode = Boolean(metadata?.password && metadata.password.trim().length > 0);
  const twConfig = metadata?.lockConfig?.timeWindow;
  const hasTimeLock = Boolean(twConfig?.enabled && (twConfig.notBefore || twConfig.notAfter || twConfig.mode));
  const olConfig = metadata?.lockConfig?.openLimit;
  const hasOpenLimit = Boolean(olConfig?.enabled);
  const hasCeremony = Boolean(metadata?.ceremony && metadata.ceremony.trim().length > 0);

  // Ceremony leaves (if a Lock Lab ceremony tree is present)
  const ceremonyNodes: CeremonyLeaf[] = useMemo(() => {
    if (!hasCeremony) return [];
    try {
      return ceremonyLeaves(metadata?.ceremony);
    } catch {
      return [];
    }
  }, [hasCeremony, metadata?.ceremony]);

  // Active lock count
  const activeLockCount = 
    (hasPasscode ? 1 : 0) + 
    (hasTimeLock ? 1 : 0) + 
    (hasOpenLimit ? 1 : 0) + 
    (hasCeremony ? (ceremonyNodes.length > 0 ? ceremonyNodes.length : 1) : 0);

  const hasAnyLock = activeLockCount > 0;
  const isLockCombo = activeLockCount > 1;

  // View state: 'lock' (depicts active lock screen) or 'content' (unlocked page content)
  const [previewTab, setPreviewTab] = useState<PreviewTab>(() => (hasAnyLock ? 'lock' : 'content'));
  const [isUnlockedInPreview, setIsUnlockedInPreview] = useState<boolean>(false);

  // Interactive simulation state for previewing the lock gate
  const [testPasswordInput, setTestPasswordInput] = useState<string>('');
  const [showTestPassword, setShowTestPassword] = useState<boolean>(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [isSimulatingUnlock, setIsSimulatingUnlock] = useState<boolean>(false);
  const [simShake, setSimShake] = useState<boolean>(false);
  const [tapsCount, setTapsCount] = useState<number>(0);

  // Simulated live ticking countdown for time lock (ticks every second while open)
  const [simCountdownSeconds, setSimCountdownSeconds] = useState<number>(() => {
    if (twConfig?.notAfter) {
      const diff = Math.floor((new Date(twConfig.notAfter).getTime() - Date.now()) / 1000);
      return diff > 0 ? diff : 86400;
    }
    if (twConfig?.notBefore) {
      const diff = Math.floor((new Date(twConfig.notBefore).getTime() - Date.now()) / 1000);
      return diff > 0 ? diff : 3600;
    }
    return 86400;
  });

  useEffect(() => {
    if (!isOpen || !hasTimeLock) return;
    const interval = setInterval(() => {
      setSimCountdownSeconds(prev => (prev > 0 ? prev - 1 : 86400));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, hasTimeLock]);

  // Format countdown seconds into DD:HH:MM:SS
  const formattedCountdown = useMemo(() => {
    const d = Math.floor(simCountdownSeconds / 86400);
    const h = Math.floor((simCountdownSeconds % 86400) / 3600);
    const m = Math.floor((simCountdownSeconds % 3600) / 60);
    const s = simCountdownSeconds % 60;
    return `${String(d).padStart(2, '0')}d : ${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(s).padStart(2, '0')}s`;
  }, [simCountdownSeconds]);

  // Reset or switch tab when panel opens or locks change
  useEffect(() => {
    if (isOpen) {
      if (hasAnyLock) {
        setPreviewTab('lock');
        setIsUnlockedInPreview(false);
        setTestPasswordInput('');
        setTestError(null);
        setTapsCount(0);
      } else {
        setPreviewTab('content');
      }
    }
  }, [isOpen, hasAnyLock]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute rendered HTML from content
  const renderedHtml = useMemo(() => {
    const activeCode = content && content.trim().length > 0
      ? content
      : '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#0a0520;color:#00f2ff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;text-align:center;}h3{font-size:1.15rem;margin:0 0 0.5rem 0;}p{color:#a78bfa;font-size:0.85rem;margin:0;}</style></head><body><div><h3>Live Sandbox Ready</h3><p>Type or paste HTML, Markdown, or code in the editor to preview.</p></div></body></html>';
    
    return getRenderedHtml(activeCode, {
      title: title || metadata?.title || 'Preview',
      language: metadata?.language || 'en',
    });
  }, [content, metadata, title]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshCount(prev => prev + 1);
    setTestError(null);
    setTestPasswordInput('');
    setTapsCount(0);
    if (hasAnyLock) {
      setIsUnlockedInPreview(false);
      setPreviewTab('lock');
    }
    setTimeout(() => setIsRefreshing(false), 350);
  };

  const handleOpenInNewTab = () => {
    if (onPreviewInTab) {
      onPreviewInTab();
      return;
    }
    if (bittyUrl) {
      window.open(bittyUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const blob = new Blob([renderedHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const tab = window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  };

  // Simulate unlock attempt in preview
  const handleSimulateUnlock = (bypassPasswordCheck: boolean = false) => {
    setTestError(null);

    // If passcode is required and not bypassed
    if (hasPasscode && !bypassPasswordCheck) {
      const expected = metadata?.password?.trim() || '';
      if (!testPasswordInput.trim()) {
        setTestError('Please enter the passcode to unlock.');
        setSimShake(true);
        setTimeout(() => setSimShake(false), 500);
        return;
      }
      if (testPasswordInput.trim() !== expected) {
        setTestError('Incorrect passcode. Verification failed.');
        setSimShake(true);
        setTimeout(() => setSimShake(false), 500);
        return;
      }
    }

    setIsSimulatingUnlock(true);
    setTimeout(() => {
      setIsSimulatingUnlock(false);
      setIsUnlockedInPreview(true);
      setPreviewTab('content');
    }, 450);
  };

  const handleResetLockPreview = () => {
    setIsUnlockedInPreview(false);
    setPreviewTab('lock');
    setTestPasswordInput('');
    setTestError(null);
    setTapsCount(0);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden select-none font-sans flex flex-col justify-start items-center">
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-40"
          />

          {/* Sliding Panel from Top with Drop-down Animation */}
          <motion.div
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full max-w-6xl h-[88vh] sm:h-[90vh] bg-[#060317]/98 border-b-2 border-x-2 border-fuchsia-500/50 rounded-b-3xl shadow-[0_0_60px_rgba(217,70,239,0.35)] flex flex-col z-50 overflow-hidden"
          >
            {/* Ambient Neon Beam at Top */}
            <div className={`h-1 w-full ${
              hasAnyLock 
                ? 'bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400 shadow-[0_0_15px_#f59e0b]'
                : 'bg-gradient-to-r from-fuchsia-500 via-purple-400 to-cyan-400 shadow-[0_0_15px_#ff00de]'
            }`} />

            {/* Dropdown Header */}
            <div className="px-4 sm:px-6 py-3 border-b border-fuchsia-500/25 bg-[#0a0524]/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Title and Icon */}
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                  hasAnyLock
                    ? 'bg-gradient-to-tr from-amber-950 to-purple-900 border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                    : 'bg-gradient-to-tr from-fuchsia-950 to-purple-900 border-fuchsia-400/60 shadow-[0_0_15px_rgba(217,70,239,0.4)]'
                }`}>
                  {hasAnyLock ? (
                    <Lock className="w-5 h-5 text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                  ) : (
                    <Eye className="w-5 h-5 text-fuchsia-300 drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-cyber font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-pink-200 to-cyan-300">
                      <CyberScrambleText 
                        text={hasAnyLock ? (previewTab === 'lock' ? "LOCK SCREEN PREVIEW" : "UNLOCKED PREVIEW") : "PREVIEW RENDER"} 
                        speed={20} 
                      />
                    </h2>
                    {hasAnyLock ? (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isLockCombo
                          ? 'bg-amber-950 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                          : 'bg-cyan-950 text-cyan-300 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                      }`}>
                        <Shield className="w-3 h-3 animate-pulse" />
                        {isLockCombo ? `COMBO (${activeLockCount} LOCKS ACTIVE)` : 'ACTIVE LOCK'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold bg-fuchsia-950 text-fuchsia-300 px-2 py-0.5 rounded-full border border-fuchsia-500/40">
                        OPEN / NO LOCKS
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-purple-300/70 font-mono hidden sm:block">
                    {hasAnyLock
                      ? (previewTab === 'lock' 
                          ? `Depicting live recipient unlock screen for ${isLockCombo ? 'active lock combination' : 'active lock'}` 
                          : `Live decrypted content preview (${content.length} bytes)`)
                      : `Live rendered output directly from your text editor (${content.length} bytes)`}
                  </p>
                </div>
              </div>

              {/* Mode Switcher: Lock Screen vs Unlocked Content (When locks exist) */}
              {hasAnyLock && (
                <div className="flex items-center bg-black/70 border border-fuchsia-500/40 rounded-xl p-1 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('lock')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold cursor-pointer ${
                      previewTab === 'lock'
                        ? 'bg-gradient-to-r from-amber-950 to-fuchsia-950 text-amber-200 border border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                        : 'text-purple-300/60 hover:text-amber-200'
                    }`}
                    title="Depict Active Lock Screen"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lock Gate</span>
                    {isLockCombo && (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">
                        {activeLockCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('content')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-bold cursor-pointer ${
                      previewTab === 'content'
                        ? 'bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-400/60 shadow-[0_0_8px_rgba(217,70,239,0.4)]'
                        : 'text-purple-300/60 hover:text-fuchsia-200'
                    }`}
                    title="View Unlocked Content"
                  >
                    <Unlock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Unlocked Content</span>
                  </button>
                </div>
              )}

              {/* Center Viewport Switcher */}
              <div className="flex items-center gap-1 bg-black/60 border border-fuchsia-500/30 rounded-xl p-1 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setViewportMode('desktop')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                    viewportMode === 'desktop'
                      ? 'bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-400/60 shadow-[0_0_8px_rgba(217,70,239,0.4)]'
                      : 'text-purple-300/60 hover:text-fuchsia-200'
                  }`}
                  title="Desktop Full Viewport"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewportMode('tablet')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                    viewportMode === 'tablet'
                      ? 'bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-400/60 shadow-[0_0_8px_rgba(217,70,239,0.4)]'
                      : 'text-purple-300/60 hover:text-fuchsia-200'
                  }`}
                  title="Tablet Viewport (768px)"
                >
                  <Tablet className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Tablet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewportMode('mobile')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                    viewportMode === 'mobile'
                      ? 'bg-fuchsia-950 text-fuchsia-200 border border-fuchsia-400/60 shadow-[0_0_8px_rgba(217,70,239,0.4)]'
                      : 'text-purple-300/60 hover:text-fuchsia-200'
                  }`}
                  title="Mobile Viewport (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Mobile</span>
                </button>
              </div>

              {/* Action Buttons & Close */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className={`p-2 rounded-xl bg-purple-950/70 hover:bg-fuchsia-950 border border-purple-500/40 text-purple-200 hover:text-white transition flex items-center gap-1 text-xs font-mono cursor-pointer ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                  title="Reset Preview & Simulation"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-950/70 hover:bg-fuchsia-950 border border-purple-500/40 text-purple-200 hover:text-white transition flex items-center gap-1.5 text-xs font-mono cursor-pointer"
                  title="Open Preview in New Tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">POPOUT</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-900/90 to-purple-900/90 hover:from-fuchsia-800 hover:to-purple-800 border border-fuchsia-400/70 text-white font-mono text-xs tracking-wider flex items-center gap-1 shadow-[0_0_15px_rgba(217,70,239,0.4)] transition cursor-pointer"
                  title="Close Preview Dropdown (ESC)"
                >
                  <ChevronUp className="w-4 h-4" />
                  <span>CLOSE</span>
                </button>
              </div>
            </div>

            {/* Live Container (Viewport Framed) */}
            <div className="flex-1 w-full p-3 sm:p-4 bg-[#03010b] flex items-center justify-center min-h-0 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden ${
                  viewportMode === 'desktop'
                    ? 'w-full'
                    : viewportMode === 'tablet'
                    ? 'w-[768px] max-w-full rounded-2xl border-4 border-purple-900/60 shadow-[0_0_35px_rgba(0,0,0,0.8)]'
                    : 'w-[375px] max-w-full rounded-3xl border-8 border-purple-950/80 shadow-[0_0_40px_rgba(0,0,0,0.9)]'
                }`}
              >
                {/* Device Frame Notch (Mobile only) */}
                {viewportMode === 'mobile' && (
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-3 bg-purple-950 rounded-full z-20 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-900" />
                  </div>
                )}

                {/* VIEW A: Depicting Active Lock Screen */}
                {hasAnyLock && previewTab === 'lock' && (
                  <div className="w-full h-full bg-[#050515] text-cyan-100 p-4 sm:p-6 overflow-y-auto font-sans flex items-center justify-center relative select-text">
                    <div className="absolute inset-0 bg-radial-at-c from-purple-950/30 via-transparent to-transparent pointer-events-none" />

                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                      className={`w-full max-w-md p-5 sm:p-6 bg-[#090620]/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,242,255,0.22),inset_0_0_30px_rgba(0,242,255,0.05)] backdrop-blur-2xl relative font-mono my-auto ${
                        simShake ? 'animate-bounce' : ''
                      } ${isSimulatingUnlock ? 'opacity-50 blur-xs transition-all' : ''}`}
                    >
                      {/* Bento Corner Accents */}
                      <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                      <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                      <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                      {/* Header Badge & Title */}
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-xs mb-2.5 shadow-[0_0_15px_rgba(0,242,255,0.3)]">
                          <Shield className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                          <span className="font-bold">PROTECTED BITTY BOX</span>
                        </div>

                        <h2 className="text-lg sm:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-teal-100 to-fuchsia-300 tracking-wide">
                          <CyberScrambleText text={title || metadata?.title || 'LOCKED TRANSMISSION'} speed={20} />
                        </h2>
                        <p className="text-[11px] text-cyan-300/70 mt-1 leading-snug">
                          {isLockCombo 
                            ? `Sealed by a combination of ${activeLockCount} access security rules.`
                            : 'Guarded by client-side cryptographic access control.'}
                        </p>
                      </div>

                      {/* Combination Header Banner */}
                      {isLockCombo && (
                        <div className="mb-4 p-2.5 rounded-xl bg-gradient-to-r from-purple-950/80 to-cyan-950/80 border border-purple-400/40 flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-purple-200 font-bold">
                            <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            <span>LOCK COMBINATION CEREMONY</span>
                          </div>
                          <span className="text-[10px] text-cyan-300 font-mono bg-black/40 px-2 py-0.5 rounded border border-cyan-400/30">
                            {activeLockCount} PRIMITIVES
                          </span>
                        </div>
                      )}

                      {/* Error Alert */}
                      <AnimatePresence>
                        {testError && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2 overflow-hidden"
                          >
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>{testError}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Depicted Active Locks Stack */}
                      <div className="space-y-3 mb-5">
                        {/* 1. Passcode Lock Primitive Card */}
                        {hasPasscode && (
                          <div className="p-3.5 rounded-xl bg-fuchsia-950/40 border border-fuchsia-500/40 shadow-[0_0_15px_rgba(217,70,239,0.1)]">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-fuchsia-300 text-xs font-bold uppercase tracking-wider">
                                <KeyRound className="w-4 h-4 text-fuchsia-400" />
                                <span>Passcode Lock</span>
                              </div>
                              <span className="text-[10px] font-mono text-fuchsia-300/80 bg-fuchsia-950 px-2 py-0.5 rounded border border-fuchsia-500/30">
                                AES-256-GCM
                              </span>
                            </div>
                            <p className="text-[10px] text-purple-200/70 mb-2.5">
                              Enter the shared passcode or PIN to decrypt the box.
                            </p>
                            <div className="relative">
                              <input
                                type={showTestPassword ? 'text' : 'password'}
                                value={testPasswordInput}
                                onChange={(e) => {
                                  setTestPasswordInput(e.target.value);
                                  if (testError) setTestError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSimulateUnlock(false);
                                  }
                                }}
                                placeholder="Enter passcode to test unlock..."
                                className="w-full bg-[#090314] border border-fuchsia-500/40 rounded-xl px-3.5 py-2.5 text-center text-white placeholder:text-purple-400/40 text-xs focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 font-mono tracking-wider"
                              />
                              <button
                                type="button"
                                onClick={() => setShowTestPassword(!showTestPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-fuchsia-300 transition cursor-pointer"
                                title={showTestPassword ? 'Hide passcode' : 'Show passcode'}
                              >
                                {showTestPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {metadata?.password && (
                              <div className="mt-1.5 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTestPasswordInput(metadata.password || '');
                                    if (testError) setTestError(null);
                                  }}
                                  className="text-[10px] text-cyan-300/80 hover:text-cyan-200 underline cursor-pointer"
                                >
                                  Pre-fill set passcode
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. Time-Based Lock Primitive Card */}
                        {hasTimeLock && (
                          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 shadow-[0_0_15px_rgba(251,191,36,0.1)]">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                                <span>Time Lock ({twConfig?.mode?.toUpperCase() || 'TIMED'})</span>
                              </div>
                              <span className="text-[10px] font-mono text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-500/30">
                                ACTIVE
                              </span>
                            </div>

                            <p className="text-[10px] text-amber-200/70 mb-2">
                              {twConfig?.mode === 'expiry' 
                                ? 'Auto-revoking after specified duration.' 
                                : twConfig?.mode === 'delay' 
                                ? 'Sealed in time vault until reveal timestamp.' 
                                : 'Gated within configured time window.'}
                            </p>

                            <div className="bg-black/60 border border-amber-500/30 rounded-lg p-2.5 text-center">
                              <div className="text-[9px] text-amber-300/70 tracking-widest uppercase mb-1">
                                {twConfig?.mode === 'expiry' ? 'TIME UNTIL EXPIRATION' : 'TIME UNTIL REVEAL'}
                              </div>
                              <div className="text-sm sm:text-base font-cyber font-bold text-amber-200 tracking-wider">
                                {formattedCountdown}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. View Limits / Quota Lock Primitive Card */}
                        {hasOpenLimit && (
                          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                                <Flame className="w-4 h-4 text-emerald-400" />
                                <span>View Quota & Self-Destruct</span>
                              </div>
                              <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                                {olConfig?.maxOpens || 1} MAX OPEN{(olConfig?.maxOpens || 1) > 1 ? 'S' : ''}
                              </span>
                            </div>
                            <p className="text-[10px] text-emerald-200/70">
                              Enforces a strict access ceiling. Link self-destructs upon reaching limit.
                            </p>
                            <div className="mt-2 text-center text-[10px] text-emerald-300/90 font-mono bg-emerald-950/70 py-1.5 px-2 rounded border border-emerald-500/30">
                              ✓ 1 of {olConfig?.maxOpens || 1} allowable views currently remaining
                            </div>
                          </div>
                        )}

                        {/* 4. Lock Lab Ceremony Leaves (if present) */}
                        {ceremonyNodes.map((leaf) => (
                          <div
                            key={leaf.lockId}
                            className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold uppercase tracking-wider">
                                <Sparkles className="w-4 h-4 text-cyan-400" />
                                <span>{leaf.name}</span>
                              </div>
                              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
                                CEREMONY
                              </span>
                            </div>
                            {leaf.description && (
                              <p className="text-[10px] text-cyan-200/70 mb-2">{leaf.description}</p>
                            )}
                            {leaf.lockId === 'tap-to-unseal' ? (
                              <button
                                type="button"
                                onClick={() => setTapsCount(prev => prev + 1)}
                                className="w-full py-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-200 font-cyber text-xs tracking-wider hover:bg-cyan-900/60 transition cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Hand className="w-4 h-4" />
                                <span>{tapsCount > 0 ? `TAPPED (${tapsCount}) ✓` : 'TAP TO UNSEAL'}</span>
                              </button>
                            ) : leaf.inputFields?.[0] ? (
                              <input
                                type="text"
                                placeholder={leaf.inputFields[0].placeholder || `Enter ${leaf.name.toLowerCase()}...`}
                                className="w-full bg-[#090314] border border-cyan-500/40 rounded-xl px-3 py-2 text-center text-white placeholder:text-cyan-400/40 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>

                      {/* Unlock Simulation Actions */}
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => handleSimulateUnlock(false)}
                          disabled={isSimulatingUnlock}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white font-cyber font-bold text-xs tracking-widest shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {isSimulatingUnlock ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>EVALUATING CEREMONY...</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-4 h-4" />
                              <span>AUTHENTICATE & UNSEAL</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center justify-between pt-2 border-t border-cyan-500/20 text-[10px] font-mono text-cyan-300/70">
                          <span>Lock Sandbox Simulation</span>
                          <button
                            type="button"
                            onClick={() => handleSimulateUnlock(true)}
                            className="text-cyan-300 hover:text-white underline cursor-pointer"
                            title="Instant preview without typing"
                          >
                            Bypass & Test Reveal &rarr;
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* VIEW B: Rendered Unlocked Content */}
                {(!hasAnyLock || previewTab === 'content') && (
                  <div className="w-full h-full flex flex-col relative">
                    {/* Simulated Unlocked Top Banner (when viewing content of a locked box) */}
                    {hasAnyLock && (
                      <div className="px-4 py-2 bg-gradient-to-r from-emerald-950 via-teal-950 to-cyan-950 border-b border-emerald-500/40 text-emerald-200 text-xs font-mono flex items-center justify-between shrink-0 z-10">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-bold">UNLOCKED STATE PREVIEW</span>
                          <span className="text-[10px] text-emerald-300/70 hidden sm:inline">
                            &bull; Content rendered post-ceremony verification
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetLockPreview}
                          className="px-2.5 py-1 rounded bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-400/50 text-emerald-100 text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>RE-SEAL LOCK</span>
                        </button>
                      </div>
                    )}

                    <iframe
                      key={`preview-iframe-${refreshCount}`}
                      srcDoc={renderedHtml}
                      title="Live Code Preview"
                      className="w-full h-full border-0 bg-white rounded-b-lg shadow-inner flex-1"
                      sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-modals allow-downloads"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Drawer Handle Bar */}
            <div 
              onClick={onClose}
              className="py-2 bg-[#0a0524]/80 border-t border-fuchsia-500/20 flex items-center justify-center gap-2 cursor-pointer hover:bg-fuchsia-950/40 transition group"
            >
              <ChevronUp className="w-3.5 h-3.5 text-fuchsia-400 group-hover:-translate-y-0.5 transition-transform" />
              <span className="text-[10px] font-cyber font-bold tracking-widest text-fuchsia-300/80 group-hover:text-fuchsia-200 uppercase">
                CLICK OR PRESS ESC TO CLOSE PREVIEW
              </span>
              <ChevronUp className="w-3.5 h-3.5 text-fuchsia-400 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
