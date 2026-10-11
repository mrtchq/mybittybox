import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock } from 'lucide-react';

export const GripVerticalIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
);

export const GripHorizontalIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="9" r="1" />
    <circle cx="5" cy="9" r="1" />
    <circle cx="19" cy="9" r="1" />
    <circle cx="12" cy="15" r="1" />
    <circle cx="5" cy="15" r="1" />
    <circle cx="19" cy="15" r="1" />
  </svg>
);

export const GRIP_ICON_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

export const GRIP_HORIZONTAL_ICON_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="5" cy="15" r="1"/><circle cx="19" cy="15" r="1"/></svg>';

export interface EdgeGripHandlesProps {
  onOpenPreview?: () => void;
  onOpenAccount?: () => void;
  isPreviewOpen?: boolean;
  isAccountOpen?: boolean;
  onOpenLeft?: () => void;
  onOpenRight?: () => void;
  isLeftOpen?: boolean;
  isRightOpen?: boolean;
  hasActiveLocks?: boolean;
  bottomClassName?: string;
  topClassName?: string;
}

export const EdgeGripHandles: React.FC<EdgeGripHandlesProps> = ({
  onOpenPreview,
  isPreviewOpen,
  onOpenLeft,
  isLeftOpen,
  hasActiveLocks = false,
  topClassName,
}) => {
  const handleOpenPreview = onOpenPreview || onOpenLeft;
  const previewOpen = isPreviewOpen !== undefined ? isPreviewOpen : Boolean(isLeftOpen);
  const [gripBurst, setGripBurst] = useState(false);
  const lastScrollTargetRef = useRef<EventTarget | null>(null);
  const lastScrollPositionRef = useRef(0);
  const lastScrollDirectionRef = useRef<0 | 1 | -1>(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getScrollPosition = (event: Event) => {
      if (event.target instanceof HTMLElement) return event.target.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    };

    const flareOnReversal = () => {
      setGripBurst(true);
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => setGripBurst(false), 950);
    };

    const handleScroll = (event: Event) => {
      const target = event.target || window;
      const currentPosition = getScrollPosition(event);

      if (target !== lastScrollTargetRef.current) {
        lastScrollTargetRef.current = target;
        lastScrollPositionRef.current = currentPosition;
        lastScrollDirectionRef.current = 0;
        return;
      }

      const delta = currentPosition - lastScrollPositionRef.current;
      if (Math.abs(delta) < 3) return;

      const direction: 1 | -1 = delta > 0 ? 1 : -1;
      if (lastScrollDirectionRef.current !== 0 && direction !== lastScrollDirectionRef.current) {
        flareOnReversal();
      }

      lastScrollDirectionRef.current = direction;
      lastScrollPositionRef.current = currentPosition;
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, []);

  const topGripMotion = gripBurst
    ? { y: 6, scale: 1.08, opacity: 1, boxShadow: hasActiveLocks ? '0 0 46px rgba(245,158,11,0.85), 0 0 20px rgba(217,70,239,0.6)' : '0 0 46px rgba(217,70,239,0.72), 0 0 18px rgba(0,242,255,0.42)' }
    : { y: -8, scale: 0.96, opacity: 0.82, boxShadow: hasActiveLocks ? '0 0 24px rgba(245,158,11,0.5)' : '0 0 18px rgba(217,70,239,0.28)' };
  const gripTransition = { type: 'spring' as const, stiffness: gripBurst ? 520 : 280, damping: gripBurst ? 18 : 28 };

  return (
    <>
      {/* =========================================================================
          TOP CENTER GRIP HANDLE (Center Top of Screen right below header)
         ========================================================================= */}
      <AnimatePresence>
        {!previewOpen && handleOpenPreview && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`fixed ${topClassName || 'top-[52px] sm:top-[56px]'} left-1/2 -translate-x-1/2 z-50 flex flex-col items-center select-none pointer-events-auto`}
          >
            <motion.button
              id="edge-grip-preview"
              onClick={handleOpenPreview}
              aria-label={hasActiveLocks ? "Preview (Locked)" : "Preview"}
              data-scroll-state={gripBurst ? 'reversal-flare' : 'idle-retracted'}
              animate={topGripMotion}
              transition={gripTransition}
              whileHover={{ scale: 1.06, y: 2 }}
              whileTap={{ scale: 0.94 }}
              className={`group relative flex items-center justify-center gap-2 px-4 py-1.5 rounded-b-2xl bg-gradient-to-b ${
                hasActiveLocks
                  ? 'from-[#190924] via-[#240c34] to-[#2c0f20] border-x-2 border-b-2 border-amber-400/90 text-amber-200 shadow-[0_0_30px_rgba(245,158,11,0.55)]'
                  : 'from-[#0d041e] via-[#170836] to-[#230d4e] border-x-2 border-b-2 border-fuchsia-400 text-fuchsia-200 shadow-[0_0_30px_rgba(217,70,239,0.5)]'
              } backdrop-blur-xl transition-colors cursor-pointer`}
            >
              {/* Ambient Neon Pulse Glow Bar along Top Edge */}
              <div className={`absolute top-0 left-2 right-2 h-1 rounded-b shadow-[0_0_12px_#ff00de] ${
                hasActiveLocks
                  ? 'bg-gradient-to-r from-amber-400 via-fuchsia-400 to-cyan-400 shadow-[0_0_12px_#f59e0b]'
                  : 'bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400'
              }`} />

              {/* Grip SVG Icon or Lock Icon */}
              <div className="relative flex items-center justify-center">
                {hasActiveLocks ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400 group-hover:text-cyan-300 transition-colors drop-shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse" />
                ) : (
                  <GripHorizontalIcon className="w-4 h-4 text-fuchsia-300 group-hover:text-cyan-300 transition-colors drop-shadow-[0_0_8px_rgba(217,70,239,0.8)]" />
                )}
              </div>

              {/* Horizontal Micro-Label */}
              <span className={`text-[10px] sm:text-[11px] font-cyber font-extrabold tracking-widest uppercase ${
                hasActiveLocks
                  ? 'text-amber-300 group-hover:text-cyan-200'
                  : 'text-fuchsia-200 group-hover:text-cyan-200'
              }`}>
                {hasActiveLocks ? 'PREVIEW (LOCKED)' : 'PREVIEW'}
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
