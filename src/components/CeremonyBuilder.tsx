// ─────────────────────────────────────────────────────────────────────────────
// src/components/CeremonyBuilder.tsx
//
// Phase 6 — Lock Combiner (creator-side builder surface). REFINED.
//
// Visual lock-combination studio:
//  • Palette of all registered locks (v1 = 8 Tier-1), with tier + effort tags
//  • Drag-to-sequence rails (native DnD) + arrow fallback to reorder leaves
//  • Per-lock schema-driven config, AND/OR combine toggle
//  • LIVE SECURITY RATING — "how hard is this box to crack" (brute-force cost,
//    gate type mix, AND/OR strictness) so creators feel the leverage
//  • Sandbox preview via the REAL LockGate (opens on a valid visitor attempt)
//  • Copy-Payload export + Apply-to-Box (plumbs metadata.ceremony -> buildBittyUrl)
//
// One secret, one place: a credential leaf (passcode XOR passphrase) owns a
// single shared boxPassword that becomes metadata.password. The secret NEVER
// enters the serialized tree.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  KeyRound,
  Quote,
  Hourglass,
  Clock,
  Timer,
  Hand,
  Flame,
  Repeat,
  Plus,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  Zap,
  CheckCircle2,
  Link2,
  Lock,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Copy,
  ShieldCheck,
  ShieldAlert,
  Radiation,
} from 'lucide-react';
import {
  Type,
  CalendarClock,
  Key,
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
} from 'lucide-react';
import {
  type CombinerField,
  type CombinerLeaf,
  type CombinerLogic,
  COMBINER_FIELDS,
  CREDENTIAL_LOCK_IDS,
  buildCeremony,
  defaultLeafConfig,
  hasCredentialLeaf,
} from '../locks/combiner';
import { allLocks, deserializeCeremony } from '../locks/registry';
import { type BoxCeremonyEvaluation } from '../locks/ceremony';
import { useRenderStormGuard } from '../hooks/useRenderStormGuard';
import { LockGate } from './LockGate';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  KeyRound,
  Quote,
  Hourglass,
  Clock,
  Timer,
  Hand,
  Flame,
  Repeat,
};

/** Per-lock editorial metadata for the builder UI (creator-facing, not engine). */
const LOCK_META: Record<
  string,
  { tier: string; effort: 'instant' | 'low' | 'med' | 'high' | 'time'; blurb: string }
> = {
  passcode: { tier: 'T1', effort: 'low', blurb: 'Secret numeric PIN you set (like a phone PIN).' },
  passphrase: { tier: 'T1', effort: 'med', blurb: 'Secret phrase with multiple words.' },
  'time-window': { tier: 'T1', effort: 'time', blurb: 'Page only opens between specific dates and times.' },
  'access-window': { tier: 'T1', effort: 'time', blurb: 'Opens only during certain daily hours (e.g. 9am–5pm).' },
  countdown: { tier: 'T1', effort: 'time', blurb: 'Opens after a live countdown timer finishes.' },
  'tap-to-unseal': { tier: 'T1', effort: 'low', blurb: 'Visitor taps multiple times to break the digital seal.' },
  'burn-after-reading': { tier: 'T1', effort: 'med', blurb: 'Self-destructs and disappears forever after the first view.' },
  'max-opens': { tier: 'T1', effort: 'med', blurb: 'Permanently closes after reaching a maximum view count.' },
};

const EFFORT_LABEL: Record<string, string> = {
  instant: 'OPEN',
  low: 'SECRET',
  med: 'SECRET+',
  high: 'STRONG',
  time: 'TIME-GATED',
};

/**
 * FULL 25-LOCK CATALOG (mirrors locksData.ts) surfaced in the Lock Lab combiner
 * palette. `engineId` is the registry id for live locks (clickable); `soon:true`
 * locks are priced + previewed but not yet wired into the evaluation engine.
 * Credit pricing aligns with App.tsx (passcode 0, time/view 10).
 */
interface CatalogLock {
  id: string;
  num: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  priceCR: number;
  engineId?: string; // present => addable now
  soon?: boolean;
  cat: 'core' | 'identity' | 'context';
  mechanic: string; // Unlock Mechanic (short)
  useCase: string; // Best Use
}

