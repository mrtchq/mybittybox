// ─────────────────────────────────────────────────────────────────────────────
// src/components/LockGate.tsx
//
// Phase 1.5 — Visitor unlock screen for a Bitty Box ceremony.
//
// Renders one card per ceremony leaf (from ceremonyLeaves). Visitor enters
// inputs (passcode, passphrase, email, etc.) or performs a gesture
// (tap-to-unseal). On "Unseal" it calls evaluateBoxCeremony and reports the
// result upward so BittyRenderer can decrypt cipher= (via candidate) and play
// the unlock animation.
//
// This is the LIVE surface of the Lock Lab engine — no legacy lockConfig path.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import {
  KeyRound,
  Quote,
  Hourglass,
  Timer,
  Clock,
  Repeat,
  Flame,
  Hand,
  Shield,
  Eye,
  EyeOff,
  Lock,
  Zap,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  FileSignature,
  Mail,
  Wallet,
  Ticket,
  BadgeCheck,
  Users,
  HeartPulse,
  MapPin,
  QrCode,
  Laptop,
  Globe,
  Puzzle,
  Fingerprint,
  CreditCard,
  Link2,
  Key,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CyberScrambleText } from './CyberScrambleText';
import {
  type BoxCeremonyEvaluation,
  type CeremonyLeaf,
  ceremonyHints,
  ceremonyLeaves,
  evaluateBoxCeremony,
} from '../locks/ceremony';
import type { LockContext } from '../locks/types';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  KeyRound,
  Quote,
  Hourglass,
  Timer,
  Clock,
  Repeat,
  Flame,
  Hand,
  Smartphone,
  FileSignature,
  Mail,
  Wallet,
  Ticket,
  BadgeCheck,
  Users,
  HeartPulse,
  MapPin,
  QrCode,
  Laptop,
  Globe,
  Puzzle,
  Fingerprint,
  CreditCard,
  Link2,
  Key,
};

interface LockGateProps {
  ceremony: string;
  title?: string;
  onUnlocked: (result: BoxCeremonyEvaluation) => Promise<void>;
}

