import React from 'react';
import { FEATURES } from '../config/features';
import { 
  Box, 
  Code, 
  Eye, 
  Sparkles, 
  Info, 
  Bot,
  Crown, 
  Lock, 
  Zap, 
  FolderArchive,
  QrCode,
  Share2,
  ExternalLink,
  RefreshCw,
  Compass,
  LogOut,
  User,
  Coins,
  Mic
} from 'lucide-react';
import { AppView, WorkspaceTheme, WorkspaceMode, BittyUser } from '../types';
import { GRIP_ICON_DATA_URL } from './EdgeGripHandles';
import { UserAvatar } from './UserAvatar';
import { motion, AnimatePresence } from 'motion/react';

interface BittyNavbarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onOpenQr?: () => void;
  onShare?: () => void;
  onNewBox?: () => void;
  onCloseSession?: () => void;
  onPreviewInTab?: () => void;
  onExportZip?: () => void;
  onOpenTemplates?: () => void;
  onOpenTools?: () => void;
  onOpenLockLab?: () => void;
  onOpenVoiceAI?: () => void;
  onStartTour?: () => void;
  onReplaySplash?: () => void;
  isEncrypted: boolean;
  hasContent: boolean;
  theme: WorkspaceTheme;
  onThemeChange: (theme: WorkspaceTheme) => void;
  // PRO & Simple Mode props
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  isPro: boolean;
  isLifetimePro?: boolean;
  isTrialActive?: boolean;
  trialTimeRemaining?: any;
  onOpenPaywall: (featureName?: string) => void;
  // Session Save Status props
  lastSavedAt?: number | null;
  isSaving?: boolean;
  activeSessionTitle?: string;
  onManualSave?: () => void;
  // User Profile Account props
  user?: BittyUser | null;
  isAuthenticated?: boolean;
  onSignOut?: () => void | Promise<void>;
}