const LOCK_CATALOG: CatalogLock[] = [
  // ── Core (1–10) ──
  { id: 'passcode', num: '01', name: 'Passcode Lock', icon: KeyRound, priceCR: 0, engineId: 'passcode', cat: 'core', mechanic: 'Enter a secret 4–12 digit numeric PIN.', useCase: 'Private notes, digital gifts, family links, quick mobile unlock.' },
  { id: 'passphrase', num: '02', name: 'Passphrase Lock', icon: Type, priceCR: 0, engineId: 'passphrase', cat: 'core', mechanic: 'Enter a secret word or sentence password.', useCase: 'High-security letters, private documents, long-term secrets.' },
  { id: 'time_capsule', num: '03', name: 'Time Capsule Lock', icon: Hourglass, priceCR: 10, engineId: 'time-window', cat: 'core', mechanic: 'Stays locked until a chosen date and time arrives.', useCase: 'Birthday/New Year notes, future letters, scheduled announcements.' },
  { id: 'burn_after_reading', num: '04', name: 'Burn-After-Reading Lock', icon: Flame, priceCR: 10, engineId: 'burn-after-reading', cat: 'core', mechanic: 'Self-destructs and disappears forever after the first view.', useCase: 'Surprises, passwords, one-time codes, confidential notes.' },
  { id: 'max_opens', num: '05', name: 'Max Opens Lock', icon: Repeat, priceCR: 10, engineId: 'max-opens', cat: 'core', mechanic: 'Limits total number of times the page can ever be opened.', useCase: 'Limited invitations, confidential presentations, beta invite links.' },
  { id: 'access_window', num: '06', name: 'Access Window Lock', icon: CalendarClock, priceCR: 10, engineId: 'access-window', cat: 'core', mechanic: 'Opens only between a specific start and end time window.', useCase: 'Live events, flash releases, scheduled meetings.' },
  { id: 'countdown', num: '07', name: 'Countdown Unlock Lock', icon: Timer, priceCR: 10, engineId: 'countdown', cat: 'core', mechanic: 'Visitor must wait for an interactive timer to reach zero.', useCase: 'Dramatic reveals, gift unboxings, suspenseful announcements.' },
  { id: 'tap_unseal', num: '08', name: 'Tap-to-Unseal Lock', icon: Hand, priceCR: 5, engineId: 'tap-to-unseal', cat: 'core', mechanic: 'Visitor taps the screen repeatedly to break the wax seal.', useCase: 'Interactive surprises, opening rituals, intentional consent.' },
  { id: 'chain_key', num: '09', name: 'Chain Key Lock', icon: Link2, priceCR: 15, engineId: 'chain-key', soon: true, cat: 'core', mechanic: 'Unlocks only after solving or opening a previous page.', useCase: 'Treasure hunts, chapter-by-chapter stories, multi-step quests.' },
  { id: 'one_time_magic_key', num: '10', name: 'One-Time Magic Key', icon: Key, priceCR: 15, engineId: 'one-time-magic-key', soon: true, cat: 'core', mechanic: 'One-time secure key sent directly to your recipient.', useCase: 'Personalized delivery with zero login needed.' },
  // ── Identity & Trust (11–18) ──
  { id: 'totp', num: '11', name: 'Authenticator App Lock', icon: Smartphone, priceCR: 10, engineId: 'totp', soon: true, cat: 'identity', mechanic: 'Requires a 6-digit code from an authenticator app.', useCase: 'Backup notes, crypto wallets, master passwords, operations guides.' },
  { id: 'signed_sender', num: '12', name: 'Signed Sender Lock', icon: FileSignature, priceCR: 10, engineId: 'signed-sender', soon: true, cat: 'identity', mechanic: 'Digitally proves the message was created by you.', useCase: 'Official announcements, creator drops, authentic letters.' },
  { id: 'recipient_email', num: '13', name: 'Recipient Email Lock', icon: Mail, priceCR: 15, engineId: 'recipient-email', soon: true, cat: 'identity', mechanic: 'Sends a one-click unlock link to a specific email.', useCase: 'Client deliverables, private proposals, contractor invoices.' },
  { id: 'wallet_signature', num: '14', name: 'Crypto Wallet Lock', icon: Wallet, priceCR: 20, engineId: 'wallet-signature', soon: true, cat: 'identity', mechanic: 'Visitor connects a crypto wallet to prove ownership.', useCase: 'Token-holder rewards, community drops, Web3 perks.' },
  { id: 'invite_code', num: '15', name: 'Invite-Code Lock', icon: Ticket, priceCR: 10, engineId: 'invite-code', cat: 'identity', mechanic: 'Requires visitors to enter a secret invite code.', useCase: 'Private clubs, exclusive communities, gated launches.' },
  { id: 'approval', num: '16', name: 'Approval Lock', icon: BadgeCheck, priceCR: 15, engineId: 'approval', soon: true, cat: 'identity', mechanic: 'You review and approve each visitor individually.', useCase: 'High-trust documents, confidential drafts, VIP previews.' },
  { id: 'two_person', num: '17', name: 'Two-Person Lock', icon: Users, priceCR: 20, engineId: 'two-person', soon: true, cat: 'identity', mechanic: 'Requires two different people to approve and unlock.', useCase: 'Shared team vaults, escrow approvals, co-founder actions.' },
  { id: 'dead_man_switch', num: '18', name: 'Check-In Lock', icon: HeartPulse, priceCR: 20, engineId: 'dead-man-switch', soon: true, cat: 'identity', mechanic: 'Unlocks automatically if you do not check in by a deadline.', useCase: 'Emergency instructions, legacy notes, contingency plans.' },
  // ── Contextual (19–25) ──
  { id: 'location', num: '19', name: 'Location Lock', icon: MapPin, priceCR: 15, engineId: 'location', soon: true, cat: 'context', mechanic: 'Opens only when visitor is physically at a chosen location.', useCase: 'Scavenger hunts, museum tours, in-person event surprises.' },
  { id: 'qr_proximity', num: '20', name: 'QR Proximity Lock', icon: QrCode, priceCR: 10, engineId: 'qr-proximity', cat: 'context', mechanic: 'Requires scanning a physical QR code or printed sticker in person.', useCase: 'Physical merchandise, art installations, conference badges.' },
  { id: 'device_pairing', num: '21', name: 'Device Pairing Lock', icon: Laptop, priceCR: 10, engineId: 'device-pairing', soon: true, cat: 'context', mechanic: 'Locks the link to a single specific device or phone.', useCase: 'Personal journals, private offline notebooks, device-locked vaults.' },
  { id: 'browser_key', num: '22', name: 'Browser Key Lock', icon: Globe, priceCR: 10, engineId: 'browser-key', cat: 'context', mechanic: 'Remembers authorized visitors without asking for passwords.', useCase: 'Convenient private workspace with no passwords to remember.' },
  { id: 'puzzle', num: '23', name: 'Puzzle Lock', icon: Puzzle, priceCR: 5, engineId: 'puzzle', cat: 'context', mechanic: 'Visitor must solve a fun puzzle, riddle, or quiz to open.', useCase: 'Games, Easter eggs, educational quizzes, interactive fun.' },
  { id: 'proof_of_human', num: '24', name: 'Bot Blocker Lock', icon: Fingerprint, priceCR: 5, engineId: 'proof-of-human', cat: 'context', mechanic: 'Stops automated web bots and AI scrapers from opening.', useCase: 'Public links protected from internet bots and scrapers.' },
  { id: 'payment', num: '25', name: 'Payment Lock', icon: CreditCard, priceCR: 25, engineId: 'payment', cat: 'context', mechanic: 'Unlocks instantly after visitor completes payment.', useCase: 'Paid digital content, indie guides, creative downloads.' },
];

