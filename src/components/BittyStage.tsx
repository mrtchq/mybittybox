import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code,
  Key,
  Clock,
  Gauge,
  Eye,
  ShieldCheck,
  Coins,
  Sparkles,
  Zap,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  RotateCcw,
  RotateCw,
  Type,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  RefreshCw,
  Lock,
  Unlock,
  Download,
  Monitor,
  Smartphone,
  Tablet,
  EyeOff,
  Radio,
  FileCode,
  Shield,
  Layers,
  ArrowRight,
  Pin,
  Cloud,
  AlertCircle
} from 'lucide-react';
import { CyberScrambleText } from './CyberScrambleText';
import { QrModal } from './QrModal';
import { HoloGenerateButton } from './HoloGenerateButton';
import { BittyLottie } from './BittyLottie';
import { HoloToggle } from './HoloToggle';
import { DurationTimeControl, DateRangeControl } from './TimeLockControls';
import { CodeLinterPanel } from './CodeLinterPanel';
import { lintHtmlCssCode, LintReport } from '../utils/codeLinter';
import {
  buildBittyUrl,
  compressContent,
  compressContentSync,
  getRenderedHtml,
  hashString
} from '../utils/bittyEngine';
import { useAccount } from '../hooks/useAccount';
import { useRenderStormGuard } from '../hooks/useRenderStormGuard';
import {
  buildTimeWindow,
  formatHybridSummary,
  formatLocalDateTime,
  type TimeLockMode
} from '../utils/timeWindow';
import { exportBittyToZip } from '../utils/zipExport';
import { BittyMetadata, BittyHistoryItem } from '../types';
import { detectFontFromContent, PREDEFINED_FONTS } from '../utils/typography';

export type StageMode =
  | 'editor'
  | 'passwordLock'
  | 'timeLock'
  | 'accessLimitLock'
  | 'preview'
  | 'review';

export interface BittyStageProps {
  content?: string;
  onChangeContent?: (content: string, immediate?: boolean) => void;
  metadata?: BittyMetadata;
  onChangeMetadata?: (metadata: BittyMetadata) => void;
  bittyUrl?: string;
  onReplaySplash?: () => void;
  onOpenTools?: () => void;
  onOpenTemplates?: () => void;
  onOpenPreview?: () => void;
  isPreviewOpen?: boolean;
  isToolsOpen?: boolean;
  isTemplatesOpen?: boolean;
  isPro?: boolean;
  onOpenPaywall?: (featureName?: string) => void;
  initialMode?: StageMode;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  undoCount?: number;
  redoCount?: number;
}

const DEFAULT_STARTER_CODE = '';