export const BittyNavbar: React.FC<BittyNavbarProps> = ({
  currentView,
  onViewChange,
  onOpenQr,
  onShare,
  onNewBox,
  onCloseSession,
  onPreviewInTab,
  onExportZip,
  onOpenTemplates,
  onOpenTools,
  onOpenLockLab,
  onOpenVoiceAI,
  onStartTour,
  onReplaySplash,
  isEncrypted,
  theme,
  onThemeChange,
  mode,
  onModeChange,
  isPro,
  isLifetimePro,
  isTrialActive,
  trialTimeRemaining,
  onOpenPaywall,
  lastSavedAt,
  isSaving,
  activeSessionTitle,
  onManualSave,
  user,
  isAuthenticated,
  onSignOut,
}) => {
  return (
    <header className="fixed inset-x-0 top-0 z-40 w-full pt-[env(safe-area-inset-top)] backdrop-blur-xl bg-[#0a0316]/90 border-b border-cyan-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
      {/* =========================================================================
          ROW 1: BRAND LOGO + VIEW SWITCHERS + MODE PILL + QUICK PANEL TRIGGERS
         ========================================================================= */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-11 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo & Templates Quick Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => onViewChange('editor')}
          >
            <div className="relative w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-indigo-600 p-[2px] shadow-[0_0_20px_rgba(0,242,255,0.45)] group transition-all duration-300 hover:shadow-[0_0_28px_rgba(255,0,222,0.6)]">
              <div className="w-full h-full bg-[#090314]/90 rounded-[10px] flex items-center justify-center overflow-hidden p-1">
                <motion.img
                  src={`${import.meta.env.BASE_URL}bittybox-logo.png`}
                  alt="Bitty Box Logo"
                  whileHover={{ rotate: [0, -5, 5, 0], scale: 1.15 }}
                  transition={{ duration: 0.35 }}
                  className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(0,242,255,0.7)]"
                />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-teal-400 rounded-xl blur-sm opacity-50 group-hover:opacity-90 transition duration-300 -z-10 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-cyber font-bold text-base sm:text-lg lg:text-xl tracking-wider text-cyan-200">
                  BITTY BOX
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                  v2.0
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-fuchsia-300/70 font-mono hidden md:block">
                WEBPAGES PACKED IN A LINK
              </p>
            </div>
          </motion.div>
        </div>

        {/* Center Desktop View Switchers with layoutId animated pill */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-purple-950/40 p-1 rounded-xl border border-purple-500/20 backdrop-blur-md relative">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            id="nav-editor-btn"
            onClick={() => onViewChange('editor')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
              currentView === 'editor' ? 'text-cyan-200' : 'text-purple-200/70 hover:text-cyan-200'
            }`}
          >
            {currentView === 'editor' && (
              <motion.div
                layoutId="active-desktop-nav-tab"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/25 to-teal-500/25 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,221,255,0.3)]"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <Code className="w-3.5 h-3.5 text-cyan-400 relative z-10" />
            <span className="relative z-10">EDITOR</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            id="nav-agents-btn"
            onClick={() => onViewChange('agents')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
              currentView === 'agents' ? 'text-cyan-200' : 'text-purple-200/70 hover:text-cyan-200'
            }`}
          >
            {currentView === 'agents' && (
              <motion.div
                layoutId="active-desktop-nav-tab"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/25 via-teal-500/25 to-fuchsia-500/25 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,242,255,0.3)]"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <Bot className="w-3.5 h-3.5 relative z-10 text-cyan-400" />
            <span className="relative z-10">AGENTS</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            id="nav-lock-lab-btn"
            onClick={() => onOpenLockLab?.()}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer text-purple-200/70 hover:text-cyan-200`}
          >
            <Lock className="w-3.5 h-3.5 relative z-10 text-cyan-400" />
            <span className="relative z-10">LOCK LAB</span>
          </motion.button>

          {FEATURES.voiceAI && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              id="nav-voice-ai-btn"
              onClick={() => onOpenVoiceAI?.()}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer text-cyan-200 hover:text-white bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/40 shadow-[0_0_12px_rgba(0,242,255,0.2)]"
              title="Chat with Voice AI (Gemini Live)"
            >
              <Mic className="w-3.5 h-3.5 relative z-10 text-cyan-300 animate-pulse" />
              <span className="relative z-10">VOICE AI</span>
            </motion.button>
          )}
        </nav>

        {/* Right Section: Mode Switcher + 24h Pass + Tools Deck Trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mode Switcher Toggle Pill */}
          <div className="flex items-center bg-[#050212] p-0.5 sm:p-1 rounded-xl border border-fuchsia-500/30 shadow-inner relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => onModeChange('simple')}
              className={`relative px-2 sm:px-2.5 py-1 rounded-lg font-mono text-[10px] sm:text-[11px] font-bold tracking-wider transition-colors cursor-pointer ${
                mode === 'simple' ? 'text-cyan-200' : 'text-cyan-400/60 hover:text-cyan-200'
              }`}
              title="Simple Mode: Fast, clean HTML-to-URL generator"
            >
              {mode === 'simple' && (
                <motion.div
                  layoutId="active-mode-pill"
                  className="absolute inset-0 rounded-lg bg-cyan-950 border border-cyan-400/50 shadow-[0_0_10px_rgba(0,242,255,0.3)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              <span className="relative z-10">SIMPLE</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (mode === 'pro') {
                  onOpenPaywall();
                } else {
                  onModeChange('pro');
                }
              }}
              className={`relative px-2 sm:px-2.5 py-1 rounded-lg font-mono text-[10px] sm:text-[11px] font-bold tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                mode === 'pro' ? 'text-fuchsia-200' : 'text-fuchsia-400/60 hover:text-fuchsia-200'
              }`}
              title="PRO Mode: Unlock encryption, multi-tabs, templates, and developer tooling"
            >
              {mode === 'pro' && (
                <motion.div
                  layoutId="active-mode-pill"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-fuchsia-900 to-purple-900 border border-fuchsia-400/60 shadow-[0_0_12px_rgba(189,0,255,0.4)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                />
              )}
              <Crown className="w-3 h-3 text-amber-400 fill-amber-400 relative z-10" />
              <span className="relative z-10">PRO</span>
            </motion.button>
          </div>

          {/* Account and Authentication Switch Trigger */}
          <label
            id="nav-user-profile-btn"
            className="switch-3d-cyan shrink-0"
            title={
              isAuthenticated
                ? `${user?.displayName || user?.email || 'Account'} • Click to Logout`
                : 'Click to Sign In'
            }
          >
            <input
              type="checkbox"
              className="switch-input"
              checked={isAuthenticated ? true : currentView === 'account'}
              onChange={(e) => {
                if (isAuthenticated) {
                  if (!e.target.checked && onSignOut) {
                    onSignOut();
                  } else {
                    onViewChange(e.target.checked ? 'account' : 'editor');
                  }
                } else {
                  onViewChange(e.target.checked ? 'account' : 'editor');
                }
              }}
            />

            <div className="switch-track">
              <span className="track-text text-3d text-signin">Sign In</span>
              <span className="track-text text-2d text-logout">Logout</span>

              <div className="switch-knob">
                <div className="cube">
                  <div className="face front"></div>
                  <div className="face back"></div>
                  <div className="face right"></div>
                  <div className="face left"></div>
                  <div className="face top"></div>
                  <div className="face bottom"></div>
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: MOBILE VIEW NAVIGATION with layoutId animation
         ========================================================================= */}
      <div className="lg:hidden w-full border-t border-cyan-500/15 bg-[#070213]/95 px-2.5 py-1 flex items-center justify-between gap-1 shadow-inner">
        <nav className="grid grid-cols-4 gap-1 w-full bg-purple-950/50 p-0.5 rounded-xl border border-purple-500/25 relative">
          <motion.button
            whileTap={{ scale: 0.96 }}
            id="mobile-nav-editor-btn"
            onClick={() => onViewChange('editor')}
            className={`relative flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
              currentView === 'editor' ? 'text-cyan-200' : 'text-purple-200/70 hover:text-cyan-200'
            }`}
          >
            {currentView === 'editor' && (
              <motion.div
                layoutId="active-mobile-nav-tab"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/25 to-teal-500/25 border border-cyan-400/60 shadow-[0_0_10px_rgba(0,221,255,0.3)]"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <Code className="w-3.5 h-3.5 shrink-0 relative z-10" />
            <span className="relative z-10 text-[10px] sm:text-[11px]">EDITOR</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            id="mobile-nav-agents-btn"
            onClick={() => onViewChange('agents')}
            className={`relative flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
              currentView === 'agents' ? 'text-cyan-200' : 'text-purple-200/70 hover:text-cyan-200'
            }`}
          >
            {currentView === 'agents' && (
              <motion.div
                layoutId="active-mobile-nav-tab"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/25 via-teal-500/25 to-fuchsia-500/25 border border-cyan-400/60 shadow-[0_0_10px_rgba(0,221,255,0.3)]"
                transition={{ type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <Bot className="w-3.5 h-3.5 shrink-0 relative z-10 text-cyan-400" />
            <span className="relative z-10 text-[10px] sm:text-[11px]">AGENTS</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            id="mobile-nav-lock-lab-btn"
            onClick={() => onOpenLockLab?.()}
            className={`relative flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer text-purple-200/70 hover:text-cyan-200`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0 relative z-10 text-cyan-400" />
            <span className="relative z-10 text-[10px] sm:text-[11px]">LOCK LAB</span>
          </motion.button>

          {FEATURES.voiceAI && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              id="mobile-nav-voice-ai-btn"
              onClick={() => onOpenVoiceAI?.()}
              className={`relative flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold tracking-wide transition-colors cursor-pointer text-cyan-300 hover:text-cyan-100`}
            >
              <Mic className="w-3.5 h-3.5 shrink-0 relative z-10 text-cyan-300 animate-pulse" />
              <span className="relative z-10 text-[10px] sm:text-[11px]">VOICE</span>
            </motion.button>
          )}
        </nav>
      </div>
    </header>
  );
};