/** Sum of credit price for the locks currently in the combination. */
function comboPrice(leaves: { lockId: string }[]): number {
  const ids = new Set(leaves.map((l) => l.lockId));
  return LOCK_CATALOG.filter((c) => c.engineId && ids.has(c.engineId)).reduce((sum, c) => sum + c.priceCR, 0);
}

interface CeremonyBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (ceremony: string | null, opts: { boxPassword: string | null }) => void;
  currentCeremony?: string | null;
  currentPassword?: string;
}

function decodeCeremony(encoded?: string | null): { leaves: CombinerLeaf[]; logic: CombinerLogic } | null {
  if (!encoded) return null;
  try {
    const node = deserializeCeremony(encoded);
    const leaves: CombinerLeaf[] = [];
    if (node.lockId) {
      leaves.push({ lockId: node.lockId, config: { ...(node.config ?? {}) } });
      return { leaves, logic: 'AND' };
    }
    if (node.logic && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child.lockId) leaves.push({ lockId: child.lockId, config: { ...(child.config ?? {}) } });
      }
      return { leaves, logic: node.logic };
    }
  } catch {
    /* corrupt — start fresh */
  }
  return null;
}

/** Live "how hard is this box" readout — the leverage meter. */
function rateSecurity(leaves: CombinerLeaf[], logic: CombinerLogic) {
  if (leaves.length === 0) {
    return { label: 'UNSEALED', tone: 'rose', detail: 'Anyone with the link can open this page. Add a lock to protect it.' };
  }
  const ids = leaves.map((l) => l.lockId);
  const hasCred = ids.some((id) => CREDENTIAL_LOCK_IDS.has(id));
  const hasTime = ids.some((id) => ['time-window', 'access-window', 'countdown'].includes(id));
  const hasGesture = ids.includes('tap-to-unseal');
  const hasConsume = ids.some((id) => ['burn-after-reading', 'max-opens'].includes(id));

  let score = 10;
  if (hasCred) score += 40;
  if (hasTime) score += 22;
  if (hasGesture) score += 14;
  if (hasConsume) score += 16;
  score += Math.min(leaves.length, 6) * 3;
  if (logic === 'AND') score += 12;

  let label = 'MAXIMUM';
  let tone = 'emerald';
  if (score < 30) {
    label = 'BASIC';
    tone = 'rose';
  } else if (score < 55) {
    label = 'STANDARD';
    tone = 'amber';
  } else if (score < 80) {
    label = 'STRONG';
    tone = 'cyan';
  }

  const parts: string[] = [];
  if (hasCred) parts.push('secret PIN/password');
  if (hasTime) parts.push('time limit');
  if (hasGesture) parts.push('tap seal');
  if (hasConsume) parts.push('view limit');
  const detail = `${leaves.length} lock${leaves.length > 1 ? 's' : ''} · ${logic === 'AND' ? 'All required' : 'Any one unlocks'} · ${parts.join(' + ') || 'open'}`;
  return { label, tone, detail };
}

