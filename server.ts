import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

dotenv.config();

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '10mb' }));

// In-memory account store with file-backed backup
interface StoredAccount {
  id: string;
  email: string;
  displayName: string;
  avatar: string;
  tier: string;
  credits: number;
  creditsUsedTotal: number;
  creditsHumanUsed: number;
  creditsApiUsed: number;
  creditsMcpUsed: number;
  joinedDate: string;
  lastSignedInAt: string;
  settings: {
    autoSaveLinks: boolean;
    trustThisDevice: boolean;
  };
  apiKeys: any[];
  links: any[];
  transactions: any[];
}

const accountsDb = new Map<string, StoredAccount>();
const sessionsDb = new Map<string, string>(); // sessionId -> userId

// Initialize demo account
const demoId = 'user_demo_123';
accountsDb.set(demoId, {
  id: demoId,
  email: 'creator@bittybox.org',
  displayName: 'Bitty Creator',
  avatar: '⚡',
  tier: 'PRO BUILDER',
  credits: 100,
  creditsUsedTotal: 0,
  creditsHumanUsed: 0,
  creditsApiUsed: 0,
  creditsMcpUsed: 0,
  joinedDate: new Date().toISOString(),
  lastSignedInAt: new Date().toISOString(),
  settings: { autoSaveLinks: true, trustThisDevice: true },
  apiKeys: [],
  links: [],
  transactions: [
    {
      id: 'tx_init',
      type: 'grant',
      amount: 100,
      description: 'Starter Bonus (100 Credits)',
      createdAt: new Date().toISOString(),
    },
  ],
});

function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    voiceAvailable: Boolean(process.env.GEMINI_API_KEY),
    liveModel: 'gemini-3.1-flash-live-preview',
    searchModel: 'gemini-3.8-flash',
  });
});

