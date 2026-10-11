import { useState, useRef, useCallback, useEffect } from 'react';
import { parseFriendlyError } from '../utils/friendlyError';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: { title: string; uri: string }[];
  searchQueries?: string[];
  isGrounded?: boolean;
  isQuotaLimited?: boolean;
  modelUsed?: string;
}

export interface UseVoiceAIResult {
  status: 'idle' | 'connecting' | 'listening' | 'speaking' | 'searching' | 'error';
  isLiveActive: boolean;
  audioLevel: number;
  messages: ChatMessage[];
  error: any | null;
  useGoogleSearch: boolean;
  setUseGoogleSearch: React.Dispatch<React.SetStateAction<boolean>>;
  isSearching: boolean;
  isSpeaking: boolean;
  autoSpeak: boolean;
  setAutoSpeak: React.Dispatch<React.SetStateAction<boolean>>;
  isVoiceInputActive: boolean;
  startLiveSession: () => Promise<void>;
  stopLiveSession: () => void;
  startVoiceInput: () => void;
  stopVoiceInput: () => void;
  sendTextMessage: (text: string) => Promise<void>;
  askGroundedQuestion: (query: string) => Promise<void>;
  speakText: (text: string) => void;
  stopSpeech: () => void;
  clearMessages: () => void;
}

