import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Sparkles, 
  Search, 
  X, 
  Send, 
  Globe, 
  ExternalLink,
  Bot,
  User,
  Radio,
  Zap,
  Check,
  RotateCcw,
  Loader2,
  Info,
  AlertCircle
} from 'lucide-react';
import { useVoiceAI } from '../hooks/useVoiceAI';
import { FriendlyErrorNotice } from './FriendlyErrorNotice';

interface VoiceAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceAIAssistantModal: React.FC<VoiceAIAssistantModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    status,
    isLiveActive,
    audioLevel,
    messages,
    error,
    useGoogleSearch,
    setUseGoogleSearch,
    isSearching,
    isSpeaking,
    autoSpeak,
    setAutoSpeak,
    isVoiceInputActive,
    startLiveSession,
    stopLiveSession,
    startVoiceInput,
    stopVoiceInput,
    sendTextMessage,
    askGroundedQuestion,
    speakText,
    stopSpeech,
    clearMessages,
  } = useVoiceAI();

  const [inputQuery, setInputQuery] = useState('');
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSearching]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim()) return;
    sendTextMessage(inputQuery);
    setInputQuery('');
  };

  const handleTogglePlayMessage = (id: string, text: string) => {
    if (playingMessageId === id && isSpeaking) {
      stopSpeech();
      setPlayingMessageId(null);
    } else {
      stopSpeech();
      setPlayingMessageId(id);
      speakText(text);
    }
  };

  const starterPrompts = [
    { label: 'Latest Web Trends 2025', query: 'Search the web for the latest web development trends, frameworks, and browser APIs in 2025.' },
    { label: 'How to store work in links?', query: 'How does Bitty Box store entire web pages and applications directly inside URL fragments without servers?' },
    { label: 'Top AI Coding Tools Today', query: 'Search Google for the top AI coding assistants and models being used by developers right now.' },
    { label: 'Brainstorm Micro-App Ideas', query: 'Give me 3 creative, high-utility interactive micro-tool ideas that fit in a compressed URL link.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        id="voice-ai-modal"
        className="w-full max-w-2xl bg-[#090515] border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,242,255,0.25)] flex flex-col h-[680px] max-h-[92vh] overflow-hidden text-slate-100 font-sans"
      >
        {/* Header */}
        <div className="p-4 border-b border-cyan-500/20 bg-gradient-to-r from-purple-950/50 via-cyan-950/40 to-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border transition-all ${
              isLiveActive || isVoiceInputActive
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_18px_rgba(0,242,255,0.5)]' 
                : 'bg-purple-950/70 border-purple-500/40 text-purple-300'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
                  Bitty Voice AI
                </h3>

                {/* Use Google Search Data Toggle Button */}
                <button
                  type="button"
                  id="toggle-google-search-data-btn"
                  title="Toggle Google Search data grounding for up-to-date and accurate information"
                  onClick={() => setUseGoogleSearch((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold transition-all cursor-pointer border ${
                    useGoogleSearch
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(0,242,255,0.35)]'
                      : 'bg-zinc-900/60 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Globe className={`w-3 h-3 ${useGoogleSearch ? 'text-cyan-300 animate-spin-slow' : 'text-zinc-500'}`} />
                  <span>Google Search Data</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${useGoogleSearch ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                </button>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-300">
                  gemini-3.8-flash
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {useGoogleSearch 
                  ? 'Real-time conversational AI grounded with Google Search data' 
                  : 'Real-time voice stream with Gemini Live'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="voice-ai-close-btn"
              onClick={() => {
                stopSpeech();
                if (isLiveActive) stopLiveSession();
                if (isVoiceInputActive) stopVoiceInput();
                onClose();
              }}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Google Search Data Sub-bar */}
        <div className="px-4 py-2 bg-[#060312] border-b border-cyan-500/15 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded">
              <Search className="w-2.5 h-2.5 text-cyan-400" />
              {useGoogleSearch ? 'Google Search Grounding: ON' : 'Google Search Grounding: OFF'}
            </span>
            <span className="text-[10px] text-zinc-400 hidden sm:inline">
              {useGoogleSearch 
                ? 'Retrieves fresh citations & accurate web data via googleSearch tool' 
                : 'Direct mode without web grounding'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-read response toggle */}
            <button
              type="button"
              id="toggle-auto-speak-btn"
              onClick={() => setAutoSpeak((prev) => !prev)}
              className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-cyan-200 transition cursor-pointer"
              title="Automatically read aloud AI responses with Voice AI"
            >
              {autoSpeak ? (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span className="font-mono text-[10px]">
                {autoSpeak ? 'Voice: Aloud' : 'Voice: Muted'}
              </span>
            </button>

            {/* Clear messages */}
            <button
              type="button"
              onClick={clearMessages}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition cursor-pointer font-mono"
              title="Reset conversation"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Friendly Error Notice */}
        {error && (
          <div className="p-3 border-b border-amber-500/20 bg-amber-950/20 shrink-0">
            <FriendlyErrorNotice
              error={error}
              context="voice"
              onRetry={startLiveSession}
              onDismiss={() => {}}
            />
          </div>
        )}

        {/* Live Audio Visualizer Stage */}
        <div className="p-4 bg-gradient-to-b from-[#0e0722] to-[#080414] border-b border-cyan-500/20 flex flex-col items-center justify-center shrink-0 relative overflow-hidden">
          {/* Subtle Background Glow Rings */}
          <div 
            className="absolute rounded-full border border-cyan-500/20 transition-transform duration-150 pointer-events-none"
            style={{
              width: 140 + audioLevel * 120,
              height: 140 + audioLevel * 120,
              opacity: isLiveActive || isVoiceInputActive ? 0.35 + audioLevel * 0.7 : 0.08,
            }}
          />
          <div 
            className="absolute rounded-full border border-purple-500/20 transition-transform duration-200 pointer-events-none"
            style={{
              width: 190 + audioLevel * 160,
              height: 190 + audioLevel * 160,
              opacity: isLiveActive || isVoiceInputActive ? 0.25 + audioLevel * 0.5 : 0.04,
            }}
          />

          {/* Center Mic Button */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <button
              type="button"
              id="voice-toggle-btn"
              onClick={() => {
                if (useGoogleSearch) {
                  // In Google Search mode: use voice speech input
                  if (isVoiceInputActive) {
                    stopVoiceInput();
                  } else {
                    startVoiceInput();
                  }
                } else {
                  // In Gemini Live mode: connect WebSocket stream
                  if (isLiveActive) {
                    stopLiveSession();
                  } else {
                    startLiveSession();
                  }
                }
              }}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg group ${
                isLiveActive || isVoiceInputActive
                  ? 'bg-gradient-to-br from-cyan-400 to-teal-400 text-black shadow-[0_0_30px_rgba(0,242,255,0.6)] scale-105'
                  : isSearching
                  ? 'bg-purple-900 border-2 border-purple-400 text-purple-200 animate-pulse'
                  : 'bg-[#150d2e] border-2 border-cyan-500/40 text-cyan-300 hover:border-cyan-300 hover:shadow-[0_0_20px_rgba(0,242,255,0.3)]'
              }`}
            >
              {isSearching ? (
                <Loader2 className="w-7 h-7 animate-spin text-cyan-200" />
              ) : status === 'connecting' ? (
                <div className="w-6 h-6 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
              ) : isLiveActive || isVoiceInputActive ? (
                <Mic className="w-7 h-7 animate-pulse" />
              ) : (
                <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />
              )}
            </button>

            <div className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${
                isSearching ? 'bg-amber-400 animate-ping' :
                isSpeaking || status === 'speaking' ? 'bg-purple-400 animate-ping' :
                isVoiceInputActive || status === 'listening' ? 'bg-cyan-400 animate-pulse' :
                status === 'connecting' ? 'bg-amber-400' :
                'bg-zinc-600'
              }`} />
              <span className="text-xs font-mono text-cyan-200 uppercase tracking-wider">
                {isSearching && 'Searching Google & Generating Answer...'}
                {!isSearching && (isSpeaking || status === 'speaking') && 'Voice AI Speaking...'}
                {!isSearching && (isVoiceInputActive || status === 'listening') && 'Listening to your voice...'}
                {!isSearching && status === 'connecting' && 'Connecting to Gemini...'}
                {!isSearching && status === 'error' && 'Voice Paused'}
                {!isSearching && status === 'idle' && (
                  useGoogleSearch 
                    ? 'Tap Mic to Speak (Google Search Data) or Type Below' 
                    : 'Tap Mic to Start Gemini Live Voice'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Starter Prompts */}
        <div className="px-4 py-2 bg-[#06030e] border-b border-cyan-500/10 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-mono text-zinc-500 uppercase shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Try:
          </span>
          {starterPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sendTextMessage(p.query)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-purple-950/40 hover:bg-cyan-950/60 border border-purple-500/20 hover:border-cyan-500/40 text-cyan-200/90 whitespace-nowrap transition cursor-pointer shrink-0"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] p-3.5 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-cyan-500/20 border border-cyan-400/40 text-white rounded-br-none'
                    : 'bg-[#120a28] border border-purple-500/30 text-slate-200 rounded-bl-none shadow-md'
                }`}
              >
                {/* Assistant Grounding Badge */}
                {m.role === 'assistant' && (m.isGrounded || m.isQuotaLimited) && (
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-purple-500/20 pb-1.5">
                    {m.isQuotaLimited ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span>Quota Limited · Knowledge Fallback</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                        <Globe className="w-3 h-3 text-cyan-400" />
                        <span>Google Search Data</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTogglePlayMessage(m.id, m.text)}
                      className="text-[10px] font-mono text-zinc-400 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
                      title="Read aloud"
                    >
                      {playingMessageId === m.id && isSpeaking ? (
                        <>
                          <VolumeX className="w-3 h-3 text-fuchsia-400 animate-pulse" />
                          <span className="text-fuchsia-300">Stop Voice</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" />
                          <span>Speak</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>

                {/* Google Search Queries Executed */}
                {m.searchQueries && m.searchQueries.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-purple-500/20">
                    <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-1 mb-1">
                      <Search className="w-3 h-3" />
                      <span>Google Search Queries:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {m.searchQueries.map((q, qIdx) => (
                        <span
                          key={qIdx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-purple-500/30 text-purple-200"
                        >
                          &ldquo;{q}&rdquo;
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grounding Sources */}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-purple-500/20">
                    <div className="text-[10px] font-mono text-cyan-300 flex items-center gap-1 mb-1.5">
                      <Globe className="w-3 h-3 text-cyan-400" />
                      <span>Google Search Sources:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {m.sources.map((s, sIdx) => {
                        let hostname = '';
                        try {
                          hostname = new URL(s.uri).hostname.replace(/^www\./, '');
                        } catch {}
                        return (
                          <a
                            key={sIdx}
                            href={s.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-1.5 text-[10px] px-2.5 py-1.5 rounded bg-black/50 border border-cyan-500/30 text-cyan-200 hover:text-white hover:border-cyan-400 hover:bg-cyan-950/40 transition group"
                          >
                            <div className="truncate flex-1">
                              <span className="block truncate font-medium text-slate-200 group-hover:text-cyan-200">{s.title}</span>
                              {hostname && <span className="block text-[9px] text-zinc-500 font-mono">{hostname}</span>}
                            </div>
                            <ExternalLink className="w-3 h-3 shrink-0 text-cyan-400/70 group-hover:text-cyan-300" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                  <span>{m.modelUsed ? m.modelUsed : ''}</span>
                  <span>{m.timestamp}</span>
                </div>
              </div>

              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isSearching && (
            <div className="flex gap-3 justify-start animate-in fade-in">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
              </div>
              <div className="p-3 rounded-xl bg-[#120a28] border border-cyan-500/30 text-cyan-200 text-xs flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                <span>Searching Google &amp; synthesizing answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Text Input Footer */}
        <form 
          onSubmit={handleSendText}
          className="p-3 border-t border-cyan-500/20 bg-[#06030e] flex items-center gap-2 shrink-0"
        >
          {/* Quick Voice Mic Trigger inside input bar */}
          <button
            type="button"
            onClick={() => {
              if (isVoiceInputActive) {
                stopVoiceInput();
              } else {
                startVoiceInput();
              }
            }}
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              isVoiceInputActive
                ? 'bg-cyan-500 text-black border-cyan-400 animate-pulse'
                : 'bg-[#120a28] text-cyan-300 border-cyan-500/30 hover:border-cyan-400 hover:text-white'
            }`}
            title="Speak query with voice"
          >
            <Mic className="w-4 h-4" />
          </button>

          <input
            type="text"
            id="voice-ai-input"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              useGoogleSearch 
                ? "Ask anything with Google Search data (e.g. 'What is new in Vite 6?')..." 
                : "Type your question..."
            }
            className="flex-1 bg-[#0f0923] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(0,242,255,0.2)] transition"
          />

          <button
            type="submit"
            id="voice-ai-send-btn"
            disabled={!inputQuery.trim() || isSearching}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 text-black font-bold text-xs hover:brightness-110 disabled:opacity-40 transition cursor-pointer shrink-0 flex items-center gap-1"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};

