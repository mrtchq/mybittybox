import React, { useEffect } from 'react';
import { UnlockKeyhole } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import type { UnlockAnimation } from '../locks/ceremony';
import './CeremonyReveal.css';

interface CeremonyRevealProps {
  animation: UnlockAnimation;
  onComplete: () => void;
}

/** A presentation step AFTER authenticated decoding; never an access decision. */
export const CeremonyReveal: React.FC<CeremonyRevealProps> = ({ animation, onComplete }) => {
  const reducedMotion = useReducedMotion();
  const skip = reducedMotion || animation === 'none';
  useEffect(() => {
    if (skip) { onComplete(); return; }
    // Completion doesn't rely on animationend (CSS may be blocked or overridden).
    const timer = window.setTimeout(onComplete, 1100);
    return () => window.clearTimeout(timer);
  }, [skip, onComplete]);
  if (skip) return null;
  return (
    <div className={`ceremony-reveal ceremony-reveal--${animation}`} data-ceremony-reveal={animation}
      role="status" aria-live="polite" aria-label="Seal verified. Opening transmission.">
      <div className="ceremony-reveal__grid" aria-hidden="true" />
      <div className="ceremony-reveal__door ceremony-reveal__door--left" aria-hidden="true" />
      <div className="ceremony-reveal__door ceremony-reveal__door--right" aria-hidden="true" />
      <div className="ceremony-reveal__seal" aria-hidden="true">
        <div className="ceremony-reveal__ring"><UnlockKeyhole size={40} strokeWidth={1.5} /></div>
        {animation === 'shatter' && <><i className="ceremony-shard ceremony-shard--a" /><i className="ceremony-shard ceremony-shard--b" /><i className="ceremony-shard ceremony-shard--c" /><i className="ceremony-shard ceremony-shard--d" /></>}
      </div>
      <div className="ceremony-reveal__caption" aria-hidden="true">
        <span>SEAL VERIFIED</span><strong>TRANSMISSION UNSEALED</strong>
      </div>
    </div>
  );
};
