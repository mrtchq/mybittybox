// src/locks/plugins/puzzleLock.ts
// Lock #23 — Puzzle Lock (client-verified, URL-resident knowledge challenge).
import { LockPlugin, LockContext, LockEvaluation, fail, locked, pass } from '../types';

export interface PuzzleConfig {
  riddle?: string;
  answer?: string;
  caseInsensitive?: boolean;
}

export const puzzleLock: LockPlugin<PuzzleConfig> = {
  id: 'puzzle',
  name: 'Puzzle Lock',
  description: 'Unlocks upon solving a riddle / cipher. Client-verified (answer stored in link).',
  category: 'PROOF',
  tags: ['URL RESIDENT'],
  urlResident: true,
  requiresServer: false,
  icon: 'Puzzle',
  animation: 'dissolve',
  schema: [
    { key: 'riddle', label: 'Riddle / prompt', type: 'text', placeholder: 'e.g. I speak without a mouth…' },
    { key: 'answer', label: 'Answer', type: 'text', required: true, placeholder: 'solution' },
    { key: 'caseInsensitive', label: 'Case insensitive', type: 'toggle', default: true },
  ],
  validate(c) {
    if (!c.answer || !c.answer.trim()) return ['Provide the puzzle answer.'];
    return [];
  },
  getHints() {
    return ['Solve the riddle to find the answer.'];
  },
  evaluate(c, ctx): LockEvaluation {
    const attempt = typeof ctx.input === 'string' ? ctx.input : '';
    if (!attempt) return locked('Solve the puzzle to unlock.');
    const want = c.caseInsensitive ? (c.answer ?? '').toLowerCase().trim() : (c.answer ?? '').trim();
    const got = c.caseInsensitive ? attempt.toLowerCase().trim() : attempt.trim();
    return got === want ? pass() : fail('That is not the answer.');
  },
};