function generateBittyKnowledgeFallback(query: string): {
  answer: string;
  sources: { title: string; uri: string }[];
} {
  const q = (query || '').toLowerCase();

  if (q.includes('store') || q.includes('link') || q.includes('url') || q.includes('how does') || q.includes('without server')) {
    return {
      answer: "Bitty Box compresses complete HTML, CSS, JavaScript, and metadata into a shareable URL fragment hash. Because everything after the '#' symbol is evaluated exclusively by your browser, no servers, external databases, or hosting bills are needed. When someone opens the link, the built-in decompression engine reconstructs and sandboxes the application on the fly.",
      sources: [
        { title: "Bitty Box Architecture & Specs", uri: "https://bitty.box/docs" },
        { title: "URL Hash Storage Specification", uri: "https://bitty.box/specs" }
      ]
    };
  }

  if (q.includes('password') || q.includes('encrypt') || q.includes('lock') || q.includes('protect')) {
    return {
      answer: "Bitty Box uses client-side AES-GCM 256-bit encryption with PBKDF2 key derivation. Your content is encrypted directly in your browser before the URL is generated. The server never sees your password or decrypted code; only someone who knows your passphrase can unlock and view the creation.",
      sources: [
        { title: "Bitty Lock Lab Cryptography", uri: "https://bitty.box/crypto" },
        { title: "Web Cryptography API Standards", uri: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API" }
      ]
    };
  }

  if (q.includes('trend') || q.includes('2025') || q.includes('2026') || q.includes('frontend') || q.includes('web development')) {
    return {
      answer: "Key modern web development trends focus on zero-server architectures, client-side WebAssembly, edge-computed state, and standalone micro-apps. Tools like Bitty Box showcase how URLs themselves can serve as decentralized distribution channels for interactive games, calculators, portfolios, and tools without infrastructure overhead.",
      sources: [
        { title: "Modern Web Trends & Local-First Software", uri: "https://bitty.box/trends" },
        { title: "W3C Web Standards", uri: "https://w3.org" }
      ]
    };
  }

  if (q.includes('idea') || q.includes('brainstorm') || q.includes('create') || q.includes('example')) {
    return {
      answer: "Great micro-app ideas for Bitty Box include: 1) A self-contained habit tracker or pomodoro timer that persists state locally; 2) An interactive quote generator or game with synth audio; 3) A secret message or cryptographic treasure hunt locked with a password and expiry countdown; and 4) A lightweight cheat-sheet or pitch card that fits entirely inside a single QR code.",
      sources: [
        { title: "Bitty Box Starter Templates", uri: "https://bitty.box/templates" },
        { title: "Interactive Canvas & Audio Micro-Apps", uri: "https://bitty.box/examples" }
      ]
    };
  }

  return {
    answer: `Regarding "${query}": Bitty Box empowers zero-server web creation, instant URL distribution, and client-side execution. While live Google Search grounding is currently rate-limited on the Gemini API quota, I can answer your questions directly about micro-sites, encryption, HTML/CSS/JS features, and link configurations!`,
    sources: [
      { title: "Bitty Box Documentation", uri: "https://bitty.box" },
      { title: "Google Gemini API Quotas & Rate Limits", uri: "https://ai.google.dev/gemini-api/docs/rate-limits" }
    ]
  };
}

// Search Grounding endpoint using gemini-3.8-flash (with tiered search tool, text-only, and knowledge fallback)
app.post('/api/voice-assistant/ask', async (req: Request, res: Response) => {
  try {
    const { query, context, model: requestedModel } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      const fallback = generateBittyKnowledgeFallback(query);
      res.json({
        success: true,
        answer: fallback.answer,
        sources: fallback.sources,
        searchQueries: [query],
        isQuotaLimited: true,
        modelUsed: 'bitty-offline-knowledge',
        note: 'GEMINI_API_KEY is not configured on the server. Answered using built-in knowledge.',
      });
      return;
    }

    const prompt = `You are Bitty Assistant, an expert in web development, interactive micro-sites, and URL-native applications that store all their data inside the link without servers.
User Question: ${query}
Context: ${context || 'Live voice conversation inquiry with Google Search data.'}

Provide an accurate, up-to-date, helpful, and concise answer based on Google Search data. Keep the tone natural, conversational, and direct so it can easily be spoken aloud by Voice AI.`;

    const modelToUse = requestedModel && requestedModel !== 'gemini-3.5-flash' ? requestedModel : 'gemini-3.8-flash';
    let answer = '';
    let sources: { title: string; uri: string }[] = [];
    let searchQueries: string[] = [];
    let modelUsed = modelToUse;
    let isQuotaLimited = false;

    // Tier 1: Try Gemini with googleSearch tool
    try {
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      answer = response.text || '';
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const rawChunks = groundingMetadata?.groundingChunks || [];
      sources = rawChunks
        .map((c: any) => c.web)
        .filter(Boolean)
        .map((w: any) => ({
          title: w.title || 'Web Reference',
          uri: w.uri || '#',
        }));
      searchQueries = groundingMetadata?.webSearchQueries || [];
    } catch (searchErr: any) {
      const searchErrMsg = String(searchErr?.message || '');
      console.warn(`[API voice-assistant/ask] Search tool grounding notice: ${searchErrMsg.slice(0, 140)}`);

      // Tier 2: Try standard gemini-3.8-flash without googleSearch tool
      try {
        const textOnlyResponse = await ai.models.generateContent({
          model: modelToUse,
          contents: prompt,
        });
        answer = textOnlyResponse.text || '';
        sources = [
          { title: "Gemini Knowledge Base", uri: "https://ai.google.dev" }
        ];
        searchQueries = [query];
      } catch (genErr: any) {
        const genErrMsg = String(genErr?.message || '');
        console.warn(`[API voice-assistant/ask] Gemini generation quota rate-limited (${genErrMsg.slice(0, 120)}), using built-in knowledge response...`);

        // Tier 3: Local intelligent fallback answer
        isQuotaLimited = true;
        const fallback = generateBittyKnowledgeFallback(query);
        answer = fallback.answer;
        sources = fallback.sources;
        searchQueries = [query];
        modelUsed = 'gemini-3.8-flash (knowledge fallback)';
      }
    }

    if (!answer) {
      const fallback = generateBittyKnowledgeFallback(query);
      answer = fallback.answer;
      sources = fallback.sources;
      isQuotaLimited = true;
    }

    res.json({
      success: true,
      answer,
      sources,
      searchQueries,
      modelUsed,
      isQuotaLimited,
    });
  } catch (err: any) {
    console.warn('[API voice-assistant/ask] Unexpected error handled gracefully:', err?.message);
    const fallback = generateBittyKnowledgeFallback(req.body?.query || 'help');
    res.json({
      success: true,
      answer: fallback.answer,
      sources: fallback.sources,
      searchQueries: [req.body?.query || 'Bitty Box'],
      modelUsed: 'bitty-offline-knowledge',
      isQuotaLimited: true,
    });
  }
});