export const CeremonyBuilder: React.FC<CeremonyBuilderProps> = ({
  isOpen,
  onClose,
  onApply,
  currentCeremony,
  currentPassword,
}) => {
  // Render-storm watchdog: if the combinator ever loops on open/interaction,
  // trip and recover via the LockLabErrorBoundary instead of freezing the tab.
  useRenderStormGuard('Lock Lab');

  const [leaves, setLeaves] = useState<CombinerLeaf[]>(() => decodeCeremony(currentCeremony)?.leaves ?? []);
  const [logic, setLogic] = useState<CombinerLogic>(() => decodeCeremony(currentCeremony)?.logic ?? 'AND');
  const [boxPassword, setBoxPassword] = useState<string>(currentPassword && currentPassword.length > 0 ? currentPassword : '');
  const [showSecret, setShowSecret] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [sandboxPassed, setSandboxPassed] = useState<BoxCeremonyEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Reset internal state whenever the modal is (re)opened.
  React.useEffect(() => {
    if (isOpen) {
      const decoded = decodeCeremony(currentCeremony);
      setLeaves(decoded?.leaves ?? []);
      setLogic(decoded?.logic ?? 'AND');
      setBoxPassword(currentPassword && currentPassword.length > 0 ? currentPassword : '');
      setSandboxOpen(false);
      setSandboxPassed(null);
      setError(null);
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const addedIds = useMemo(() => new Set(leaves.map((l) => l.lockId)), [leaves]);
  const credentialAdded = useMemo(() => leaves.some((l) => CREDENTIAL_LOCK_IDS.has(l.lockId)), [leaves]);
  const ceremonyString = useMemo(() => buildCeremony(leaves, logic), [leaves, logic]);
  const needsPassword = hasCredentialLeaf(leaves);
  const rating = useMemo(() => rateSecurity(leaves, logic), [leaves, logic]);

  const addLeaf = (lockId: string) => {
    if (addedIds.has(lockId)) return;
    if (CREDENTIAL_LOCK_IDS.has(lockId) && credentialAdded) {
      setError('Only one credential lock (Passcode OR Passphrase) per box. Remove the other first.');
      return;
    }
    setError(null);
    setLeaves((prev) => [...prev, { lockId, config: defaultLeafConfig(lockId) }]);
  };

  const removeLeaf = (lockId: string) => {
    setLeaves((prev) => prev.filter((l) => l.lockId !== lockId));
  };

  const setField = (lockId: string, key: string, value: unknown) => {
    setLeaves((prev) => prev.map((l) => (l.lockId === lockId ? { ...l, config: { ...l.config, [key]: value } } : l)));
  };

  const moveLeaf = (index: number, dir: -1 | 1) => {
    setLeaves((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const handleApply = () => {
    if (needsPassword && boxPassword.trim().length < 8) {
      setError('A credential lock needs a Box Password of at least 8 characters to encrypt the box.');
      return;
    }
    onApply(ceremonyString, { boxPassword: needsPassword ? boxPassword : null });
    onClose();
  };

  const handleSandboxUnlocked = async (res: BoxCeremonyEvaluation) => {
    setSandboxPassed(res);
  };

  const handleCopyPayload = () => {
    if (!ceremonyString) return;
    navigator.clipboard?.writeText(ceremonyString).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => {},
    );
  };

  if (!isOpen) return null;

  const toneClasses: Record<string, string> = {
    rose: 'from-rose-600/30 to-rose-900/20 border-rose-500/50 text-rose-200',
    amber: 'from-amber-600/30 to-amber-900/20 border-amber-500/50 text-amber-200',
    cyan: 'from-cyan-600/30 to-cyan-900/20 border-cyan-500/50 text-cyan-200',
    emerald: 'from-emerald-600/30 to-emerald-900/20 border-emerald-500/50 text-emerald-200',
  };
  const ToneIcon = rating.tone === 'emerald' ? ShieldCheck : rating.tone === 'cyan' ? Shield : rating.tone === 'amber' ? ShieldAlert : Radiation;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-3xl max-h-[94vh] overflow-y-auto cyber-scrollbar bento-card-purple p-6 rounded-2xl border border-cyan-500/40 shadow-[0_0_50px_rgba(0,221,255,0.35)] z-10"
          >
            <div className="bento-corner-accent top-l" />
            <div className="bento-corner-accent top-r" />
            <div className="bento-corner-accent bot-l" />
            <div className="bento-corner-accent bot-r" />

            <motion.button
              whileHover={{ scale: 1.15, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-purple-800/40 transition cursor-pointer z-20"
            >
              <X className="w-5 h-5" />
            </motion.button>

            <div className="text-center mb-4 pr-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1, stiffness: 400, damping: 20 }}
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-400/50 mb-3 shadow-[0_0_20px_rgba(0,221,255,0.4)]"
              >
                <Link2 className="w-6 h-6 text-cyan-300" />
              </motion.div>
              <h3 className="font-cyber text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400">
                LOCK LAB — COMBO BUILDER
              </h3>
              <p className="text-xs text-cyan-200/70 font-mono mt-1">
                Combine locks together. AND = all locks required · OR = any single lock opens page.
              </p>
            </div>

            {/* Security rating meter */}
            <div
              className={`mb-4 p-3 rounded-xl bg-gradient-to-r ${toneClasses[rating.tone]} border flex items-center gap-3`}
            >
              <ToneIcon className="w-7 h-7 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-cyber font-bold uppercase tracking-widest opacity-80">Protection level</span>
                  <span className="text-sm font-cyber font-bold">{rating.label}</span>
                </div>
                <p className="text-[10px] font-mono opacity-80 mt-0.5">{rating.detail}</p>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2 overflow-hidden"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Palette — full 25-lock catalog grouped by spec category,
                distinct icons, hover tooltip (mechanic + best use) */}
            <div className="mb-4">
              <h4 className="text-[11px] font-cyber font-bold text-cyan-300 uppercase tracking-widest mb-2">
                Choose Locks · 25 Types
              </h4>
              {(['core', 'identity', 'context'] as const).map((cat) => (
                <div key={cat} className="mb-3">
                  <h5 className="text-[10px] font-cyber uppercase tracking-widest text-purple-300/70 mb-2">
                    {cat === 'core'
                      ? 'Essential Locks · 01–10'
                      : cat === 'identity'
                        ? 'Identity & Verification Locks · 11–18'
                        : 'Location & Interaction Locks · 19–25'}
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {LOCK_CATALOG.filter((l) => l.cat === cat).map((lock) => {
                      const engineId = lock.engineId;
                      const added = engineId ? addedIds.has(engineId) : false;
                      const isCredential = engineId ? CREDENTIAL_LOCK_IDS.has(engineId) : false;
                      const blockedCredential = isCredential && credentialAdded && !added;
                      const disabled = !engineId || added || blockedCredential;
                      const Icon = lock.icon;
                      const priceLabel = lock.priceCR === 0 ? 'FREE' : `${lock.priceCR} CR`;
                      const tip = lock.soon
                        ? `${lock.name} — ${priceLabel} · engine not wired yet`
                        : blockedCredential
                          ? 'Remove the other credential lock first'
                          : `${lock.name} — ${priceLabel}`;
                      return (
                        <div key={lock.id} className="relative group">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => engineId && addLeaf(engineId)}
                            title={tip}
                            aria-label={tip}
                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition cursor-pointer w-full ${
                              added
                                ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                                : lock.soon
                                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200 hover:bg-amber-900/40 hover:border-amber-400'
                                  : 'bg-fuchsia-950/30 border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-900/40 hover:border-fuchsia-400'
                            }`}
                          >
                            {added ? <CheckCircle2 className="w-5 h-5 text-cyan-300" /> : <Icon className="w-5 h-5" />}
                            <span className="text-[10px] font-bold leading-tight">{lock.name}</span>
                            <span className="text-[8px] uppercase font-mono opacity-80">
                              {lock.num} · {priceLabel}
                            </span>
                            {lock.soon && (
                              <span className="text-[7px] uppercase font-mono tracking-wider text-amber-400/80">SOON</span>
                            )}
                          </button>
                          <span
                            role="tooltip"
                            className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[60] w-56 p-2 rounded-lg bg-[#0a0420]/95 border border-cyan-500/40 shadow-[0_0_20px_rgba(0,221,255,0.25)] opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                          >
                            <span className="block text-[10px] font-cyber font-bold text-cyan-200">{lock.name}</span>
                            <span className="block text-[9px] text-purple-200/80 mt-1">
                              <span className="text-cyan-400">⚙</span> {lock.mechanic}
                            </span>
                            <span className="block text-[9px] text-fuchsia-200/80 mt-1">
                              <span className="text-fuchsia-400">★</span> {lock.useCase}
                            </span>
                            {lock.soon && (
                              <span className="block text-[8px] uppercase font-mono tracking-wider text-amber-300 mt-1">
                                SOON · engine not wired
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Live combo cost + coverage */}
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-[#0a0420]/60 px-3 py-2">
              <div className="text-[10px] font-mono text-cyan-300/80 uppercase tracking-wider">
                Total Lock Cost
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-fuchsia-300">
                  {comboPrice(leaves)} Credits
                </span>
                <span className="text-[9px] font-mono text-purple-300/60">
                  {leaves.length}/25 locks · Free options included
                </span>
              </div>
            </div>

            {/* AND/OR toggle */}
            {leaves.length >= 2 && (
              <div className="mb-4 flex items-center justify-center gap-3">
                <span className="text-[11px] font-cyber text-cyan-300 uppercase">Unlock Rule:</span>
                <div className="inline-flex rounded-xl border border-cyan-500/40 overflow-hidden">
                  {(['AND', 'OR'] as CombinerLogic[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setLogic(opt)}
                      className={`px-5 py-2 text-xs font-cyber font-bold transition cursor-pointer ${
                        logic === opt
                          ? 'bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-white'
                          : 'bg-[#0a0420] text-cyan-300/70 hover:text-cyan-200'
                      }`}
                    >
                      {opt === 'AND' ? 'ALL REQUIRED (AND)' : 'ANY ONE (OR)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sequenced leaves */}
            <div className="space-y-2 mb-4">
              {leaves.length === 0 && (
                <div className="text-center text-[11px] text-purple-300/60 font-mono py-6 border border-dashed border-purple-500/30 rounded-xl">
                  No locks added yet. Pick one or more locks above to protect this page.
                </div>
              )}
              {leaves.map((leaf, index) => {
                const plugin = allLocks().find((l) => l.id === leaf.lockId);
                const fields = COMBINER_FIELDS[leaf.lockId] ?? [];
                const Icon = ICONS[plugin?.icon ?? ''] ?? Lock;
                const meta = LOCK_META[leaf.lockId];
                return (
                  <motion.div
                    key={leaf.lockId}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex === null || dragIndex === index) return;
                      setLeaves((prev) => {
                        const next = [...prev];
                        const [moved] = next.splice(dragIndex, 1);
                        next.splice(index, 0, moved);
                        return next;
                      });
                      setDragIndex(null);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    className="p-3 rounded-xl bg-[#0a0420]/80 border border-fuchsia-500/30 space-y-3 cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="w-4 h-4 text-fuchsia-400/50 flex-shrink-0" />
                        <span className="text-[9px] font-mono text-cyan-400/70 w-5 text-right">{index + 1}.</span>
                        <Icon className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />
                        <span className="text-fuchsia-300 text-xs font-bold uppercase tracking-wider truncate">
                          {plugin?.name ?? leaf.lockId}
                        </span>
                        {meta && (
                          <span className="text-[8px] uppercase font-mono text-cyan-300/60 hidden sm:inline">
                            {meta.tier}·{EFFORT_LABEL[meta.effort]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveLeaf(index, -1)}
                          disabled={index === 0}
                          className="p-1 rounded text-cyan-300/70 hover:text-cyan-200 disabled:opacity-30 transition cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveLeaf(index, 1)}
                          disabled={index === leaves.length - 1}
                          className="p-1 rounded text-cyan-300/70 hover:text-cyan-200 disabled:opacity-30 transition cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLeaf(leaf.lockId)}
                          className="p-1.5 rounded-lg text-rose-400/70 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                          title="Remove lock"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {meta && <p className="text-[10px] text-purple-300/60 -mt-1">{meta.blurb}</p>}

                    {fields.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {fields.map((f: CombinerField) => (
                          <div key={f.key} className="flex">
                            <label className="block text-[10px] font-bold text-cyan-300 mb-1">
                              {f.label}
                              {f.help && <span className="text-cyan-400/50 font-normal"> — {f.help}</span>}
                            </label>
                            {f.type === 'toggle' ? (
                              <button
                                type="button"
                                onClick={() => setField(leaf.lockId, f.key, !(leaf.config[f.key] as boolean))}
                                className={`w-auto inline-flex items-center justify-center px-3 py-1 rounded-lg border text-[10px] font-bold tracking-wider uppercase transition cursor-pointer ${
                                  leaf.config[f.key]
                                    ? 'bg-emerald-950/60 border-emerald-400/50 text-emerald-200'
                                    : 'bg-[#060312] border-fuchsia-500/30 text-fuchsia-300/70'
                                }`}
                              >
                                {leaf.config[f.key] ? 'ON' : 'OFF'}
                              </button>
                            ) : f.type === 'select' ? (
                              <select
                                value={String(leaf.config[f.key] ?? '')}
                                onChange={(e) => setField(leaf.lockId, f.key, e.target.value)}
                                className="w-full bg-[#060312] border border-fuchsia-500/30 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-fuchsia-400"
                              >
                                {f.options?.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={f.type === 'number' ? 'number' : f.type === 'datetime-local' ? 'datetime-local' : 'text'}
                                value={String(leaf.config[f.key] ?? '')}
                                min={f.min}
                                max={f.max}
                                step={f.step}
                                placeholder={f.placeholder}
                                onChange={(e) =>
                                  setField(
                                    leaf.lockId,
                                    f.key,
                                    f.type === 'number'
                                      ? e.target.value === ''
                                        ? ''
                                        : Number(e.target.value)
                                      : e.target.value,
                                  )
                                }
                                className="w-full bg-[#060312] border border-fuchsia-500/30 rounded-lg px-3 py-2 text-xs text-white placeholder:text-purple-400/40 outline-none focus:border-fuchsia-400"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Credential secret */}
            {needsPassword && (
              <div className="mb-4 p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/40">
                <label className="block text-[10px] font-bold text-cyan-300 mb-1 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> SECRET PASSWORD (used to lock and unlock your page)
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={boxPassword}
                    onChange={(e) => setBoxPassword(e.target.value)}
                    placeholder="At least 8 characters — protects your page"
                    className="w-full bg-[#060312] border border-cyan-500/40 rounded-lg px-3 py-2 pr-10 text-xs text-white placeholder:text-cyan-400/40 outline-none focus:border-cyan-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-200 transition cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-cyan-300/60 mt-1">
                  Your password locks your page directly. Keep this password safe to share with your visitors.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 0 25px rgba(0,221,255,0.4)' }}
                whileTap={{ scale: 0.97 }}
                type="button"
                disabled={leaves.length === 0 || !ceremonyString}
                onClick={() => {
                  setSandboxPassed(null);
                  setSandboxOpen(true);
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-600/30 to-teal-600/30 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-600/40 text-xs font-cyber flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40"
              >
                <Eye className="w-4 h-4" /> TEST UNLOCK (PREVIEW)
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 0 25px rgba(255,0,222,0.4)' }}
                whileTap={{ scale: 0.97 }}
                type="button"
                disabled={leaves.length === 0 || (needsPassword && boxPassword.trim().length < 8)}
                onClick={handleApply}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-600 text-white text-xs font-cyber flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-4 h-4" /> APPLY TO PAGE
              </motion.button>
            </div>

            {ceremonyString && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[10px] font-mono text-cyan-300/60">
                  LOCK RECIPE: {ceremonyString.length} chars · {leaves.length} lock
                  {leaves.length > 1 ? 's' : ''} · {logic === 'AND' ? 'All required' : 'Any one unlocks'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-fuchsia-950/60 border border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-900 text-[10px] font-bold transition cursor-pointer"
                >
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'COPIED' : 'COPY RECIPE'}
                </button>
              </div>
            )}
          </motion.div>

          {/* Sandbox overlay */}
          {sandboxOpen &&
            (sandboxPassed ? (
              <SandboxSuccess
                result={sandboxPassed}
                onBack={() => {
                  setSandboxPassed(null);
                  setSandboxOpen(false);
                }}
              />
            ) : (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <button
                  type="button"
                  onClick={() => setSandboxOpen(false)}
                  aria-label="Exit test preview"
                  className="absolute top-4 right-4 z-[70] flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#0b0726]/90 border border-cyan-400/50 text-cyan-200 hover:text-white hover:bg-cyan-950/80 shadow-[0_0_18px_rgba(0,242,255,0.35)] transition cursor-pointer text-[11px] font-cyber font-bold tracking-widest uppercase"
                >
                  <X className="w-4 h-4" /> EXIT PREVIEW
                </button>
                <LockGate ceremony={ceremonyString as string} title="TEST PREVIEW" onUnlocked={handleSandboxUnlocked} />
              </div>
            ))}
        </div>
      )}
    </AnimatePresence>
  );
};

const SandboxSuccess: React.FC<{ result: BoxCeremonyEvaluation; onBack: () => void }> = ({ result, onBack }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md" />
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full max-w-md bento-card-purple p-8 rounded-2xl border border-emerald-500/50 shadow-[0_0_50px_rgba(0,255,150,0.35)] z-10 text-center"
    >
      <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-400 mb-4 animate-pulse" />
      <h3 className="font-cyber text-xl font-bold text-emerald-300 mb-2">UNLOCK TEST SUCCESSFUL</h3>
      <p className="text-xs text-cyan-200/80 font-mono mb-1">
        {result.passed ? 'All unlock requirements were met!' : 'The unlock conditions passed successfully.'}
      </p>
      <p className="text-[10px] text-purple-300/60 mb-6">
        Test complete! This preview confirms your lock setup works properly. Click below to return and apply it to your page.
      </p>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={onBack}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600/30 to-fuchsia-600/30 border border-cyan-400/50 text-cyan-200 text-xs font-cyber cursor-pointer"
      >
        BACK TO LOCK LAB
      </motion.button>
    </motion.div>
  </div>
);
