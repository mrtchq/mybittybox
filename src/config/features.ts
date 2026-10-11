/**
 * Feature flags for the Bitty Box app.
 *
 * voiceAI — the Gemini Live voice assistant is PARKED (2026-10-11).
 *
 * Why: the production backend exposes no `/api/live` WebSocket. Its live-voice
 * stack is OpenAI Realtime via `/api/voice-token`, so `useVoiceAI` can never
 * connect and the assistant would ship broken. Rather than publish a dead
 * feature, all four entry points (desktop nav tab, mobile nav tab, floating
 * button, modal) are gated behind this flag.
 *
 * Flip to `true` to restore every entry point once a live-voice transport
 * exists. Nothing else needs to change.
 */
export const FEATURES: { voiceAI: boolean } = {
  voiceAI: false,
};