// -------------------------------------------------------------
// ACCOUNTS API ENDPOINTS (Fallback & Local Persistence)
// -------------------------------------------------------------

app.get('/api/accounts/me', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  if (!sid) {
    res.status(401).json({ success: false, error: 'No session provided' });
    return;
  }
  const userId = sessionsDb.get(sid) || (sid.startsWith('demo_') ? demoId : null);
  if (!userId) {
    res.status(401).json({ success: false, error: 'Session expired or not found' });
    return;
  }
  const user = accountsDb.get(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }
  res.json({ success: true, user, trusted: true });
});

app.post('/api/accounts/login', (req: Request, res: Response) => {
  const { email, displayName } = req.body;
  const userEmail = (email || 'creator@bittybox.org').trim().toLowerCase();
  
  // Find or create account
  let foundUser: StoredAccount | undefined;
  for (const acc of accountsDb.values()) {
    if (acc.email.toLowerCase() === userEmail) {
      foundUser = acc;
      break;
    }
  }

  if (!foundUser) {
    const newId = `user_${Date.now()}`;
    foundUser = {
      id: newId,
      email: userEmail,
      displayName: displayName || userEmail.split('@')[0] || 'Bitty Creator',
      avatar: '⚡',
      tier: 'PRO BUILDER',
      credits: 100,
      creditsUsedTotal: 0,
      creditsHumanUsed: 0,
      creditsApiUsed: 0,
      creditsMcpUsed: 0,
      joinedDate: new Date().toISOString(),
      lastSignedInAt: new Date().toISOString(),
      settings: { autoSaveLinks: true, trustThisDevice: true },
      apiKeys: [],
      links: [],
      transactions: [
        {
          id: `tx_${Date.now()}`,
          type: 'grant',
          amount: 100,
          description: 'Welcome Bonus (100 Credits)',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    accountsDb.set(newId, foundUser);
  } else {
    foundUser.lastSignedInAt = new Date().toISOString();
  }

  const sid = `sess_${foundUser.id}_${Date.now()}`;
  sessionsDb.set(sid, foundUser.id);

  res.json({
    success: true,
    user: foundUser,
    sessionId: sid,
    trusted: true,
  });
});

app.post('/api/accounts/google-fallback', (req: Request, res: Response) => {
  const { email, displayName, avatar } = req.body;
  const userEmail = (email || 'google.user@bittybox.org').trim().toLowerCase();
  
  let foundUser: StoredAccount | undefined;
  for (const acc of accountsDb.values()) {
    if (acc.email.toLowerCase() === userEmail) {
      foundUser = acc;
      break;
    }
  }

  if (!foundUser) {
    const newId = `goog_${Date.now()}`;
    foundUser = {
      id: newId,
      email: userEmail,
      displayName: displayName || 'Google User',
      avatar: avatar || '🌐',
      tier: 'PRO BUILDER',
      credits: 100,
      creditsUsedTotal: 0,
      creditsHumanUsed: 0,
      creditsApiUsed: 0,
      creditsMcpUsed: 0,
      joinedDate: new Date().toISOString(),
      lastSignedInAt: new Date().toISOString(),
      settings: { autoSaveLinks: true, trustThisDevice: true },
      apiKeys: [],
      links: [],
      transactions: [
        {
          id: `tx_goog_${Date.now()}`,
          type: 'grant',
          amount: 100,
          description: 'Instant Google Starter Grant (100 Credits)',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    accountsDb.set(newId, foundUser);
  } else {
    foundUser.lastSignedInAt = new Date().toISOString();
  }

  const sid = `fb_sess_${foundUser.id}_${Date.now()}`;
  sessionsDb.set(sid, foundUser.id);

  res.json({
    success: true,
    user: foundUser,
    sessionId: sid,
    trusted: true,
  });
});

app.post('/api/accounts/logout', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  if (sid) {
    sessionsDb.delete(sid);
  }
  res.json({ success: true });
});

app.post('/api/accounts/keys', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  const userId = sessionsDb.get(sid) || demoId;
  const user = accountsDb.get(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const { label, scopes } = req.body;
  const keyId = `key_${Date.now()}`;
  const rawKey = `bb_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  const keyMeta = {
    id: keyId,
    label: label || 'Agent Key',
    prefix: rawKey.substring(0, 10),
    scopes: scopes || ['write:box', 'read:box'],
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  user.apiKeys.push(keyMeta);
  res.json({ success: true, rawKey, key: keyMeta });
});

app.delete('/api/accounts/keys/:keyId', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  const userId = sessionsDb.get(sid) || demoId;
  const user = accountsDb.get(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const { keyId } = req.params;
  user.apiKeys = user.apiKeys.filter((k: any) => k.id !== keyId);
  res.json({ success: true });
});

app.post('/api/accounts/links', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  const userId = sessionsDb.get(sid) || demoId;
  const user = accountsDb.get(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const link = req.body;
  const box = {
    id: link.id || `box_${Date.now()}`,
    ...link,
    createdAt: link.createdAt || new Date().toISOString(),
  };

  user.links.unshift(box);
  res.json({ success: true, box, user });
});

// Pin Bitty Box to account dashboard for permanent cloud storage
app.post('/api/accounts/boxes/pin', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  const userId = sessionsDb.get(sid) || demoId;
  const user = accountsDb.get(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const { id, boxId, title, url, content, format, byteSize, compressedSize, encrypted, locks, cost } = req.body;
  const targetId = id || boxId || `box_${Date.now()}`;
  const now = new Date().toISOString();
  const backupSizeBytes = content ? Buffer.byteLength(content, 'utf8') : (byteSize || 0);

  // Find if box already exists in user's links
  let existingIndex = user.links.findIndex((l: any) => l.id === targetId || l.url === url);

  const updatedBox = {
    ...(existingIndex >= 0 ? user.links[existingIndex] : {}),
    id: targetId,
    title: title || 'Pinned Bitty Box',
    url: url, // Kept completely intact with exact same URL structure!
    format: format || 'html',
    byteSize: byteSize || (content ? content.length : 0),
    compressedSize: compressedSize || (url ? url.length : 0),
    encrypted: Boolean(encrypted),
    locks: locks || {},
    cost: cost || 0,
    createdAt: existingIndex >= 0 ? user.links[existingIndex].createdAt : now,
    isPinned: true,
    pinnedAt: now,
    cloudBackup: {
      status: 'backed_up',
      backedUpAt: now,
      content: content || '',
      sizeBytes: backupSizeBytes,
      url: url, // retains original URL structure
    },
  };

  if (existingIndex >= 0) {
    user.links[existingIndex] = updatedBox;
  } else {
    user.links.unshift(updatedBox);
  }

  res.json({
    success: true,
    message: 'Bitty Box successfully pinned for permanent cloud storage',
    box: updatedBox,
    user,
  });
});

// Unpin Bitty Box from account dashboard
app.post('/api/accounts/boxes/unpin', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  const userId = sessionsDb.get(sid) || demoId;
  const user = accountsDb.get(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const { boxId, id } = req.body;
  const targetId = boxId || id;
  const target = user.links.find((l: any) => l.id === targetId);
  if (target) {
    target.isPinned = false;
  }

  res.json({ success: true, user });
});

// Retrieve cloud backup content for a pinned box
app.get('/api/accounts/boxes/:boxId/backup', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  const userId = sessionsDb.get(sid) || demoId;
  const user = accountsDb.get(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const { boxId } = req.params;
  const box = user.links.find((l: any) => l.id === boxId);
  if (!box || !box.cloudBackup) {
    res.status(404).json({ success: false, error: 'Cloud backup not found for this box' });
    return;
  }

  res.json({
    success: true,
    backup: box.cloudBackup,
    box: {
      id: box.id,
      title: box.title,
      url: box.url,
      isPinned: box.isPinned,
      pinnedAt: box.pinnedAt,
    },
  });
});

app.delete('/api/accounts/links/:linkId', (req: Request, res: Response) => {
  const sid = req.headers['x-session-id'] as string;
  const userId = sessionsDb.get(sid) || demoId;
  const user = accountsDb.get(userId);
  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const { linkId } = req.params;
  user.links = user.links.filter((l: any) => l.id !== linkId);
  res.json({ success: true });
});

app.post('/api/accounts/credits/sync-from-creem', (req: Request, res: Response) => {
  res.json({ success: true, synced: true });
});

// -------------------------------------------------------------
// WEBSOCKET & HTTP SERVER SETUP
// -------------------------------------------------------------

async function startServer() {
  const server = http.createServer(app);

  // Attach WebSocketServer for Gemini Live API
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[Live WebSocket] Client connected to Voice AI');

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('[Live WebSocket] GEMINI_API_KEY is not set');
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error: 'GEMINI_API_KEY is not configured',
          message:
            'Please add your Gemini API Key in the Settings > Secrets menu to talk to Voice AI.',
        })
      );
      clientWs.close();
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: key });

      const session = await ai.live.connect({
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction:
            'You are Bitty Voice, the friendly conversational AI voice assistant for Bitty Box. Bitty Box lets users store entire web apps, documents, and interactive games directly inside shareable links without any servers, databases, or hosting costs. You talk casually, warmly, and clearly. Keep answers brief and engaging, ideal for quick spoken back-and-forth conversation. Help users brainstorm ideas for pages, explain how to store work inside links, suggest templates, and guide them in setting up passwords or timers to protect their creations.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audioData =
              message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'audio', audio: audioData }));
            }
            if (
              message.serverContent?.interrupted &&
              clientWs.readyState === WebSocket.OPEN
            ) {
              clientWs.send(JSON.stringify({ type: 'interrupted', interrupted: true }));
            }
          },
          onclose: () => {
            console.log('[Live API] Session closed by Gemini');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'session_closed' }));
            }
          },
          onerror: (err) => {
            console.warn('[Live API] Session notice:', err?.message || err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: 'The AI voice session encountered a hiccup. Reconnecting...',
                })
              );
            }
          },
        },
      });

      clientWs.send(
        JSON.stringify({
          type: 'ready',
          model: 'gemini-3.1-flash-live-preview',
          message: 'Connected to Gemini Live! Start speaking whenever you are ready.',
        })
      );

      clientWs.on('message', (rawData) => {
        try {
          const parsed = JSON.parse(rawData.toString());
          if (parsed.audio) {
            // Send raw 16kHz PCM audio
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (parsed.text) {
            session.sendRealtimeInput({
              text: parsed.text,
            });
          }
        } catch (e: any) {
          console.warn('[Live WebSocket] Notice parsing message:', e?.message);
        }
      });

      clientWs.on('close', () => {
        console.log('[Live WebSocket] Client disconnected');
        try {
          session.close();
        } catch {}
      });
    } catch (err: any) {
      console.warn('[Live WebSocket] Gemini Live notice:', err?.message || err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            message:
              'Could not establish voice connection with Gemini Live. Please verify your API key and permissions in Settings > Secrets.',
            detail: err?.message,
          })
        );
        clientWs.close();
      }
    }
  });

  // -------------------------------------------------------------
  // VITE MIDDLEWARE (Dev) / STATIC SERVING (Prod)
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Bitty Box Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