export function useVoiceAI(): UseVoiceAIResult {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'searching' | 'error'>('idle');
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<any | null>(null);
  const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);
  const [isVoiceInputActive, setIsVoiceInputActive] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-msg',
      role: 'assistant',
      text: 'Hi! I am Bitty Voice, your AI assistant with Google Search Data and real-time voice. Ask me anything about live web trends, storing work in URL links, web development, or creative tools!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isGrounded: true,
    },
  ]);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  // Helper: Convert Float32Array to 16-bit PCM base64
  const floatTo16BitPCMBase64 = (input: Float32Array): string => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Helper: Play next chunk from audio queue
  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setStatus('listening');
      return;
    }

    isPlayingRef.current = true;
    setStatus('speaking');

    const pcmData = audioQueueRef.current.shift()!;
    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
    const ctx = playbackContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const audioBuffer = ctx.createBuffer(1, pcmData.length, 24000);
    audioBuffer.getChannelData(0).set(pcmData);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    currentSourceRef.current = source;

    source.onended = () => {
      playNextInQueue();
    };

    source.start();
  }, []);

  // Stop playback immediately upon interruption
  const stopPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {}
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  // Stop live session cleanly
  const stopLiveSession = useCallback(() => {
    stopPlayback();

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setIsLiveActive(false);
    setStatus('idle');
    setAudioLevel(0);
  }, [stopPlayback]);

  // Start Gemini Live Audio Session
  const startLiveSession = useCallback(async () => {
    try {
      setError(null);
      setStatus('connecting');
      stopLiveSession();

      // Request microphone access
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
      } catch (micErr: any) {
        setStatus('error');
        setError(micErr);
        return;
      }

      // Connect WebSocket to /api/live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsLiveActive(true);
        setStatus('listening');

        // Setup AudioContext for input processing
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000,
        });
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);

          // Calculate visual audio volume
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setAudioLevel(Math.min(1, rms * 5));

          const base64Audio = floatTo16BitPCMBase64(inputData);
          ws.send(JSON.stringify({ audio: base64Audio }));
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'error') {
            setError(data.message || data.error);
            setStatus('error');
            return;
          }

          if (data.type === 'interrupted') {
            stopPlayback();
            setStatus('listening');
            return;
          }

          if (data.type === 'audio' && data.audio) {
            // Decode base64 PCM 24kHz audio from model
            const binary = atob(data.audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const dataView = new DataView(bytes.buffer);
            const floatSamples = new Float32Array(bytes.length / 2);
            for (let i = 0; i < floatSamples.length; i++) {
              const int16 = dataView.getInt16(i * 2, true);
              floatSamples[i] = int16 / 32768;
            }

            audioQueueRef.current.push(floatSamples);
            if (!isPlayingRef.current) {
              playNextInQueue();
            }
          }
        } catch (parseErr) {
          console.error('[Voice AI] Message parse error:', parseErr);
        }
      };

      ws.onerror = (wsErr) => {
        console.error('[Voice AI] WebSocket error:', wsErr);
        setError('Connection to Voice AI paused. Please check that the server is running.');
        setStatus('error');
      };

      ws.onclose = () => {
        setIsLiveActive(false);
        if (status !== 'error') {
          setStatus('idle');
        }
      };
    } catch (err: any) {
      console.error('[Voice AI] Session start failed:', err);
      setError(err);
      setStatus('error');
      stopLiveSession();
    }
  }, [stopLiveSession, playNextInQueue, stopPlayback, status]);

  // Text-to-speech (voice output for Voice AI responses)
  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      // Strip markdown asterisks, backticks, brackets for natural voice synthesis
      const cleanText = text
        .replace(/[*_#`~[\]()]/g, ' ')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => {
        setIsSpeaking(true);
        setStatus('speaking');
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setStatus('idle');
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setStatus('idle');
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[Voice AI] Speech synthesis warning:', e);
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsSpeaking(false);
    if (status === 'speaking') {
      setStatus('idle');
    }
  }, [status]);

  // Search Grounding query using gemini-3.5-flash with googleSearch tool
  const askGroundedQuestion = useCallback(async (query: string) => {
    if (!query.trim()) return;

    stopSpeech();
    setIsSearching(true);
    setStatus('searching');

    const userMsg: ChatMessage = {
      id: `query_${Date.now()}`,
      role: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/voice-assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          model: 'gemini-3.8-flash',
        }),
      });

      const data = await res.json();
      setIsSearching(false);

      if (data.success && data.answer) {
        const assistantMsg: ChatMessage = {
          id: `ans_${Date.now()}`,
          role: 'assistant',
          text: data.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sources: data.sources || [],
          searchQueries: data.searchQueries || [],
          isGrounded: true,
          isQuotaLimited: Boolean(data.isQuotaLimited),
          modelUsed: data.modelUsed || 'gemini-3.8-flash',
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStatus('idle');

        if (autoSpeak) {
          speakText(data.answer);
        }
      } else {
        const fallbackMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: data.answer || data.error || 'I had trouble fetching real-time Google Search data right now.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isQuotaLimited: Boolean(data.isQuotaLimited),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        setStatus('idle');
      }
    } catch (err: any) {
      setIsSearching(false);
      setStatus('idle');
      const fallbackMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        text: 'Google Search Data is temporarily rate-limited. I can still assist you with coding and Bitty Box features.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isQuotaLimited: true,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    }
  }, [autoSpeak, speakText, stopSpeech]);

  // Speech-to-text Voice Recognition for Voice Queries
  const startVoiceInput = useCallback(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setError('Voice recognition is not supported in this browser. Please type your query or use Gemini Live.');
      return;
    }

    try {
      stopSpeech();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsVoiceInputActive(true);
        setStatus('listening');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          askGroundedQuestion(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[Voice AI] Speech recognition notice:', event.error);
        setIsVoiceInputActive(false);
        setStatus('idle');
      };

      recognition.onend = () => {
        setIsVoiceInputActive(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      console.error('[Voice AI] Speech recognition error:', e);
      setIsVoiceInputActive(false);
      setError(e.message || 'Could not start voice recognition');
    }
  }, [askGroundedQuestion, stopSpeech]);

  const stopVoiceInput = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsVoiceInputActive(false);
    setStatus('idle');
  }, []);

  // Text message submission (works with Google Search grounding or Live session)
  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      if (useGoogleSearch || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        // Query Gemini with Google Search Data
        await askGroundedQuestion(text.trim());
      } else {
        // Send to Live WebSocket
        const userMsg: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'user',
          text: text.trim(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, userMsg]);
        wsRef.current.send(JSON.stringify({ text: text.trim() }));
      }
    },
    [useGoogleSearch, askGroundedQuestion]
  );

  const clearMessages = useCallback(() => {
    stopSpeech();
    setMessages([]);
  }, [stopSpeech]);

  useEffect(() => {
    return () => {
      stopLiveSession();
      stopSpeech();
      stopVoiceInput();
    };
  }, [stopLiveSession, stopSpeech, stopVoiceInput]);

  return {
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
  };
}