export const LockGate: React.FC<LockGateProps> = ({ ceremony, title, onUnlocked }) => {
  const leaves: CeremonyLeaf[] = useMemo(() => ceremonyLeaves(ceremony), [ceremony]);

  // Per-leaf visitor state.
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [tapCounts, setTapCounts] = useState<Record<string, number[]>>({});
  const [showHints, setShowHints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  if (leaves.length === 0) {
    return <div className="fixed inset-0 z-50 bg-[#050515] text-rose-200 grid place-items-center p-6">
      <div role="alert" className="max-w-md text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto" />
        <h2 className="font-bold">INVALID CEREMONY</h2>
        <p>This lock configuration is damaged or unsupported. The box remains sealed. Ask the creator for a new link.</p>
        <a href="/" className="underline inline-block p-3">Return to Bitty Box</a>
      </div>
    </div>;
  }

  const setInput = (lockId: string, val: string) =>
    setInputs((p) => ({ ...p, [lockId]: val }));

  const handleTap = (leaf: CeremonyLeaf) => {
    setTapCounts((p) => ({ ...p, [leaf.lockId]: [...(p[leaf.lockId] ?? []), Date.now()] }));
  };

  const buildAttempts = (): Record<string, LockContext> => {
    const out: Record<string, LockContext> = {};
    for (const leaf of leaves) {
      if (leaf.lockId === 'tap-to-unseal') {
        out[leaf.lockId] = { input: tapCounts[leaf.lockId] ?? [] };
      } else {
        const v = inputs[leaf.lockId] ?? '';
        out[leaf.lockId] = { input: v };
      }
    }
    return out;
  };

  const handleUnseal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnlocking(true);
    try {
      const attempts = buildAttempts();
      const res = await evaluateBoxCeremony(ceremony, attempts);
      if (res.passed) {
        await onUnlocked(res);
        return;
      }
      // Surface the most useful failing hint.
      const hint = res.failingHints.find((h) => h && h.length);
      setError(hint ?? 'This box stays sealed — your attempt did not satisfy every lock.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to evaluate the ceremony. Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  // A leaf is "satisfied" if it has input or enough taps — used for the
  // per-card checkmark glow (optimistic; final verdict is server-less here).
  const leafReady = (leaf: CeremonyLeaf): boolean => {
    if (leaf.lockId === 'tap-to-unseal') return (tapCounts[leaf.lockId]?.length ?? 0) > 0;
    return (inputs[leaf.lockId] ?? '').trim().length > 0;
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#050515] flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full max-w-lg p-5 sm:p-7 bg-[#090620]/90 border border-cyan-500/40 rounded-2xl shadow-[0_0_60px_rgba(0,242,255,0.25),inset_0_0_30px_rgba(0,242,255,0.06)] backdrop-blur-2xl relative"
      >
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

        <div className="text-center mb-5">
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-xs mb-3 shadow-[0_0_15px_rgba(0,242,255,0.3)]"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>PROTECTED BITTY BOX</span>
          </motion.div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-teal-100 to-fuchsia-300 tracking-wide">
            <CyberScrambleText text={title || 'LOCKED TRANSMISSION'} speed={20} />
          </h2>
          <p className="text-xs text-cyan-300/70 mt-1">
            This box is sealed by {leaves.length} programmable lock{leaves.length > 1 ? 's' : ''}.
          </p>
        </div>

        <form onSubmit={handleUnseal} className="space-y-4">
          <AnimatePresence>
            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 overflow-hidden"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {leaves.map((leaf) => {
            const Icon = ICONS[leaf.icon] ?? Lock;
            const ready = leafReady(leaf);
            const taps = tapCounts[leaf.lockId]?.length ?? 0;
            const field = leaf.inputFields[0];
            return (
              <motion.div
                key={leaf.lockId}
                whileHover={{ scale: 1.01 }}
                className={`p-3.5 sm:p-4 rounded-xl border flex flex-col gap-2 shadow-[0_0_20px_rgba(217,70,239,0.12)] ${
                  ready ? 'bg-cyan-950/50 border-cyan-500/50' : 'bg-fuchsia-950/40 border-fuchsia-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-fuchsia-300 text-xs font-bold uppercase tracking-wider">
                    <Icon className="w-4 h-4 text-fuchsia-400" />
                    <span>{leaf.name}</span>
                  </div>
                  {ready && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>

                {leaf.description && (
                  <p className="text-[10px] text-purple-200/70 leading-snug">{leaf.description}</p>
                )}

                {leaf.lockId === 'tap-to-unseal' ? (
                  <button
                    type="button"
                    onClick={() => handleTap(leaf)}
                    className="w-full py-3 rounded-xl bg-fuchsia-950/60 border border-fuchsia-500/50 text-fuchsia-200 font-cyber text-xs tracking-widest hover:bg-fuchsia-900/60 transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Hand className="w-4 h-4" />
                    {taps > 0 ? `TAP AGAIN (${taps})` : 'TAP TO UNSEAL'}
                  </button>
                ) : field ? (
                  <div className="relative">
                    <input
                      type={field.type === 'password' && !showSecret[leaf.lockId] ? 'password' : 'text'}
                      value={inputs[leaf.lockId] ?? ''}
                      onChange={(e) => {
                        setInput(leaf.lockId, e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder={field.placeholder ?? `Enter ${leaf.name.toLowerCase()}...`}
                      autoFocus={leaves.length === 1}
                      className="w-full bg-[#090314] border border-fuchsia-500/40 rounded-xl px-4 py-3 text-center text-white placeholder:text-purple-400/40 focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400"
                    />
                    {field.type === 'password' && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecret((p) => ({ ...p, [leaf.lockId]: !p[leaf.lockId] }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-fuchsia-300 transition cursor-pointer"
                        title={showSecret[leaf.lockId] ? 'Hide' : 'Show'}
                      >
                        {showSecret[leaf.lockId] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                ) : null}
              </motion.div>
            );
          })}

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowHints((s) => !s)}
              className="text-[10px] text-cyan-300/70 hover:text-cyan-200 underline underline-offset-2 transition cursor-pointer"
            >
              {showHints ? 'HIDE HINTS' : 'SHOW HINTS'}
            </button>
            <AnimatePresence>
              {showHints && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 space-y-1 text-[10px] font-mono text-cyan-300/70"
                >
                  {ceremonyHints(ceremony).map((h, i) => (
                    <div key={i} className="bg-black/40 border border-cyan-500/20 rounded px-2 py-1">
                      {h}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(255,0,222,0.6)' }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={unlocking}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-600 disabled:opacity-50 text-white font-cyber text-xs tracking-widest shadow-[0_0_25px_rgba(255,0,222,0.4)] transition cursor-pointer flex items-center justify-center gap-2"
          >
            {unlocking ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>VERIFYING CEREMONY...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>UNSEAL TRANSMISSION</span>
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};