export const BittyStage: React.FC<BittyStageProps> = ({
  content,
  onChangeContent,
  metadata,
  onChangeMetadata,
  bittyUrl,
  onReplaySplash,
  onOpenTools,
  onOpenTemplates,
  onOpenPreview,
  isPreviewOpen,
  isToolsOpen,
  isTemplatesOpen,
  isPro = false,
  onOpenPaywall,
  initialMode = 'editor',
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  undoCount = 0,
  redoCount = 0,
}) => {
  // Render-storm watchdog: a runaway render loop (the "freeze then crash on
  // button press" signature) trips this and throws into the LockLabErrorBoundary
  // wrapping this stage, halting the loop before it can seize the main thread.
  useRenderStormGuard('Lock Panel');

  // Authoritative Single Stage View-State
  const [stageMode, setStageMode] = useState<StageMode>(initialMode);

  // Content & Box Metadata
  const [boxContent, setBoxContent] = useState<string>(content !== undefined ? content : DEFAULT_STARTER_CODE);
  const [boxTitle, setBoxTitle] = useState<string>(metadata?.title || 'My Box');
  const [boxDescription, setBoxDescription] = useState<string>(metadata?.description || '');

  // Passcode Lock State
  const [passwordEnabled, setPasswordEnabled] = useState<boolean>(() => Boolean(metadata?.password && metadata.password.length > 0));
  const [passwordValue, setPasswordValue] = useState<string>(() => metadata?.password || '');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Time Lock State
  const [timeLockEnabled, setTimeLockEnabled] = useState<boolean>(() => Boolean(metadata?.lockConfig?.timeWindow?.enabled));
  const [timeLockMode, setTimeLockMode] = useState<TimeLockMode>(() => metadata?.lockConfig?.timeWindow?.mode || 'expiry');
  const [timeExpiryHours, setTimeExpiryHours] = useState<number>(() => metadata?.lockConfig?.timeWindow?.expiryHours || 24);
  const [timeDelayHours, setTimeDelayHours] = useState<number>(() => metadata?.lockConfig?.timeWindow?.delayHours || 24);
  const [timeOpenAt, setTimeOpenAt] = useState<string>(() => metadata?.lockConfig?.timeWindow?.openAt || formatLocalDateTime(new Date(Date.now() + 24 * 3600 * 1000)));
  const [timeLockAt, setTimeLockAt] = useState<string>(() => metadata?.lockConfig?.timeWindow?.lockAt || formatLocalDateTime(new Date(Date.now() + 48 * 3600 * 1000)));
  const [hybridRevealMode, setHybridRevealMode] = useState<'delay' | 'date'>('delay');
  const [hybridSelfDestructHours, setHybridSelfDestructHours] = useState<number>(24);
  const [showTimeCountdown, setShowTimeCountdown] = useState<boolean>(() => metadata?.lockConfig?.timeWindow?.showCountdown !== false);

  // View Limits Lock State
  const [accessLimitEnabled, setAccessLimitEnabled] = useState<boolean>(() => Boolean(metadata?.lockConfig?.openLimit?.enabled));
  const [accessLimitMaxOpens, setAccessLimitMaxOpens] = useState<number>(() => metadata?.lockConfig?.openLimit?.maxOpens || 1);
  const [isCustomAccessLimit, setIsCustomAccessLimit] = useState<boolean>(false);
  const [customAccessLimitInput, setCustomAccessLimitInput] = useState<string>('25');
  const [showRemainingAccessCount, setShowRemainingAccessCount] = useState<boolean>(() => metadata?.lockConfig?.openLimit?.showRemainingCount !== false);

  // Preview Device Mode
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [iframeKey, setIframeKey] = useState<number>(0);

  // Generated Link & UI Feedback
  const [readyUrl, setReadyUrl] = useState<string>('');
  const [generatedUrl, setGeneratedUrl] = useState<string>(bittyUrl || '');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isEncoding, setIsEncoding] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Code Linter State
  const [isLinterOpen, setIsLinterOpen] = useState<boolean>(false);
  const [showPreGenerateLintModal, setShowPreGenerateLintModal] = useState<boolean>(false);

  // Cloud Pinning State
  const [isPinning, setIsPinning] = useState<boolean>(false);
  const [pinSuccessNotice, setPinSuccessNotice] = useState<string | null>(null);
  const [autoPinToAccount, setAutoPinToAccount] = useState<boolean>(true);
  const [currentBoxId, setCurrentBoxId] = useState<string | null>(null);

  const account = useAccount();
  const { user, isAuthenticated } = account;

  // Real-time lint calculation
  const lintReport: LintReport = useMemo(() => {
    return lintHtmlCssCode(boxContent);
  }, [boxContent]);

  // Check if current generated box is pinned in account
  const isCurrentBoxPinned = useMemo(() => {
    if (!generatedUrl || !account.user?.links) return false;
    return account.user.links.some(l => (l.url === generatedUrl || (currentBoxId && l.id === currentBoxId)) && l.isPinned);
  }, [generatedUrl, currentBoxId, account.user?.links]);

  // Navigate to line in composer textarea
  const handleSelectLinterLine = useCallback((targetLine: number) => {
    const textarea = document.getElementById('bitty-code-composer') as HTMLTextAreaElement | null;
    if (!textarea) return;
    const lines = boxContent.split('\n');
    let charIndex = 0;
    for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
      charIndex += lines[i].length + 1;
    }
    textarea.focus();
    textarea.setSelectionRange(charIndex, charIndex + (lines[targetLine - 1]?.length || 0));
    const lineHeight = 18;
    textarea.scrollTop = Math.max(0, (targetLine - 3) * lineHeight);
  }, [boxContent]);

  // Pin current box to user dashboard for permanent cloud storage
  const handlePinCurrentBox = useCallback(async () => {
    if (!generatedUrl) return;
    if (!account.isAuthenticated && !account.user) {
      alert('Please sign in to pin this Bitty Box to your account dashboard for permanent cloud backup.');
      return;
    }
    setIsPinning(true);
    try {
      const boxId = currentBoxId || `bbx_${Date.now()}`;
      await account.pinBox({
        id: boxId,
        title: boxTitle || 'Untitled Bitty Box',
        url: generatedUrl,
        format: 'html',
        byteSize: boxContent.length,
        compressedSize: generatedUrl.length,
        encrypted: Boolean(passwordEnabled && passwordValue),
        locks: {
          password: Boolean(passwordEnabled && passwordValue),
          timeWindow: Boolean(timeLockEnabled),
          accessLimit: Boolean(accessLimitEnabled),
        },
        createdAt: new Date().toISOString(),
      }, boxContent);
      setPinSuccessNotice('Bitty Box pinned to your account dashboard! Content is permanently backed up on cloud server with preserved URL structure.');
      setTimeout(() => setPinSuccessNotice(null), 6000);
    } catch (err) {
      console.error('Failed to pin box:', err);
    } finally {
      setIsPinning(false);
    }
  }, [generatedUrl, account, currentBoxId, boxTitle, boxContent, passwordEnabled, passwordValue, timeLockEnabled, accessLimitEnabled]);

  // Sync incoming props
  useEffect(() => {
    if (content !== undefined && content !== boxContent) {
      setBoxContent(content);
    }
  }, [content]);

  useEffect(() => {
    if (metadata?.title !== undefined && metadata.title !== boxTitle) {
      setBoxTitle(metadata.title);
    }
    if (metadata?.description !== undefined && metadata.description !== boxDescription) {
      setBoxDescription(metadata.description);
    }
  }, [metadata?.title, metadata?.description]);

  useEffect(() => {
    if (metadata?.password && metadata.password.length > 0) {
      setPasswordEnabled(true);
      setPasswordValue(metadata.password);
    }
  }, [metadata?.password]);

  const handleContentUpdate = useCallback((newContent: string, immediate?: boolean) => {
    setBoxContent(newContent);
    onChangeContent?.(newContent, immediate);
  }, [onChangeContent]);

  const activeFontId = useMemo(() => {
    if (metadata?.fontFamily) return metadata.fontFamily;
    return detectFontFromContent(boxContent, 'system-sans');
  }, [boxContent, metadata?.fontFamily]);

  const activeFontName = useMemo(() => {
    const f = PREDEFINED_FONTS.find(font => font.id === activeFontId);
    return f ? f.name : 'System Sans';
  }, [activeFontId]);

  const handleTitleUpdate = useCallback((newTitle: string) => {
    setBoxTitle(newTitle);
    onChangeMetadata?.({
      ...(metadata || { title: newTitle, description: boxDescription, favicon: '📦', includeMetadata: true }),
      title: newTitle,
    });
  }, [metadata, boxDescription, onChangeMetadata]);

  const handleDescriptionUpdate = useCallback((newDescription: string) => {
    setBoxDescription(newDescription);
    onChangeMetadata?.({
      ...(metadata || { title: boxTitle, description: newDescription, favicon: '📦', includeMetadata: true }),
      description: newDescription,
    });
  }, [metadata, boxTitle, onChangeMetadata]);

  // Derived Active Lock States
  const trimmedPasscode = passwordValue.trim();
  const isPasscodeActive = Boolean(passwordEnabled && trimmedPasscode.length >= 8);
  const isPasscodeTooShort = Boolean(passwordEnabled && trimmedPasscode.length > 0 && trimmedPasscode.length < 8);
  const isTimeLockActive = Boolean(timeLockEnabled);
  const isAccessLimitActive = Boolean(accessLimitEnabled);

  const timeLockSummary = useMemo(() => {
    if (!timeLockEnabled) return 'Disabled';
    if (timeLockMode === 'expiry') return `Expires after ${timeExpiryHours === 168 ? '7 Days' : `${timeExpiryHours}h`}`;
    if (timeLockMode === 'delay') return `Unlocks in ${timeDelayHours === 168 ? '7 Days' : `${timeDelayHours}h`}`;
    if (timeLockMode === 'hybrid') return formatHybridSummary({ hybridRevealMode, delayHours: timeDelayHours, openAt: timeOpenAt, hybridSelfDestructHours });
    return `Opens ${timeOpenAt ? new Date(timeOpenAt).toLocaleDateString() : '—'} · Locks ${timeLockAt ? new Date(timeLockAt).toLocaleDateString() : '—'}`;
  }, [timeLockEnabled, timeLockMode, timeExpiryHours, timeDelayHours, timeOpenAt, timeLockAt, hybridRevealMode, hybridSelfDestructHours]);

  const timeLockShortBadge = useMemo(() => {
    if (!timeLockEnabled) return 'OFF';
    if (timeLockMode === 'expiry') return `${timeExpiryHours}h Expiry`;
    if (timeLockMode === 'delay') return `${timeDelayHours}h Delay`;
    if (timeLockMode === 'hybrid') return 'Reveal+Decay';
    return 'Date Range';
  }, [timeLockEnabled, timeLockMode, timeExpiryHours, timeDelayHours]);

  // Credit calculation — derived from the set of currently active locks.
  // Each entry carries the human title + its credit cost so the review-stage
  // itemized grid can render every enabled lock dynamically (no more hardcoding).
  type ActiveLockLine = { id: string; title: string; cost: number };
  const activeLocks = useMemo<ActiveLockLine[]>(() => {
    const lines: ActiveLockLine[] = [];
    if (isPasscodeActive) lines.push({ id: 'passcode', title: 'Passcode Lock (AES-256)', cost: 0 });
    if (isTimeLockActive) lines.push({ id: 'time', title: 'Time-Based Lock', cost: 10 });
    if (isAccessLimitActive) lines.push({ id: 'viewlimit', title: 'View Limits Lock', cost: 10 });
    return lines;
  }, [isPasscodeActive, isTimeLockActive, isAccessLimitActive]);

  const calculatedCreditCost = useMemo(() => {
    return activeLocks.reduce((sum, l) => sum + l.cost, 0);
  }, [activeLocks]);

  const isUserPro = Boolean(isPro || user?.tier === 'pro');
  const userCredits = user?.credits ?? 0;
  const hasSufficientCredits = isUserPro || (isAuthenticated && userCredits >= calculatedCreditCost);
  const requiresCredits = calculatedCreditCost > 0 && !hasSufficientCredits;

  // Synthesized Web Audio
  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const playTone = useCallback((freq: number, type: OscillatorType, duration: number, gainValue = 0.04) => {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, [soundEnabled, initAudio]);

  const handleModeSwitch = useCallback((mode: StageMode) => {
    setStageMode(mode);
    const modeFrequencies: Record<StageMode, number> = {
      editor: 523.25,
      passwordLock: 587.33,
      timeLock: 659.25,
      accessLimitLock: 698.46,
      preview: 783.99,
      review: 880.00,
    };
    playTone(modeFrequencies[mode] || 520, 'sine', 0.15, 0.05);
  }, [playTone]);

  // Rendered HTML preview
  const stagePreviewHtml = useMemo(() => {
    const source = boxContent.trim() || DEFAULT_STARTER_CODE;
    return getRenderedHtml(source, {
      title: boxTitle || 'Bitty Box',
      description: boxDescription.trim() || '',
      language: 'en',
    });
  }, [boxContent, boxTitle, boxDescription]);

  // Live URL generator
  useEffect(() => {
    let isCancelled = false;
    const generatePreviewUrl = async () => {
      try {
        const source = boxContent.trim() || DEFAULT_STARTER_CODE;
        const html = getRenderedHtml(source, {
          title: boxTitle || 'Bitty Box',
          description: boxDescription.trim() || '',
          language: 'en',
        });

        const pass = passwordEnabled && passwordValue.trim().length >= 8 ? passwordValue.trim() : undefined;

        let compressedFragment = '';
        if (!pass) {
          const syncRes = compressContentSync(html, { mimeType: 'text/html', isRawHtml: true });
          if (syncRes) {
            compressedFragment = syncRes.compressedUrl;
          }
        }
        if (!compressedFragment) {
          const encoded = await compressContent(html, {
            password: pass,
            mimeType: 'text/html',
            isRawHtml: true,
          });
          if (encoded) {
            compressedFragment = encoded.compressedUrl;
          }
        }

        if (isCancelled || !compressedFragment) return;

        const meta: BittyMetadata = {
          title: boxTitle || 'Bitty Box',
          description: boxDescription.trim() || '',
          favicon: '📦',
          includeMetadata: true,
        };

        if (timeLockEnabled) {
          meta.lockConfig = {
            timeWindow: buildTimeWindow({
              enabled: timeLockEnabled,
              mode: timeLockMode,
              expiryHours: timeExpiryHours,
              delayHours: timeDelayHours,
              openAt: timeOpenAt,
              lockAt: timeLockAt,
              hybridRevealMode,
              hybridSelfDestructHours,
              showCountdown: showTimeCountdown,
            })!,
          };
        }

        if (accessLimitEnabled) {
          meta.lockConfig = {
            ...(meta.lockConfig || {}),
            openLimit: {
              enabled: true,
              maxOpens: accessLimitMaxOpens,
              opensUsed: 0,
              showRemainingCount: showRemainingAccessCount,
            },
          };
        }

        if (pass) {
          meta.password = pass;
        }

        if (metadata?.ceremony) {
          meta.ceremony = metadata.ceremony;
        }

        const fullUrl = buildBittyUrl(compressedFragment, meta);
        if (!isCancelled) {
          setReadyUrl(fullUrl);
          onChangeMetadata?.(meta);
        }
      } catch {}
    };

    generatePreviewUrl();
    return () => {
      isCancelled = true;
    };
  }, [
    boxContent,
    boxTitle,
    boxDescription,
    passwordEnabled,
    passwordValue,
    timeLockEnabled,
    timeLockMode,
    timeExpiryHours,
    timeDelayHours,
    timeOpenAt,
    timeLockAt,
    hybridRevealMode,
    hybridSelfDestructHours,
    showTimeCountdown,
    accessLimitEnabled,
    accessLimitMaxOpens,
    showRemainingAccessCount,
    metadata?.ceremony,
    onChangeMetadata
  ]);

  // Reset all state
  const handleStartOver = useCallback(() => {
    handleContentUpdate(DEFAULT_STARTER_CODE);
    handleTitleUpdate('My Box');
    handleDescriptionUpdate('');
    setPasswordEnabled(false);
    setPasswordValue('');
    setShowPassword(false);
    setTimeLockEnabled(false);
    setTimeLockMode('expiry');
    setTimeExpiryHours(24);
    setTimeDelayHours(24);
    setTimeOpenAt(formatLocalDateTime(new Date(Date.now() + 24 * 3600 * 1000)));
    setTimeLockAt(formatLocalDateTime(new Date(Date.now() + 48 * 3600 * 1000)));
    setHybridRevealMode('delay');
    setHybridSelfDestructHours(24);
    setShowTimeCountdown(true);
    setAccessLimitEnabled(false);
    setAccessLimitMaxOpens(1);
    setShowRemainingAccessCount(true);
    setReadyUrl('');
    setGeneratedUrl('');
    setIsCopied(false);
    setStageMode('editor');
    playTone(330, 'triangle', 0.25, 0.06);
  }, [handleContentUpdate, handleTitleUpdate, handleDescriptionUpdate, playTone]);

  // Generate Bitty Box
  const handleGenerateFinal = useCallback(async (bypassLintCheck: boolean = false) => {
    if (!bypassLintCheck && lintReport.errorsCount > 0) {
      setShowPreGenerateLintModal(true);
      return;
    }
    setShowPreGenerateLintModal(false);
    setIsEncoding(true);
    try {
      if (calculatedCreditCost > 0) {
        const userIsPro = Boolean(isPro || account.user?.tier === 'pro');
        const curCredits = account.user?.credits ?? 0;
        const canProceed = userIsPro || (account.isAuthenticated && curCredits >= calculatedCreditCost);
        if (!canProceed) {
          onOpenPaywall?.('Time & View Limit Locks (10 CR)');
          return;
        }
      }

      const source = (boxContent && boxContent.trim()) ? boxContent : (content && content.trim() ? content : DEFAULT_STARTER_CODE);
      const html = getRenderedHtml(source, {
        title: boxTitle || 'Bitty Box',
        description: boxDescription.trim() || '',
        language: 'en',
      });

      const pass = passwordEnabled && passwordValue.trim().length >= 8 ? passwordValue.trim() : undefined;
      if (passwordEnabled && passwordValue.trim().length < 8) {
        setStageMode('passwordLock');
        return;
      }
      const uniqueBoxId = `bbx_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

      let compressedFragment = '';
      if (!pass) {
        try {
          const syncRes = compressContentSync(html, { mimeType: 'text/html', isRawHtml: true });
          if (syncRes) {
            compressedFragment = syncRes.compressedUrl;
          }
        } catch {}
      }

      if (!compressedFragment) {
        try {
          const encoded = await compressContent(html, {
            password: pass,
            mimeType: 'text/html',
            isRawHtml: true,
          });
          if (encoded) {
            compressedFragment = encoded.compressedUrl;
          }
        } catch (err) {
          console.error('Compression failed:', err);
        }
      }

      if (!compressedFragment) return;

      const meta: BittyMetadata = {
        title: boxTitle || 'Bitty Box',
        description: boxDescription.trim() || '',
        favicon: '📦',
        includeMetadata: true,
        boxId: (accessLimitEnabled || timeLockEnabled) ? uniqueBoxId : undefined,
      };

      if (metadata?.ceremony) {
        meta.ceremony = metadata.ceremony;
      }

      if (timeLockEnabled) {
        meta.lockConfig = {
          timeWindow: buildTimeWindow({
            enabled: timeLockEnabled,
            mode: timeLockMode,
            expiryHours: timeExpiryHours,
            delayHours: timeDelayHours,
            openAt: timeOpenAt,
            lockAt: timeLockAt,
            hybridRevealMode,
            hybridSelfDestructHours,
            showCountdown: showTimeCountdown,
          })!,
        };
      }

      if (accessLimitEnabled) {
        meta.lockConfig = {
          ...(meta.lockConfig || {}),
          openLimit: {
            enabled: true,
            maxOpens: accessLimitMaxOpens,
            opensUsed: 0,
            showRemainingCount: showRemainingAccessCount,
          },
        };
      }

      const longUrl = buildBittyUrl(compressedFragment, meta);
      if (!longUrl) return;

      setGeneratedUrl(longUrl);
      onChangeContent?.(source);
      onChangeMetadata?.(meta);

      // Open new tab
      let tabOpened = false;
      try {
        const openedWin = window.open(longUrl, '_blank');
        if (openedWin && !openedWin.closed) {
          tabOpened = true;
        }
      } catch {}

      if (!tabOpened) {
        try {
          const link = document.createElement('a');
          link.href = longUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch {}
      }

      // Copy to clipboard
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(longUrl);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = longUrl;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3500);
      } catch {}

      // Register with access limit API
      if (accessLimitEnabled && longUrl) {
        try {
          await fetch('/api/boxes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: uniqueBoxId,
              boxId: uniqueBoxId,
              title: boxTitle || 'Bitty Box',
              bittyUrl: compressedFragment || longUrl,
              lockConfig: {
                openLimit: {
                  enabled: true,
                  maxOpens: accessLimitMaxOpens,
                  opensUsed: 0,
                  showRemainingCount: showRemainingAccessCount,
                },
                timeWindow: timeLockEnabled
                  ? buildTimeWindow({
                      enabled: timeLockEnabled,
                      mode: timeLockMode,
                      expiryHours: timeExpiryHours,
                      delayHours: timeDelayHours,
                      openAt: timeOpenAt,
                      lockAt: timeLockAt,
                      hybridRevealMode,
                      hybridSelfDestructHours,
                      showCountdown: showTimeCountdown,
                    })
                  : null,
              },
            }),
          });
        } catch {}
      }

      // Save to local history
      try {
        const hashId = await hashString(longUrl);
        const historyItem: BittyHistoryItem = {
          id: hashId,
          url: longUrl,
          title: boxTitle || 'Untitled Bitty Box',
          description: boxDescription.trim() || '',
          favicon: '📦',
          byteSize: boxContent.length,
          compressedSize: compressedFragment.length || longUrl.length,
          createdAt: Date.now(),
          encrypted: Boolean(passwordEnabled && passwordValue),
        };
        const existingHistory = JSON.parse(localStorage.getItem('bitty_box_history') || '[]');
        const updatedHistory = [historyItem, ...existingHistory.filter((h: any) => h.id !== hashId)].slice(0, 50);
        localStorage.setItem('bitty_box_history', JSON.stringify(updatedHistory));
      } catch {}

      setCurrentBoxId(uniqueBoxId);

      // Record to user account (and auto-pin if enabled)
      if (account.isAuthenticated || account.user) {
        try {
          if (autoPinToAccount) {
            await account.pinBox({
              id: uniqueBoxId,
              title: boxTitle || 'Untitled Bitty Box',
              url: longUrl,
              format: 'html',
              byteSize: boxContent.length,
              compressedSize: compressedFragment.length || longUrl.length,
              encrypted: Boolean(passwordEnabled && passwordValue),
              cost: calculatedCreditCost,
              createdAt: new Date().toISOString(),
              locks: {
                password: Boolean(passwordEnabled && passwordValue),
                timeWindow: Boolean(timeLockEnabled),
                accessLimit: Boolean(accessLimitEnabled),
              },
            }, boxContent);
            setPinSuccessNotice('Bitty Box generated & automatically pinned to your account dashboard with cloud backup!');
            setTimeout(() => setPinSuccessNotice(null), 6000);
          } else {
            await account.recordCreatedBox({
              title: boxTitle || 'Untitled Bitty Box',
              url: longUrl,
              format: 'html',
              byteSize: boxContent.length,
              compressedSize: compressedFragment.length || longUrl.length,
              encrypted: Boolean(passwordEnabled && passwordValue),
              cost: calculatedCreditCost,
              locks: {
                password: Boolean(passwordEnabled && passwordValue),
                timeWindow: Boolean(timeLockEnabled),
                accessLimit: Boolean(accessLimitEnabled),
              },
            });
          }
        } catch {}
      }

      playTone(880, 'sine', 0.35, 0.08);
    } finally {
      setIsEncoding(false);
    }
  }, [
    boxContent,
    content,
    boxTitle,
    boxDescription,
    passwordEnabled,
    passwordValue,
    timeLockEnabled,
    timeLockMode,
    timeExpiryHours,
    timeDelayHours,
    timeOpenAt,
    timeLockAt,
    hybridRevealMode,
    hybridSelfDestructHours,
    showTimeCountdown,
    accessLimitEnabled,
    accessLimitMaxOpens,
    showRemainingAccessCount,
    calculatedCreditCost,
    isPro,
    account,
    metadata?.ceremony,
    onChangeContent,
    onChangeMetadata,
    onOpenPaywall,
    playTone,
    lintReport.errorsCount,
    autoPinToAccount
  ]);

  // Stage Motion In-Place Transitions (No horizontal slide, purely spatial morph & fade)
  const stageMotionVariants = {
    initial: {
      opacity: 0,
      scale: 0.985,
      filter: 'blur(3px)',
    },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: 0.2,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.985,
      filter: 'blur(3px)',
      transition: {
        duration: 0.14,
        ease: [0.4, 0, 1, 1] as const,
      },
    },
  };

  // Ordered sequence of modes for guided navigation
  const modeSequence: StageMode[] = [
    'editor',
    'passwordLock',
    'timeLock',
    'accessLimitLock',
    'preview',
    'review',
  ];

  const currentModeIndex = modeSequence.indexOf(stageMode);
  const prevMode = currentModeIndex > 0 ? modeSequence[currentModeIndex - 1] : null;
  const nextMode = currentModeIndex < modeSequence.length - 1 ? modeSequence[currentModeIndex + 1] : null;

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-6 flex flex-col gap-3 font-mono text-cyan-100 select-none">
      {/* =========================================================================
          1. PERSISTENT STAGE HEADER / AUTHORITATIVE MODE NAVIGATOR
         ========================================================================= */}
      <div className="w-full bg-[#070419]/90 border border-cyan-500/25 rounded-2xl p-1.5 sm:p-2 shadow-[0_0_30px_rgba(0,0,0,0.7)] backdrop-blur-xl shrink-0">
        <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none py-0.5">
          {/* Editor Mode Tab */}
          <button
            type="button"
            onClick={() => handleModeSwitch('editor')}
            className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 ${
              stageMode === 'editor'
                ? 'bg-cyan-950/90 text-cyan-200 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,242,255,0.3)]'
                : 'text-cyan-400/70 hover:text-cyan-200 hover:bg-cyan-950/40 border border-transparent'
            }`}
          >
            <Code className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stageMode === 'editor' ? 'text-cyan-300' : 'text-cyan-500'}`} />
            <span>EDITOR</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300">
              {boxContent.length} B
            </span>
          </button>

          {/* Passcode Lock Tab */}
          <button
            type="button"
            onClick={() => handleModeSwitch('passwordLock')}
            className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 ${
              stageMode === 'passwordLock'
                ? 'bg-fuchsia-950/90 text-fuchsia-200 border border-fuchsia-400/60 shadow-[0_0_15px_rgba(217,70,239,0.3)]'
                : 'text-fuchsia-400/70 hover:text-fuchsia-200 hover:bg-fuchsia-950/40 border border-transparent'
            }`}
          >
            <Key className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stageMode === 'passwordLock' ? 'text-fuchsia-300' : 'text-fuchsia-500'}`} />
            <span>SECRET PIN</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
              isPasscodeActive
                ? 'bg-fuchsia-900/80 border-fuchsia-400 text-fuchsia-200 shadow-[0_0_8px_rgba(217,70,239,0.5)]'
                : 'bg-zinc-900/80 border-zinc-700 text-zinc-500'
            }`}>
              {isPasscodeActive ? 'PIN ON' : 'OFF'}
            </span>
          </button>

          {/* Time Lock Tab */}
          <button
            type="button"
            onClick={() => handleModeSwitch('timeLock')}
            className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 ${
              stageMode === 'timeLock'
                ? 'bg-amber-950/90 text-amber-200 border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'text-amber-400/70 hover:text-amber-200 hover:bg-amber-950/40 border border-transparent'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stageMode === 'timeLock' ? 'text-amber-300' : 'text-amber-500'}`} />
            <span>TIME LIMIT</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
              isTimeLockActive
                ? 'bg-amber-900/80 border-amber-400 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-zinc-900/80 border-zinc-700 text-zinc-500'
            }`}>
              {timeLockShortBadge}
            </span>
          </button>

          {/* View Limits Tab */}
          <button
            type="button"
            onClick={() => handleModeSwitch('accessLimitLock')}
            className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 ${
              stageMode === 'accessLimitLock'
                ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-400/60 shadow-[0_0_15px_rgba(0,255,204,0.3)]'
                : 'text-emerald-400/70 hover:text-emerald-200 hover:bg-emerald-950/40 border border-transparent'
            }`}
          >
            <Gauge className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stageMode === 'accessLimitLock' ? 'text-emerald-300' : 'text-emerald-500'}`} />
            <span>VIEW LIMIT</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
              isAccessLimitActive
                ? 'bg-emerald-900/80 border-emerald-400 text-emerald-200 shadow-[0_0_8px_rgba(0,255,204,0.5)]'
                : 'bg-zinc-900/80 border-zinc-700 text-zinc-500'
            }`}>
              {isAccessLimitActive ? `${accessLimitMaxOpens} Views` : 'OFF'}
            </span>
          </button>

          {/* Review & Generate Tab */}
          <button
            type="button"
            onClick={() => handleModeSwitch('review')}
            className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shrink-0 ${
              stageMode === 'review'
                ? 'bg-gradient-to-r from-cyan-950 to-fuchsia-950 text-cyan-100 border border-cyan-300/80 shadow-[0_0_18px_rgba(0,242,255,0.4)]'
                : 'text-cyan-300/80 hover:text-white hover:bg-cyan-950/40 border border-cyan-500/20'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300" />
            <span>CREATE LINK</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
              calculatedCreditCost > 0
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
            }`}>
              {calculatedCreditCost > 0 ? `${calculatedCreditCost} CR` : 'FREE'}
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. PERSISTENT SURROUNDING STATUS & STEP CONTROLS (STAGE HUD)
         ========================================================================= */}
      <div className="w-full bg-[#070419]/90 border border-cyan-500/25 rounded-2xl px-4 py-2.5 sm:py-3 shadow-[0_0_30px_rgba(0,0,0,0.7)] backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
        {/* Left: Active Box Status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-cyan-300 font-bold truncate">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">{boxTitle || 'My Page'}</span>
          </div>
          <span className="text-zinc-600">&bull;</span>
          <span className="text-[10px] text-cyan-400/80 font-mono shrink-0">
            {boxContent.length} chars
          </span>
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {isPasscodeActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/40">PIN</span>
            )}
            {isTimeLockActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">Timer</span>
            )}
            {isAccessLimitActive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">Views</span>
            )}
          </div>
        </div>

        {/* Center: Guided Stage Navigation Buttons */}
        <div className="flex items-center gap-2">
          {prevMode && (
            <button
              type="button"
              onClick={() => handleModeSwitch(prevMode)}
              className="py-1 px-2.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
          )}

          {nextMode && (
            <button
              type="button"
              onClick={() => handleModeSwitch(nextMode)}
              className="py-1 px-2.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right: Reset & Audio Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleStartOver}
            className="text-[10px] text-rose-400/80 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer"
            title="Reset and start over with clean starter"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Start Over</span>
          </button>

          <button
            type="button"
            onClick={() => {
              initAudio();
              setSoundEnabled(!soundEnabled);
            }}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50'
                : 'bg-black/40 border-cyan-500/20 text-cyan-600 hover:text-cyan-400'
            }`}
            title={soundEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
            aria-label="Toggle audio effects"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* =========================================================================
          3. THE CENTRAL BITTY STAGE WORKSPACE CANVAS
             Stationary bounding box: only the content inside morphs in place!
         ========================================================================= */}
      <div className="relative w-full min-h-[460px] md:min-h-[520px] bg-[#07041a]/90 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0_0_40px_rgba(0,0,0,0.85),inset_0_0_25px_rgba(0,242,255,0.06)] backdrop-blur-2xl flex flex-col justify-between overflow-hidden">
        {/* Subtle Cyber Corner Accents */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400/80 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400/80 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400/80 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400/80 pointer-events-none" />

        {/* Ambient Holographic Lottie Background */}
        <BittyLottie
          name="lock-lab-25"
          loop={false}
          className="absolute inset-0 w-full h-full opacity-[0.08] pointer-events-none mix-blend-screen"
        />

        {/* Stage Content Switcher (In-Place Spatial Transition) */}
        <div className="relative z-10 w-full flex-1 flex flex-col justify-center min-h-0">
          <AnimatePresence mode="wait">
            {/* ─────────────────────────────────────────────────────────────
                STAGE MODE: EDITOR
               ───────────────────────────────────────────────────────────── */}
            {stageMode === 'editor' && (
              <motion.div
                key="stage-mode-editor"
                variants={stageMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-stretch"
              >
                {/* Left: Code / Text Editor */}
                <div className="md:col-span-8 flex flex-col justify-between h-full min-h-[360px] bg-[#040212]/90 border border-cyan-500/40 rounded-xl p-3 sm:p-4 shadow-[0_0_20px_rgba(0,242,255,0.12)]">
                  {/* Top Bar: Title, Description, & Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 pb-2 border-b border-cyan-500/20">
                    <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">
                      Page Title
                      <input
                        type="text"
                        value={boxTitle}
                        onChange={e => handleTitleUpdate(e.target.value)}
                        placeholder="My Box"
                        maxLength={80}
                        className="w-full rounded-lg border border-cyan-400/30 bg-[#02010a] px-2.5 py-1.5 text-xs text-cyan-100 placeholder:text-cyan-500/40 outline-none focus:border-cyan-300 font-mono"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">
                      Description
                      <input
                        type="text"
                        value={boxDescription}
                        onChange={e => handleDescriptionUpdate(e.target.value)}
                        placeholder="Optional description..."
                        maxLength={180}
                        className="w-full rounded-lg border border-cyan-400/30 bg-[#02010a] px-2.5 py-1.5 text-xs text-cyan-100 placeholder:text-cyan-500/40 outline-none focus:border-cyan-300 font-mono"
                      />
                    </label>
                  </div>

                  {/* Editor Controls & Revision Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-[#02010a] p-0.5 rounded-lg border border-cyan-500/30">
                        <button
                          type="button"
                          id="stage-undo-btn"
                          onClick={onUndo}
                          disabled={!canUndo}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all ${
                            canUndo
                              ? 'text-cyan-200 hover:text-white bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,255,0.2)] cursor-pointer'
                              : 'text-cyan-500/30 border border-transparent cursor-not-allowed'
                          }`}
                          title="Undo recent edit (Ctrl+Z / ⌘Z)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>UNDO</span>
                          {undoCount !== undefined && undoCount > 0 && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-900/80 text-cyan-300">
                              {undoCount}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          id="stage-redo-btn"
                          onClick={onRedo}
                          disabled={!canRedo}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all ${
                            canRedo
                              ? 'text-cyan-200 hover:text-white bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,255,0.2)] cursor-pointer'
                              : 'text-cyan-500/30 border border-transparent cursor-not-allowed'
                          }`}
                          title="Redo recent edit (Ctrl+Y / ⌘⇧Z)"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>REDO</span>
                          {redoCount !== undefined && redoCount > 0 && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-900/80 text-cyan-300">
                              {redoCount}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Font Family Quick Link */}
                      <button
                        type="button"
                        onClick={onOpenTools}
                        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#02010a] hover:bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 text-[10px] font-mono transition-colors cursor-pointer"
                        title="Change Box Typography in Studio Tools"
                      >
                        <Type className="w-3 h-3 text-cyan-400" />
                        <span>FONT: {activeFontName}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      {/* Real-time HTML/CSS Syntax Linter Indicator */}
                      <button
                        type="button"
                        id="bitty-linter-toggle-btn"
                        onClick={() => setIsLinterOpen(v => !v)}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
                          lintReport.errorsCount > 0
                            ? 'bg-rose-950/90 border-rose-500/60 text-rose-300 hover:bg-rose-900 shadow-[0_0_12px_rgba(244,63,94,0.35)] animate-pulse'
                            : lintReport.warningsCount > 0
                            ? 'bg-amber-950/90 border-amber-500/60 text-amber-300 hover:bg-amber-900 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                            : boxContent.trim().length > 0
                            ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80'
                            : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-400/80 hover:bg-cyan-900/60'
                        }`}
                        title="Click to toggle real-time HTML/CSS syntax error linter"
                      >
                        {lintReport.errorsCount > 0 ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            <span>{lintReport.errorsCount} ERROR{lintReport.errorsCount > 1 ? 'S' : ''}</span>
                          </>
                        ) : lintReport.warningsCount > 0 ? (
                          <>
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            <span>{lintReport.warningsCount} WARN{lintReport.warningsCount > 1 ? 'S' : ''}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>SYNTAX OK</span>
                          </>
                        )}
                        <span className="text-[9px] opacity-70 underline ml-0.5">
                          {isLinterOpen ? 'HIDE' : 'LINTER'}
                        </span>
                      </button>

                      <span className="text-cyan-400/70">{boxContent.split('\n').length} LINES</span>
                      <span className="text-cyan-400/70">•</span>
                      <span className="text-cyan-400/70">{boxContent.length} BYTES</span>
                    </div>
                  </div>

                  {/* Main Text / Code Composer */}
                  <textarea
                    id="bitty-code-composer"
                    value={boxContent}
                    onChange={e => handleContentUpdate(e.target.value)}
                    onKeyDown={e => {
                      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
                        e.preventDefault();
                        if (e.shiftKey) {
                          onRedo?.();
                        } else {
                          onUndo?.();
                        }
                      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
                        e.preventDefault();
                        onRedo?.();
                      }
                    }}
                    placeholder="Write text or paste HTML, CSS, or JavaScript code here..."
                    className={`w-full flex-1 min-h-[200px] sm:min-h-[240px] resize-none rounded-lg border bg-[#02010a] p-3 text-xs leading-relaxed text-cyan-100 placeholder:text-cyan-500/40 outline-none font-mono transition-colors ${
                      lintReport.errorsCount > 0
                        ? 'border-rose-500/40 focus:border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]'
                        : 'border-cyan-400/30 focus:border-cyan-300'
                    }`}
                  />

                  {/* Real-time Code Linter Feedback Panel */}
                  <div className="mt-2">
                    <CodeLinterPanel
                      report={lintReport}
                      isOpen={isLinterOpen}
                      onToggle={() => setIsLinterOpen(v => !v)}
                      onSelectLine={handleSelectLinterLine}
                    />
                  </div>

                  {/* Bottom Presets & Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-cyan-500/20 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-cyan-400/60 text-[10px]">PRESETS:</span>
                      <button
                        type="button"
                        onClick={() => handleContentUpdate(DEFAULT_STARTER_CODE, true)}
                        className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] hover:bg-cyan-900 transition-colors"
                      >
                        Clean
                      </button>
                      <button
                        type="button"
                        onClick={() => handleContentUpdate('<h1>🔒 Secret Note</h1>\n<p>Only visible to holders of this link.</p>', true)}
                        className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] hover:bg-cyan-900 transition-colors"
                      >
                        Secret Note
                      </button>
                      <button
                        type="button"
                        onClick={() => handleContentUpdate('<div style="text-align:center;padding:40px;font-family:sans-serif;">\n  <h1>⚡ Interactive Bitty App</h1>\n  <button onclick="alert(\'Activated!\')" style="padding:10px 20px;border-radius:8px;background:#00f2ff;color:#000;font-weight:bold;cursor:pointer;border:none;">Tap Me</button>\n</div>', true)}
                        className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] hover:bg-cyan-900 transition-colors"
                      >
                        Mini App
                      </button>

                      {/* Linter Quick Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setIsLinterOpen(v => !v)}
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                          isLinterOpen
                            ? 'bg-cyan-400 text-black border-cyan-300 font-bold'
                            : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900'
                        }`}
                        title="Toggle HTML/CSS Syntax Error Linter panel"
                      >
                        <FileCode className="w-3 h-3" />
                        <span>LINTER {isLinterOpen ? 'OPEN' : 'CHECK'}</span>
                        {lintReport.errorsCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-cyan-400 font-bold">
                        {boxContent.length} BYTES
                      </span>
                      {boxContent && (
                        <button
                          type="button"
                          onClick={() => handleContentUpdate('', true)}
                          className="text-[10px] text-rose-400/80 hover:text-rose-300 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Review & Create Link Action */}
                <div className="md:col-span-4 flex flex-col justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('review')}
                    className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,242,255,0.4)] transition-all cursor-pointer"
                  >
                    <span>REVIEW & CREATE LINK</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                STAGE MODE: PASSCODE LOCK (AES-256-GCM)
               ───────────────────────────────────────────────────────────── */}
            {stageMode === 'passwordLock' && (
              <motion.div
                key="stage-mode-password"
                variants={stageMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-stretch"
              >
                <div className="md:col-span-7 flex flex-col justify-between bg-[#050314]/90 border border-fuchsia-500/40 rounded-xl p-4 sm:p-5 shadow-[0_0_25px_rgba(217,70,239,0.18)]">
                  <div>
                    <div className="flex items-center justify-between border-b border-fuchsia-500/20 pb-3 mb-3">
                      <div className="flex items-center gap-2 text-fuchsia-300 font-bold text-sm">
                        <Key className="w-4 h-4 text-fuchsia-400" />
                        <span>LOCK WITH SECRET PIN</span>
                      </div>
                      <HoloToggle
                        id="holo-stage-password-toggle"
                        checked={passwordEnabled}
                        onChange={setPasswordEnabled}
                      />
                    </div>

                    {passwordEnabled ? (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs text-fuchsia-300/80">
                          <span>ENTER 8 TO 12-DIGIT SECRET PIN</span>
                          <span className={`px-2 py-0.5 rounded border font-bold ${
                            isPasscodeTooShort ? 'border-rose-500 text-rose-300 bg-rose-950/60' : 'border-fuchsia-400 text-fuchsia-200 bg-fuchsia-950/80'
                          }`}>
                            {passwordValue.length} / 12 Digits
                          </span>
                        </div>

                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={12}
                            value={passwordValue}
                            onChange={e => {
                              const numbersOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                              setPasswordValue(numbersOnly);
                            }}
                            placeholder="Type 8-12 secret numbers..."
                            className="w-full rounded-xl border border-fuchsia-400/50 bg-[#02010a] px-4 py-3 text-center text-lg tracking-[0.25em] text-fuchsia-100 placeholder:text-fuchsia-500/40 placeholder:text-xs placeholder:tracking-normal outline-none focus:border-fuchsia-300 pr-10 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-fuchsia-400 hover:text-fuchsia-200"
                            title={showPassword ? 'Hide PIN' : 'Show PIN'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {isPasscodeTooShort && (
                          <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>At least 8 numbers required for your PIN.</span>
                          </div>
                        )}

                        {/* PIN Slots Visualizer */}
                        <div className="flex items-center justify-center gap-1.5 py-1">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-3.5 h-3.5 rounded-full border transition-all ${
                                i < passwordValue.length
                                  ? 'bg-fuchsia-400 border-fuchsia-300 shadow-[0_0_8px_rgba(217,70,239,0.8)]'
                                  : 'bg-black/50 border-fuchsia-500/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-xs text-fuchsia-200/70 space-y-2">
                        <Lock className="w-10 h-10 text-fuchsia-400/40" />
                        <p className="text-xs text-fuchsia-300/80">Anyone with this link will be able to view your content. Turn this on to protect it with a secret PIN.</p>
                        <button
                          type="button"
                          onClick={() => setPasswordEnabled(true)}
                          className="px-3 py-1.5 rounded-lg bg-fuchsia-950 border border-fuchsia-500/40 text-fuchsia-300 text-xs font-bold hover:bg-fuchsia-900 transition-colors"
                        >
                          + Protect With PIN
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-fuchsia-500/20 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('editor')}
                      className="text-cyan-400/80 hover:text-cyan-200 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Back to Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('timeLock')}
                      className="text-amber-400/80 hover:text-amber-200 flex items-center gap-1 font-bold"
                    >
                      Next: Time Limit <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="md:col-span-5 flex flex-col justify-between p-4 rounded-xl bg-black/40 border border-fuchsia-500/25 space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-fuchsia-400" />
                      <span>HOW PIN PROTECTION WORKS</span>
                    </div>
                    <p className="text-xs text-fuchsia-200/80 leading-relaxed">
                      Setting a secret PIN encrypts your content right in your browser. Nobody can open your page without entering this exact PIN.
                    </p>
                    <div className="space-y-1 text-[11px] text-zinc-300/90 pt-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Your PIN is never saved or sent to any server</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Military-grade encryption keeps it locked tight</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Visitors see a simple numeric keypad to unlock</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-fuchsia-950/30 border border-fuchsia-500/30 text-[10px] text-fuchsia-300/90">
                    💡 <strong>Creator Tip:</strong> PIN locks are 100% free forever — no account or credits needed.
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                STAGE MODE: TIME LOCK
               ───────────────────────────────────────────────────────────── */}
            {stageMode === 'timeLock' && (
              <motion.div
                key="stage-mode-timelock"
                variants={stageMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-stretch"
              >
                <div className="md:col-span-7 flex flex-col justify-between bg-[#050314]/90 border border-amber-500/40 rounded-xl p-4 sm:p-5 shadow-[0_0_25px_rgba(245,158,11,0.18)]">
                  <div>
                    <div className="flex items-center justify-between border-b border-amber-500/20 pb-3 mb-3">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>SET A TIME LIMIT OR EXPIRATION</span>
                      </div>
                      <HoloToggle
                        id="holo-stage-time-toggle"
                        checked={timeLockEnabled}
                        onChange={setTimeLockEnabled}
                      />
                    </div>

                    {timeLockEnabled ? (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        {/* Time Lock Mode Tabs */}
                        <div className="grid grid-cols-4 gap-1 p-1 bg-black/60 border border-amber-500/30 rounded-lg text-[10px] font-bold">
                          {[
                            { id: 'expiry', label: 'Expires After' },
                            { id: 'delay', label: 'Unlock Later' },
                            { id: 'range', label: 'Active Window' },
                            { id: 'hybrid', label: 'Delay & Expire' },
                          ].map(m => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setTimeLockMode(m.id as TimeLockMode)}
                              className={`py-1.5 rounded transition-all truncate ${
                                timeLockMode === m.id
                                  ? 'bg-amber-500/30 border border-amber-400 text-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                  : 'text-amber-400/60 hover:text-amber-200'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>

                        {/* Mode Specific Controls */}
                        {timeLockMode === 'expiry' && (
                          <DurationTimeControl
                            value={timeExpiryHours}
                            onChange={setTimeExpiryHours}
                            presets={[1, 6, 24, 48, 168]}
                            label="EXPIRES & CLOSES AFTER:"
                          />
                        )}

                        {timeLockMode === 'delay' && (
                          <DurationTimeControl
                            value={timeDelayHours}
                            onChange={setTimeDelayHours}
                            presets={[1, 6, 24, 48, 168]}
                            label="STAYS LOCKED FOR:"
                          />
                        )}

                        {timeLockMode === 'range' && (
                          <DateRangeControl
                            openAt={timeOpenAt}
                            lockAt={timeLockAt}
                            onOpenAt={setTimeOpenAt}
                            onLockAt={setTimeLockAt}
                          />
                        )}

                        {timeLockMode === 'hybrid' && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <DurationTimeControl
                                value={timeDelayHours}
                                onChange={setTimeDelayHours}
                                presets={[1, 6, 24]}
                                label="LOCKED FOR:"
                                compact
                              />
                              <DurationTimeControl
                                value={hybridSelfDestructHours}
                                onChange={setHybridSelfDestructHours}
                                presets={[6, 24, 72]}
                                label="EXPIRES AFTER:"
                                compact
                              />
                            </div>
                          </div>
                        )}

                        {/* Show Countdown Toggle */}
                        <label className="flex items-center justify-between text-xs text-amber-300/90 pt-1 cursor-pointer">
                          <span>Show a countdown clock to visitors</span>
                          <input
                            type="checkbox"
                            checked={showTimeCountdown}
                            onChange={e => setShowTimeCountdown(e.target.checked)}
                            className="rounded border-amber-400/50 bg-black text-amber-500 focus:ring-amber-400"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-xs text-amber-200/70 space-y-2">
                        <Clock className="w-10 h-10 text-amber-400/40" />
                        <p className="text-xs text-amber-300/80">No time limit set. This link will stay open and available forever.</p>
                        <button
                          type="button"
                          onClick={() => setTimeLockEnabled(true)}
                          className="px-3 py-1.5 rounded-lg bg-amber-950 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-900 transition-colors"
                        >
                          + Set Time Limit
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('passwordLock')}
                      className="text-fuchsia-400/80 hover:text-fuchsia-200 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Back: Secret PIN
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('accessLimitLock')}
                      className="text-emerald-400/80 hover:text-emerald-200 flex items-center gap-1 font-bold"
                    >
                      Next: View Limits <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="md:col-span-5 flex flex-col justify-between p-4 rounded-xl bg-black/40 border border-amber-500/25 space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>HOW TIME LIMITS WORK</span>
                    </div>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                      Official internet time servers verify the clock so visitors cannot cheat by changing their phone or computer date.
                    </p>
                    <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 font-mono text-[11px] text-amber-200 space-y-1">
                      <div className="text-[9px] text-amber-400/80 font-bold uppercase">Active Schedule:</div>
                      <div>{timeLockSummary}</div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-[10px] text-amber-300/90">
                    ⚡ <strong>Billing:</strong> Timed locks require 10 credits (or free with PRO membership).
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                STAGE MODE: VIEW LIMITS (ACCESS LIMIT LOCK)
               ───────────────────────────────────────────────────────────── */}
            {stageMode === 'accessLimitLock' && (
              <motion.div
                key="stage-mode-viewlimit"
                variants={stageMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-stretch"
              >
                <div className="md:col-span-7 flex flex-col justify-between bg-[#050314]/90 border border-emerald-500/40 rounded-xl p-4 sm:p-5 shadow-[0_0_25px_rgba(0,255,204,0.18)]">
                  <div>
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 mb-3">
                      <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                        <Gauge className="w-4 h-4 text-emerald-400" />
                        <span>LIMIT HOW MANY TIMES THIS LINK CAN BE OPENED</span>
                      </div>
                      <HoloToggle
                        id="holo-stage-views-toggle"
                        checked={accessLimitEnabled}
                        onChange={setAccessLimitEnabled}
                      />
                    </div>

                    {accessLimitEnabled ? (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        <div className="text-xs text-emerald-300/80 font-bold">CHOOSE HOW MANY VIEWS TO ALLOW:</div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[1, 3, 5, 10].map(q => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => {
                                setIsCustomAccessLimit(false);
                                setAccessLimitMaxOpens(q);
                              }}
                              className={`py-2 px-1 rounded-lg border text-xs font-bold transition-all truncate ${
                                !isCustomAccessLimit && accessLimitMaxOpens === q
                                  ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-[0_0_10px_rgba(0,255,204,0.4)]'
                                  : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40'
                              }`}
                            >
                              {q === 1 ? '1 View (Burn)' : `${q} Views`}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              if (!isPro) {
                                onOpenPaywall?.('Custom View Limit Lock');
                                return;
                              }
                              setIsCustomAccessLimit(true);
                              const parsed = parseInt(customAccessLimitInput, 10);
                              if (!isNaN(parsed) && parsed >= 1 && parsed <= 1000000) {
                                setAccessLimitMaxOpens(parsed);
                              }
                            }}
                            className={`py-2 px-1 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                              isCustomAccessLimit
                                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-[0_0_10px_rgba(0,255,204,0.4)]'
                                : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40'
                            }`}
                          >
                            <span>Custom</span>
                            <span className="px-1 py-0.2 rounded text-[8px] bg-fuchsia-950 text-amber-300 border border-amber-500/50">PRO</span>
                          </button>
                        </div>

                        {isCustomAccessLimit && (
                          <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2.5 flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={1000000}
                              value={customAccessLimitInput}
                              onChange={e => {
                                setCustomAccessLimitInput(e.target.value);
                                const parsed = parseInt(e.target.value, 10);
                                if (!isNaN(parsed) && parsed >= 1 && parsed <= 1000000) {
                                  setAccessLimitMaxOpens(parsed);
                                }
                              }}
                              placeholder="e.g. 500"
                              className="flex-1 bg-black/70 border border-emerald-500/40 rounded px-2.5 py-1 text-xs text-emerald-200 font-mono outline-none focus:border-emerald-400"
                            />
                            <span className="text-xs text-emerald-300 font-bold whitespace-nowrap">
                              {accessLimitMaxOpens.toLocaleString()} Max Views
                            </span>
                          </div>
                        )}

                        <label className="flex items-center justify-between text-xs text-emerald-300/90 pt-1 cursor-pointer">
                          <span>Show remaining view counter to visitors</span>
                          <input
                            type="checkbox"
                            checked={showRemainingAccessCount}
                            onChange={e => setShowRemainingAccessCount(e.target.checked)}
                            className="rounded border-emerald-400/50 bg-black text-emerald-500 focus:ring-emerald-400"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-xs text-emerald-200/70 space-y-2">
                        <Gauge className="w-10 h-10 text-emerald-400/40" />
                        <p className="text-xs text-emerald-300/80">Unlimited views. Anyone with the link can open it as many times as they want.</p>
                        <button
                          type="button"
                          onClick={() => setAccessLimitEnabled(true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-900 transition-colors"
                        >
                          + Set View Limit
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('timeLock')}
                      className="text-amber-400/80 hover:text-amber-200 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Back: Time Limit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('review')}
                      className="text-cyan-300 hover:text-white flex items-center gap-1 font-bold"
                    >
                      Next: Review & Create Link <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="md:col-span-5 flex flex-col justify-between p-4 rounded-xl bg-black/40 border border-emerald-500/25 space-y-3">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-emerald-400" />
                      <span>HOW VIEW LIMITS WORK</span>
                    </div>
                    <p className="text-xs text-emerald-200/80 leading-relaxed">
                      Each time someone opens your link, our counter ticks down by one. Once all views are used, the link closes forever.
                    </p>
                    <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 font-mono text-[11px] text-emerald-200 space-y-1">
                      <div className="text-[9px] text-emerald-400/80 font-bold uppercase">Active Limit:</div>
                      <div>
                        {accessLimitEnabled ? (accessLimitMaxOpens === 1 ? 'Closes after 1 view' : `${accessLimitMaxOpens} Views Allowed`) : 'Unlimited Views'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[10px] text-emerald-300/90">
                    ⚡ <strong>Billing:</strong> View limits require 10 credits (or free with PRO membership).
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                STAGE MODE: LIVE PREVIEW
               ───────────────────────────────────────────────────────────── */}
            {stageMode === 'preview' && (
              <motion.div
                key="stage-mode-preview"
                variants={stageMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex-1 flex flex-col justify-between bg-[#040212]/95 border border-cyan-500/40 rounded-xl overflow-hidden shadow-[0_0_25px_rgba(0,242,255,0.2)] min-h-[380px]"
              >
                {/* Preview Top Header */}
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#09051f] border-b border-cyan-500/25 text-xs text-cyan-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold">LIVE RENDERED OUTPUT</span>
                  </div>

                  {/* Device Size Toggles */}
                  <div className="flex items-center gap-1 bg-black/60 border border-cyan-500/30 rounded-lg p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1.5 rounded transition-all ${
                        previewDevice === 'desktop' ? 'bg-cyan-950 text-cyan-200 border border-cyan-400/60' : 'text-cyan-500 hover:text-cyan-300'
                      }`}
                      title="Desktop View (100%)"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('tablet')}
                      className={`p-1.5 rounded transition-all ${
                        previewDevice === 'tablet' ? 'bg-cyan-950 text-cyan-200 border border-cyan-400/60' : 'text-cyan-500 hover:text-cyan-300'
                      }`}
                      title="Tablet View (768px)"
                    >
                      <Tablet className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1.5 rounded transition-all ${
                        previewDevice === 'mobile' ? 'bg-cyan-950 text-cyan-200 border border-cyan-400/60' : 'text-cyan-500 hover:text-cyan-300'
                      }`}
                      title="Mobile View (375px)"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIframeKey(k => k + 1)}
                      className="p-1 rounded text-cyan-400 hover:text-cyan-200 transition-colors"
                      title="Reload Preview Frame"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const win = window.open();
                        if (win) {
                          win.document.write(stagePreviewHtml);
                          win.document.close();
                        }
                      }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1 font-bold"
                    >
                      <span>New Tab</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Preview Viewport Frame */}
                <div className="flex-1 w-full bg-[#03010b] flex items-center justify-center p-2 sm:p-4 min-h-[300px]">
                  <div
                    className={`h-full max-h-[440px] bg-white rounded-lg shadow-2xl transition-all duration-300 overflow-hidden relative ${
                      previewDevice === 'mobile'
                        ? 'w-[375px] max-w-full'
                        : previewDevice === 'tablet'
                        ? 'w-[768px] max-w-full'
                        : 'w-full'
                    }`}
                  >
                    <iframe
                      key={iframeKey}
                      srcDoc={stagePreviewHtml}
                      title="Bitty Stage Live Preview"
                      className="w-full h-full border-0 bg-white"
                      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                    />
                  </div>
                </div>

                {/* Preview Bottom Bar */}
                <div className="px-4 py-2 bg-[#09051f] border-t border-cyan-500/25 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('editor')}
                    className="text-cyan-400/80 hover:text-cyan-200 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Return to Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('review')}
                    className="text-cyan-300 hover:text-white flex items-center gap-1 font-bold"
                  >
                    Proceed to Review & Ship <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                STAGE MODE: REVIEW & GENERATE
               ───────────────────────────────────────────────────────────── */}
            {stageMode === 'review' && (
              <motion.div
                key="stage-mode-review"
                variants={stageMotionVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-stretch"
              >
                {/* Left: Complete Verification Checklist */}
                <div className="md:col-span-6 flex flex-col justify-between bg-[#050314]/90 border border-cyan-500/40 rounded-xl p-4 sm:p-5 shadow-[0_0_25px_rgba(0,242,255,0.2)]">
                  <div>
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5 mb-2.5">
                      <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        <span>PAGE PROTECTION SUMMARY</span>
                      </div>
                      <span className="text-[10px] text-cyan-400 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-full font-bold">
                        {boxContent.length} CHARS
                      </span>
                    </div>

                    <div className="mb-3 rounded-lg border border-cyan-500/30 bg-cyan-950/25 p-2.5 text-cyan-100/90">
                      <div className="text-[10px] uppercase tracking-wider text-cyan-400/80 font-bold">Page Title</div>
                      <div className="text-sm font-black text-cyan-100 truncate mt-0.5">{boxTitle || 'My Page'}</div>
                      <div className="text-[10px] text-cyan-200/70 truncate mt-0.5">
                        {boxDescription.trim() || 'No description provided.'}
                      </div>
                    </div>

                    {/* Active Lock Items */}
                    <div className="space-y-2 text-xs">
                      {/* Passcode Lock */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        isPasscodeActive
                          ? 'bg-fuchsia-950/40 border-fuchsia-500/50 text-fuchsia-200'
                          : 'bg-black/30 border-zinc-800/80 text-zinc-500'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Key className={`w-4 h-4 shrink-0 ${isPasscodeActive ? 'text-fuchsia-400' : 'text-zinc-600'}`} />
                          <div className="min-w-0">
                            <div className="font-bold text-[11px] truncate">SECRET PIN</div>
                            <div className="text-[10px] opacity-80 truncate">
                              {isPasscodeActive ? `${passwordValue.length}-Digit PIN Required to Open` : 'Turned Off'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('passwordLock')}
                          className="text-[10px] text-cyan-400 hover:underline shrink-0"
                        >
                          {isPasscodeActive ? 'Edit' : 'Turn On'}
                        </button>
                      </div>

                      {/* Time-Based Lock */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        isTimeLockActive
                          ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                          : 'bg-black/30 border-zinc-800/80 text-zinc-500'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Clock className={`w-4 h-4 shrink-0 ${isTimeLockActive ? 'text-amber-400' : 'text-zinc-600'}`} />
                          <div className="min-w-0">
                            <div className="font-bold text-[11px] truncate">TIME LIMIT</div>
                            <div className="text-[10px] opacity-80 truncate">{timeLockSummary}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('timeLock')}
                          className="text-[10px] text-cyan-400 hover:underline shrink-0"
                        >
                          {isTimeLockActive ? 'Edit' : 'Turn On'}
                        </button>
                      </div>

                      {/* Access Limit Lock */}
                      <div className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        isAccessLimitActive
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                          : 'bg-black/30 border-zinc-800/80 text-zinc-500'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Gauge className={`w-4 h-4 shrink-0 ${isAccessLimitActive ? 'text-emerald-400' : 'text-zinc-600'}`} />
                          <div className="min-w-0">
                            <div className="font-bold text-[11px] truncate">VISITOR LIMIT</div>
                            <div className="text-[10px] opacity-80 truncate">
                              {isAccessLimitActive ? `${accessLimitMaxOpens.toLocaleString()} Max Views` : 'Unlimited Views'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleModeSwitch('accessLimitLock')}
                          className="text-[10px] text-cyan-400 hover:underline shrink-0"
                        >
                          {isAccessLimitActive ? 'Edit' : 'Turn On'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 text-[10px] text-cyan-400/60">
                    Ready to create your shareable link!
                  </div>
                </div>

                {/* Right: Dynamic Credit Cost & Generation Station */}
                <div className="md:col-span-6 flex flex-col justify-between bg-[#050314]/95 border border-cyan-500/40 rounded-xl p-4 sm:p-5 shadow-[0_0_25px_rgba(0,242,255,0.2)]">
                  <div>
                    {/* Cost Calculation Header */}
                    <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2.5 mb-2.5">
                      <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-bold">
                        <Coins className="w-4 h-4 text-amber-400" />
                        <span>CREDITS & PRICING</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-400/40 text-cyan-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>READY</span>
                      </div>
                    </div>

                    {/* Total Credits Display */}
                    <div className="p-3 rounded-xl bg-[#08041d] border border-cyan-500/30 flex items-center justify-between mb-3 shadow-inner">
                      <div>
                        <div className="text-[10px] text-cyan-400/90 font-bold uppercase tracking-wider">
                          TOTAL COST
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {calculatedCreditCost === 0 ? 'Free Forever · Zero Credits Needed' : 'Advanced Locks Configured'}
                        </div>
                      </div>

                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-amber-300 to-fuchsia-300">
                          {calculatedCreditCost}
                        </span>
                        <span className="text-xs font-bold text-amber-300">CR</span>
                      </div>
                    </div>

                    {/* Itemized Grid — Base rows + every active lock (dynamic) */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] mb-3">
                      <div className="p-2 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 flex items-center justify-between">
                        <span>Base Page</span>
                        <span className="font-bold text-emerald-400">FREE</span>
                      </div>
                      <div className={`p-2 rounded border flex items-center justify-between ${
                        isPasscodeActive ? 'bg-fuchsia-950/40 border-fuchsia-500/50 text-fuchsia-200' : 'bg-black/30 border-zinc-800 text-zinc-600'
                      }`}>
                        <span>Secret PIN</span>
                        <span className="font-bold text-emerald-400">FREE</span>
                      </div>
                      {activeLocks.map((lock) => (
                        <div
                          key={lock.id}
                          className="p-2 rounded border flex items-center justify-between bg-cyan-950/40 border-cyan-500/40 text-cyan-100"
                        >
                          <span className="truncate pr-1">{lock.title}</span>
                          <span className="font-bold shrink-0">{lock.cost === 0 ? 'FREE' : `+${lock.cost} CR`}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Generation Action Zone */}
                  <div className="space-y-2 pt-2 border-t border-cyan-500/20">
                    {/* Auto-Pin Cloud Backup Setting */}
                    <div className="p-2.5 rounded-lg bg-[#03010c] border border-cyan-500/30 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <Pin className={`w-3.5 h-3.5 shrink-0 ${autoPinToAccount ? 'text-amber-400 fill-amber-400/40' : 'text-cyan-400/60'}`} />
                        <div className="min-w-0">
                          <div className="font-bold text-cyan-200 truncate flex items-center gap-1.5">
                            <span>Auto-Pin to Account Dashboard</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono">CLOUD BACKUP</span>
                          </div>
                          <div className="text-[10px] text-cyan-400/70 truncate">
                            Permanent server backup while keeping URL structure intact
                          </div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoPinToAccount}
                        onChange={e => setAutoPinToAccount(e.target.checked)}
                        className="rounded border-cyan-500/40 text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer"
                        title="Automatically pin and back up this box upon generation"
                      />
                    </div>

                    {/* Pre-generation Linter Status Notice */}
                    {lintReport.errorsCount > 0 && (
                      <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/60 text-rose-200 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                          <div className="text-[11px] leading-tight">
                            <span className="font-bold">{lintReport.errorsCount} syntax error{lintReport.errorsCount > 1 ? 's' : ''}</span> detected in your code.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStageMode('editor');
                            setIsLinterOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-[10px] font-bold text-rose-100 uppercase transition-colors shrink-0"
                        >
                          Review Errors
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-center">
                      <HoloGenerateButton
                        onClick={() => handleGenerateFinal(false)}
                        isCopied={isCopied}
                        wide
                        label={requiresCredits ? `GET CREDITS (${calculatedCreditCost} CR)` : "CREATE SHAREABLE LINK"}
                        className="my-0 scale-90 sm:scale-95 origin-center"
                      />
                    </div>

                    {pinSuccessNotice && (
                      <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-400/70 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-[11px]">{pinSuccessNotice}</span>
                      </div>
                    )}

                    {generatedUrl && (
                      <div className="space-y-1.5 pt-1">
                        {/* Pin to Dashboard Button for Permanent Cloud Storage */}
                        <button
                          type="button"
                          id="pin-bitty-box-btn"
                          disabled={isPinning}
                          onClick={handlePinCurrentBox}
                          className={`w-full py-2 px-3 rounded-lg border text-xs font-bold font-cyber flex items-center justify-center gap-2 transition-all cursor-pointer ${
                            isCurrentBoxPinned
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                              : 'bg-cyan-950/90 border-amber-500/50 text-amber-300 hover:bg-amber-950/60 hover:border-amber-400'
                          }`}
                          title="Pin this Bitty Box to your account dashboard for permanent cloud backup while keeping its URL structure"
                        >
                          <Pin className={`w-3.5 h-3.5 ${isCurrentBoxPinned ? 'fill-amber-400 text-amber-400 rotate-45' : 'text-amber-400'}`} />
                          <span>
                            {isPinning
                              ? 'BACKING UP TO SERVER...'
                              : isCurrentBoxPinned
                              ? 'PINNED TO ACCOUNT DASHBOARD (CLOUD BACKED UP) ✓'
                              : '📌 PIN TO ACCOUNT DASHBOARD (CLOUD STORAGE BACKUP)'}
                          </span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsQrModalOpen(true)}
                            className="flex-1 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-900 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>QR Code</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => exportBittyToZip(boxContent, metadata || { title: boxTitle }, generatedUrl)}
                            className="flex-1 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-900 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download ZIP</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pre-Generate Lint Warning Modal */}
      {showPreGenerateLintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#08041d] border border-rose-500/60 p-5 shadow-[0_0_35px_rgba(244,63,94,0.3)] text-cyan-100">
            <div className="flex items-center gap-3 border-b border-rose-500/30 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-500/60 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold font-cyber text-rose-200 uppercase tracking-wider">
                  HTML/CSS Syntax Errors Detected
                </h3>
                <p className="text-xs text-rose-300/80">
                  {lintReport.errorsCount} error{lintReport.errorsCount > 1 ? 's' : ''} found that may cause page rendering or styling issues
                </p>
              </div>
            </div>

            {/* Error List Preview */}
            <div className="max-h-56 overflow-y-auto space-y-2 mb-4 p-2 rounded-xl bg-black/50 border border-rose-500/20 font-mono text-xs">
              {lintReport.issues.filter(i => i.severity === 'error').map((err, i) => (
                <div key={i} className="p-2 rounded bg-rose-950/40 border border-rose-500/40 text-rose-200">
                  <div className="flex items-center gap-1.5 font-bold text-rose-300">
                    <span className="px-1.5 py-0.2 rounded bg-rose-900 text-[10px]">LINE {err.line}</span>
                    <span className="uppercase text-[10px] text-rose-400">{err.type} SYNTAX ERROR</span>
                  </div>
                  <div className="text-[11px] text-rose-200/90 mt-1">{err.message}</div>
                  {err.snippet && (
                    <div className="text-[10px] text-cyan-300/70 mt-0.5 truncate bg-black/40 px-1.5 py-0.5 rounded">
                      `{err.snippet}`
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowPreGenerateLintModal(false);
                  setStageMode('editor');
                  setIsLinterOpen(true);
                  const firstErr = lintReport.issues.find(i => i.severity === 'error');
                  if (firstErr) {
                    handleSelectLinterLine(firstErr.line);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-cyan-950 border border-cyan-400/60 text-cyan-200 hover:bg-cyan-900 text-xs font-bold uppercase transition-colors"
              >
                Review in Editor
              </button>
              <button
                type="button"
                onClick={() => handleGenerateFinal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white text-xs font-bold uppercase hover:opacity-90 transition-opacity"
              >
                Generate Link Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {isQrModalOpen && (
        <QrModal
          isOpen={isQrModalOpen}
          url={generatedUrl || readyUrl || window.location.href}
          title={boxTitle}
          onClose={() => setIsQrModalOpen(false)}
        />
      )}
    </div>
  );
};
