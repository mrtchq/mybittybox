import React, { useState } from 'react';
import {
  Bot,
  Terminal,
  Code2,
  Cpu,
  Zap,
  Check,
  Copy,
  ExternalLink,
  Shield,
  Sparkles,
  Globe,
  Key,
  Lock,
  Play,
  RefreshCw,
  FileCode,
  Layers,
  Settings2,
  Sliders,
  ArrowRight,
  BookOpen,
  Workflow,
  Boxes,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Share2,
  QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CyberScrambleText } from './CyberScrambleText';

interface AgentsPageProps {
  onOpenEditor?: () => void;
  onOpenAccount?: () => void;
  onOpenQr?: (url: string) => void;
}

type TabType = 'mcp' | 'rest' | 'code' | 'sandbox' | 'protocol';
type McpClientType = 'claude' | 'cursor' | 'windsurf' | 'antigravity' | 'generic';
type SnippetLang = 'python' | 'typescript' | 'curl' | 'prompt';

const MCP_TOOLS_DETAIL = [
  {
    name: 'create_bitty_link',
    description: 'Universal link creator. Compresses text, code, markdown, HTML, SVG, JSON, or canvas apps into a permanent, self-contained URL.',
    parameters: [
      { name: 'content', type: 'string', required: true, desc: 'The raw content to encode' },
      { name: 'title', type: 'string', required: false, desc: 'Document or webpage title' },
      { name: 'format', type: 'enum', required: false, desc: 'auto | markdown | code | html | json | svg | canvas | recipe (default: auto)' },
      { name: 'language', type: 'string', required: false, desc: 'Programming language if format is code (e.g. python, typescript, bash, sql)' },
      { name: 'theme', type: 'enum', required: false, desc: 'auto | dark | light (default: auto)' },
      { name: 'password', type: 'string', required: false, desc: 'Optional passphrase to encrypt with client-side AES-256-GCM' },
      { name: 'editable', type: 'boolean', required: false, desc: 'Whether to open directly in editable mode (default: false)' },
    ],
  },
  {
    name: 'create_code_bitty_link',
    description: 'Generates a developer-grade syntax-highlighted code viewer with line numbers, copy button, language badge, and download action.',
    parameters: [
      { name: 'code', type: 'string', required: true, desc: 'The source code string' },
      { name: 'language', type: 'string', required: false, desc: 'python, typescript, javascript, rust, go, bash, sql, etc.' },
      { name: 'title', type: 'string', required: false, desc: 'File name or script title (e.g. "deploy.sh")' },
      { name: 'theme', type: 'enum', required: false, desc: 'dark | light | auto (default: dark)' },
    ],
  },
  {
    name: 'create_markdown_bitty_link',
    description: 'Generates a rich Markdown document viewer supporting GFM tables, checklists, code blocks, and theme switching.',
    parameters: [
      { name: 'markdown', type: 'string', required: true, desc: 'GitHub-flavored markdown string' },
      { name: 'title', type: 'string', required: false, desc: 'Document title' },
      { name: 'theme', type: 'enum', required: false, desc: 'dark | light | auto' },
    ],
  },
  {
    name: 'create_html_bitty_link',
    description: 'Generates an interactive mini-web application, widget, or canvas tool that executes inside a secure client sandbox.',
    parameters: [
      { name: 'html', type: 'string', required: true, desc: 'Complete HTML/CSS/JavaScript code' },
      { name: 'title', type: 'string', required: false, desc: 'Application title' },
    ],
  },
  {
    name: 'decode_bitty_link',
    description: 'Decompresses and decodes an existing Bitty Box URL or hash fragment back into its original source content and metadata.',
    parameters: [
      { name: 'url', type: 'string', required: true, desc: 'The complete Bitty Link URL or hash fragment' },
      { name: 'password', type: 'string', required: false, desc: 'Passphrase if the link is AES-256-GCM encrypted' },
    ],
  },
  {
    name: 'list_supported_formats',
    description: 'Returns all supported render formats, code syntax engines, and optional flags available on the Bitty Box engine.',
    parameters: [],
  },
  {
    name: 'create_box',
    description: 'Wraps an existing Bitty URL in a server-gated Box entity for server-side policy enforcement, password locking, and access quotas.',
    parameters: [
      { name: 'bittyUrl', type: 'string', required: true, desc: 'The underlying Bitty URL' },
      { name: 'title', type: 'string', required: false, desc: 'Box title' },
      { name: 'lockConfig', type: 'object', required: false, desc: 'Optional initial locks (password, time window, open limits)' },
    ],
  },
  {
    name: 'set_password_lock',
    description: 'Applies a server-side password gate to a Box entity.',
    parameters: [
      { name: 'boxId', type: 'string', required: true, desc: 'Unique Box identifier' },
      { name: 'password', type: 'string', required: true, desc: 'Password required to unlock' },
    ],
  },
  {
    name: 'set_time_lock',
    description: 'Restricts access to a Box to a specific time window (notBefore / notAfter).',
    parameters: [
      { name: 'boxId', type: 'string', required: true, desc: 'Unique Box identifier' },
      { name: 'notBefore', type: 'string', required: false, desc: 'ISO 8601 earliest start time' },
      { name: 'notAfter', type: 'string', required: false, desc: 'ISO 8601 expiration time' },
    ],
  },
  {
    name: 'set_access_limit',
    description: 'Restricts total maximum opens or per-session opens for a Box.',
    parameters: [
      { name: 'boxId', type: 'string', required: true, desc: 'Unique Box identifier' },
      { name: 'maxOpens', type: 'number', required: true, desc: 'Maximum lifetime opens allowed' },
    ],
  },
];

const FORMAT_PRESETS: Record<string, { title: string; content: string }> = {
  markdown: {
    title: 'Agent Intelligence Brief',
    content: `# Autonomous Agent Report 🤖\n\nBitty Box allows AI agents to produce live, interactive micro-webpages and documents packed directly into URL hashes without needing database storage!\n\n- [x] Zero backend DB needed\n- [x] Instant rendering\n- [x] AES-256 Encryption supported\n\n> *Payload delivered deterministically via URL fragment.*`
  },
  html: {
    title: 'Interactive Agent Widget',
    content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { background: #070314; color: #00f2ff; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { border: 1px solid rgba(0,242,255,0.4); background: rgba(5,2,20,0.8); padding: 2rem; border-radius: 16px; box-shadow: 0 0 30px rgba(0,242,255,0.2); }
    button { background: #00f2ff; color: #000; font-weight: bold; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 15px; font-family: monospace; }
    button:hover { background: #38bdf8; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚡ LIVE AGENT APP</h2>
    <p>Rendered 100% in-browser from URL hash</p>
    <button onclick="alert('Autonomous Agent Widget Active!')">RUN PAYLOAD</button>
  </div>
</body>
</html>`
  },
  code: {
    title: 'Agent Python Script',
    content: `#!/usr/bin/env python3
"""Autonomous Agent Tool Integration for Bitty Box."""
import json
import urllib.request

def generate_bitty_box(content: str, title: str = "Agent Export") -> str:
    url = "https://bittybox.org/api/agent/url"
    payload = json.dumps({"title": title, "content": content, "format": "code"}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
        return data.get("url")

if __name__ == "__main__":
    box_url = generate_bitty_box("print('Hello from autonomous agent!')")
    print(f"Generated Bitty Box: {box_url}")`
  },
  json: {
    title: 'Agent Telemetry Data',
    content: `{
  "agent_id": "agent_alpha_09",
  "status": "active",
  "task": "autonomous_link_generation",
  "timestamp": "2026-08-24T00:00:00Z",
  "metrics": {
    "payload_bytes": 1024,
    "compression_ratio": "88.4%",
    "zero_server_db": true
  },
  "tags": ["bittybox", "mcp", "agentic"]
}`
  },
  auto: {
    title: 'Multi-Format Agent Document',
    content: `# Auto-Detected Agent Payload\n\nThis content is analyzed dynamically by the Bitty Box decoder to select the optimal view mode (Markdown, HTML, JSON, or Code).`
  }
};

export const AgentsPage: React.FC<AgentsPageProps> = ({
  onOpenEditor,
  onOpenAccount,
  onOpenQr,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('mcp');
  const [mcpClient, setMcpClient] = useState<McpClientType>('claude');
  const [snippetLang, setSnippetLang] = useState<SnippetLang>('python');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTool, setExpandedTool] = useState<string | null>('create_bitty_link');

  // Interactive Sandbox state
  const [sandboxTitle, setSandboxTitle] = useState<string>(FORMAT_PRESETS.markdown.title);
  const [sandboxFormat, setSandboxFormat] = useState<string>('markdown');
  const [sandboxContent, setSandboxContent] = useState<string>(FORMAT_PRESETS.markdown.content);
  const [sandboxPassword, setSandboxPassword] = useState<string>('');
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const runSandboxTest = async () => {
    setSandboxLoading(true);
    setSandboxError(null);
    setSandboxResult(null);
    try {
      const payload: any = {
        title: sandboxTitle,
        format: sandboxFormat,
        content: sandboxContent,
      };
      if (sandboxPassword.trim()) {
        payload.password = sandboxPassword.trim();
      }

      const res = await fetch('/api/agent/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}: Failed to create link`);
      }
      setSandboxResult(data);
    } catch (err: any) {
      setSandboxError(err.message || 'An error occurred while calling the API');
    } finally {
      setSandboxLoading(false);
    }
  };

  const getMcpConfigSnippet = () => {
    switch (mcpClient) {
      case 'claude':
        return JSON.stringify(
          {
            mcpServers: {
              bittybox: {
                type: 'http',
                url: 'https://bittybox.org/mcp',
                headers: {
                  Authorization: 'Bearer <YOUR_API_KEY>',
                  Accept: 'application/json, text/event-stream',
                  'MCP-Protocol-Version': '2025-06-18',
                },
              },
            },
          },
          null,
          2
        );
      case 'cursor':
        return JSON.stringify(
          {
            mcpServers: {
              bittybox: {
                url: 'https://bittybox.org/mcp',
                headers: {
                  'X-API-Key': '<YOUR_API_KEY>',
                },
              },
            },
          },
          null,
          2
        );
      case 'windsurf':
        return JSON.stringify(
          {
            mcpServers: {
              bittybox: {
                command: 'npx',
                args: ['-y', 'bitty-mcp'],
                env: {
                  BITTYBOX_API_KEY: '<YOUR_API_KEY>',
                },
              },
            },
          },
          null,
          2
        );
      case 'antigravity':
        return `# ~/.gemini/antigravity-cli/mcp/bittybox/config.json
{
  "name": "bittybox",
  "command": "node",
  "args": ["/var/www/bittybox.org/bin/bitty-mcp.js"],
  "env": {
    "BITTYBOX_API_KEY": "<YOUR_API_KEY>"
  }
}`;
      case 'generic':
      default:
        return `# Streamable HTTP Transport:
Endpoint: https://bittybox.org/mcp
Headers:
  Authorization: Bearer <YOUR_API_KEY>
  Accept: application/json, text/event-stream
  MCP-Protocol-Version: 2025-06-18

# Stdio Transport:
Command: npx -y bitty-mcp
Env: BITTYBOX_API_KEY=<YOUR_API_KEY>`;
    }
  };

  const getCodeSnippet = () => {
    switch (snippetLang) {
      case 'python':
        return `import requests

# 1. Create a self-contained Bitty Link
res = requests.post(
    "https://bittybox.org/api/agent/url",
    headers={"Content-Type": "application/json", "Authorization": "Bearer YOUR_API_KEY"},
    json={
        "title": "Data Report",
        "format": "markdown",
        "content": "# Live Report\\n\\nGenerated at runtime with **zero backend storage**.",
        "theme": "dark"
    }
)
data = res.json()
print("Generated URL:", data["url"])
print("Compression savings:", f"{data['stats']['savingsPercent']}%")

# 2. Inspect / Decode an existing Bitty Link
inspect_res = requests.post(
    "https://bittybox.org/api/agent/inspect",
    json={"url": data["url"]}
)
print("Decoded Content:", inspect_res.json()["content"])`;

      case 'typescript':
        return `// TypeScript / Node.js Fetch Integration
interface BittyCreateResponse {
  success: boolean;
  url: string;
  stats: {
    byteSize: number;
    compressedSize: number;
    savingsPercent: number;
  };
  qrDataUrl?: string;
  embedHtml?: string;
}

async function createBittyLink(content: string, title = 'Web App', format = 'html') {
  const response = await fetch('https://bittybox.org/api/agent/url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY',
    },
    body: JSON.stringify({
      title,
      format,
      content,
      theme: 'dark',
    }),
  });

  const result: BittyCreateResponse = await response.json();
  if (!result.success) throw new Error('Failed to create Bitty link');
  return result;
}

// Example: Create an interactive HTML widget
createBittyLink('<h1>Hello World</h1><button onclick="alert(1)">Click</button>')
  .then(res => console.log('Bitty Link URL:', res.url));`;

      case 'curl':
        return `# Create a Markdown document Bitty link
curl -sS https://bittybox.org/api/agent/url \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "title": "Agent Launch Brief",
    "format": "markdown",
    "content": "# Launch Brief\\nShip autonomous agents with self-inflating links.",
    "theme": "dark"
  }'

# Inspect & Decode an existing Bitty link
curl -sS https://bittybox.org/api/agent/inspect \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://bittybox.org/#My-Doc/data:text/html;charset=utf-8;format=gz;base64,..."
  }'

# Validate payload size & format before building
curl -sS https://bittybox.org/api/agent/validate \\
  -H "Content-Type: application/json" \\
  -d '{ "format": "html", "content": "<div>Smoke test</div>" }'`;

      case 'prompt':
        return `## Bitty Box Tool Instruction for AI Agents

You have access to the Bitty Box API and MCP Server (https://bittybox.org).
Whenever the user asks you to:
- Share code, a script, or SQL snippet with syntax highlighting and line numbers
- Output a formatted Markdown document, checklist, or summary
- Build a mini-web application, interactive widget, chart, or calculator
- Produce a shareable webpage link with NO server persistence or database

You should use the Bitty Box \`create_bitty_link\` or POST to \`https://bittybox.org/api/agent/url\`:
- Format: "code" (with language), "markdown", "html", or "json"
- Title: A concise title for the document/app
- Returns: A URL (https://bittybox.org/#...) that renders client-side in any browser.

Always provide the user with the direct Bitty link URL so they can open or share the standalone page.`;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 sm:py-10 px-3 sm:px-6">
      {/* =========================================================================
          HERO BANNER
         ========================================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bento-card p-6 sm:p-10 relative mb-8 overflow-hidden"
      >
        <div className="bento-corner-accent top-l" />
        <div className="bento-corner-accent top-r" />
        <div className="bento-corner-accent bot-l" />
        <div className="bento-corner-accent bot-r" />

        {/* Ambient Glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 text-xs font-mono mb-4">
              <Bot className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span>AGENT &bull; MCP HANDSHAKE PROTOCOL v2.0</span>
            </div>

            <h1 className="font-cyber text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-fuchsia-400 tracking-tight">
              <CyberScrambleText text="BITTY BOX FOR AI AGENTS" speed={16} />
            </h1>

            <p className="text-sm sm:text-base text-purple-200/80 mt-3 leading-relaxed">
              Equip AI coding agents, autonomous bots, and LLM tool chains with instantaneous, zero-backend webpage and document generation. Deliver rich apps, markdown documents, syntax-highlighted code, and encrypted vaults directly inside URL hashes.
            </p>

            <div className="flex flex-wrap gap-2.5 mt-6">
              <a
                href="/agents.json"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-200 hover:text-cyan-200 hover:border-cyan-400/50 font-mono text-xs transition-all"
              >
                <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                DISCOVERY JSON
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>

              <button
                onClick={onOpenAccount}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-200 hover:text-cyan-200 hover:border-cyan-400/50 font-mono text-xs transition-all cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-fuchsia-400" />
                MANAGE API KEYS
              </button>
            </div>
          </div>

          {/* Quick Stat Pill Card */}
          <div className="w-full lg:w-72 p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 backdrop-blur-md shrink-0 space-y-3">
            <div className="text-[11px] font-mono text-cyan-300 font-bold uppercase tracking-wider flex items-center justify-between">
              <span>PROTOCOL ENDPOINTS</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-[#050212] border border-cyan-500/20 flex items-center justify-between">
                <span className="text-cyan-400">MCP Stream</span>
                <span className="text-purple-200/80">/mcp</span>
              </div>
              <div className="p-2 rounded-lg bg-[#050212] border border-cyan-500/20 flex items-center justify-between">
                <span className="text-teal-400">REST Create</span>
                <span className="text-purple-200/80">/api/agent/url</span>
              </div>
              <div className="p-2 rounded-lg bg-[#050212] border border-cyan-500/20 flex items-center justify-between">
                <span className="text-fuchsia-400">Box Policy</span>
                <span className="text-purple-200/80">/api/boxes</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* =========================================================================
          INTERACTIVE NAVIGATION TABS
         ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-purple-500/20 pb-2 mb-8 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('mcp')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'mcp'
              ? 'bg-gradient-to-r from-cyan-950 to-teal-950 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,255,0.2)]'
              : 'text-purple-200/70 hover:text-cyan-200 hover:bg-purple-950/30'
          }`}
        >
          <Workflow className="w-4 h-4 text-cyan-400" />
          <span>MCP SERVER</span>
        </button>

        <button
          onClick={() => setActiveTab('rest')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'rest'
              ? 'bg-gradient-to-r from-cyan-950 to-teal-950 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,255,0.2)]'
              : 'text-purple-200/70 hover:text-cyan-200 hover:bg-purple-950/30'
          }`}
        >
          <Globe className="w-4 h-4 text-teal-400" />
          <span>REST API</span>
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'code'
              ? 'bg-gradient-to-r from-cyan-950 to-teal-950 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,255,0.2)]'
              : 'text-purple-200/70 hover:text-cyan-200 hover:bg-purple-950/30'
          }`}
        >
          <Code2 className="w-4 h-4 text-fuchsia-400" />
          <span>CODE SNIPPETS & SDK</span>
        </button>

        <button
          onClick={() => setActiveTab('sandbox')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'sandbox'
              ? 'bg-gradient-to-r from-cyan-950 to-teal-950 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,255,0.2)]'
              : 'text-purple-200/70 hover:text-cyan-200 hover:bg-purple-950/30'
          }`}
        >
          <Play className="w-4 h-4 text-amber-400" />
          <span>AGENT LINK GENERATOR</span>
        </button>

        <button
          onClick={() => setActiveTab('protocol')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wider transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'protocol'
              ? 'bg-gradient-to-r from-cyan-950 to-teal-950 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,255,0.2)]'
              : 'text-purple-200/70 hover:text-cyan-200 hover:bg-purple-950/30'
          }`}
        >
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>SECURITY & PROTOCOL</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: MCP SERVER INTEGRATION
         ========================================================================= */}
      {activeTab === 'mcp' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-8"
        >
          {/* MCP Overview & Client Config */}
          <div className="bento-card p-6 sm:p-8 relative">
            <div className="bento-corner-accent top-l" />
            <div className="bento-corner-accent top-r" />
            <div className="bento-corner-accent bot-l" />
            <div className="bento-corner-accent bot-r" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-cyber text-lg sm:text-xl font-bold text-cyan-200 flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-cyan-400" />
                  MODEL CONTEXT PROTOCOL (MCP) INTEGRATION
                </h2>
                <p className="text-xs sm:text-sm text-purple-200/70 mt-1">
                  Connect Claude Desktop, Cursor, Windsurf, or custom agent hosts directly to Bitty Box via Streamable HTTP or Stdio.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#050212] p-1 rounded-xl border border-purple-500/30 shrink-0">
                {(['claude', 'cursor', 'windsurf', 'antigravity', 'generic'] as McpClientType[]).map((client) => (
                  <button
                    key={client}
                    onClick={() => setMcpClient(client)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold capitalize transition-colors cursor-pointer ${
                      mcpClient === client
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-400/40 shadow-[0_0_8px_rgba(0,242,255,0.3)]'
                        : 'text-purple-300/60 hover:text-cyan-200'
                    }`}
                  >
                    {client}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Block with Copy */}
            <div className="relative rounded-xl bg-[#03010a] border border-cyan-500/20 p-4 font-mono text-xs text-cyan-200 overflow-x-auto">
              <button
                onClick={() => handleCopy('mcp-config', getMcpConfigSnippet())}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-500/40 text-purple-200 hover:text-cyan-200 hover:border-cyan-400 text-[11px] transition-all cursor-pointer z-10"
              >
                {copiedId === 'mcp-config' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Config</span>
                  </>
                )}
              </button>
              <pre className="pr-24">{getMcpConfigSnippet()}</pre>
            </div>
          </div>

          {/* MCP Tools Catalog */}
          <div className="space-y-4">
            <h3 className="font-cyber text-base font-bold text-cyan-200 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-cyan-400" />
              AVAILABLE MCP TOOLS REFERENCE
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {MCP_TOOLS_DETAIL.map((tool) => {
                const isExpanded = expandedTool === tool.name;
                return (
                  <div
                    key={tool.name}
                    className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/20 hover:border-cyan-500/40 transition-colors"
                  >
                    <div
                      onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                      className="flex items-start sm:items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-mono text-xs shrink-0">
                          <Zap className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                          <code className="text-sm font-mono font-bold text-cyan-300">
                            {tool.name}
                          </code>
                          <p className="text-xs text-purple-200/70 mt-0.5">{tool.description}</p>
                        </div>
                      </div>

                      <div className="text-purple-400/60 p-1 shrink-0">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>

                    {isExpanded && tool.parameters.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-3 border-t border-purple-500/20"
                      >
                        <h4 className="text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider mb-2">
                          Parameters Schema
                        </h4>
                        <div className="space-y-1.5">
                          {tool.parameters.map((p) => (
                            <div
                              key={p.name}
                              className="p-2 rounded-lg bg-[#050212] border border-cyan-500/10 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-cyan-300 font-bold">{p.name}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-500/30">
                                  {p.type}
                                </span>
                                {p.required && (
                                  <span className="text-[10px] text-fuchsia-400 font-bold">REQUIRED</span>
                                )}
                              </div>
                              <span className="text-purple-200/60 text-[11px]">{p.desc}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* =========================================================================
          TAB 2: REST API REFERENCE
         ========================================================================= */}
      {activeTab === 'rest' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Endpoint 1: Create URL */}
          <div className="bento-card p-6 relative">
            <div className="bento-corner-accent top-l" />
            <div className="bento-corner-accent top-r" />
            <div className="bento-corner-accent bot-l" />
            <div className="bento-corner-accent bot-r" />

            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                  POST
                </span>
                <code className="text-sm font-mono font-bold text-cyan-200">
                  /api/agent/url &bull; /api/bitty/create
                </code>
              </div>
              <span className="text-xs font-mono text-purple-200/60 hidden sm:inline">
                Create Bitty Link
              </span>
            </div>

            <p className="text-xs sm:text-sm text-purple-200/80 mb-4">
              Encodes raw text, code, markdown, HTML, SVG, or JSON into a permanent compressed URL hash fragment.
            </p>

            <div className="space-y-3">
              <h4 className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider">
                Request Body (JSON)
              </h4>
              <div className="p-3 rounded-xl bg-[#03010a] border border-cyan-500/20 font-mono text-xs text-cyan-100">
                <pre>{`{
  "content": "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>",
  "title": "Interactive Widget",
  "format": "html",       // "auto" | "markdown" | "code" | "html" | "json" | "svg" | "canvas"
  "language": "html",     // Programming language (if format is code)
  "theme": "dark",        // "dark" | "light" | "auto"
  "password": "passcode", // Optional client-side AES-256-GCM encryption
  "editable": false       // Opens in editable note mode
}`}</pre>
              </div>

              <h4 className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider mt-4">
                Response Payload (200 OK)
              </h4>
              <div className="p-3 rounded-xl bg-[#03010a] border border-cyan-500/20 font-mono text-xs text-cyan-100">
                <pre>{`{
  "success": true,
  "url": "https://bittybox.org/#Interactive-Widget/data:text/html;charset=utf-8;format=gz;base64,H4sIAAAAAAAA/...",
  "stats": {
    "byteSize": 105,
    "compressedSize": 62,
    "compressionRatio": 0.59,
    "savingsPercent": 41
  },
  "qrDataUrl": "data:image/png;base64,...",
  "embedHtml": "<iframe src=\\"https://bittybox.org/#...\\" ...></iframe>"
}`}</pre>
              </div>
            </div>
          </div>

          {/* Endpoint 2: Inspect URL */}
          <div className="bento-card p-6 relative">
            <div className="bento-corner-accent top-l" />
            <div className="bento-corner-accent top-r" />
            <div className="bento-corner-accent bot-l" />
            <div className="bento-corner-accent bot-r" />

            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold">
                  POST
                </span>
                <code className="text-sm font-mono font-bold text-cyan-200">
                  /api/agent/inspect &bull; /api/bitty/decode
                </code>
              </div>
              <span className="text-xs font-mono text-purple-200/60 hidden sm:inline">
                Inspect & Decode URL
              </span>
            </div>

            <p className="text-xs sm:text-sm text-purple-200/80 mb-4">
              Decompresses an existing Bitty Box link or hash fragment and extracts full original content, title, and metadata.
            </p>

            <div className="p-3 rounded-xl bg-[#03010a] border border-cyan-500/20 font-mono text-xs text-cyan-100">
              <pre>{`// Request Body:
{
  "url": "https://bittybox.org/#My-Note/data:text/html;charset=utf-8;format=gz;base64,...",
  "password": "optional-password"
}

// Response Payload:
{
  "success": true,
  "content": "<!DOCTYPE html>...",
  "metadata": {
    "title": "My Note",
    "description": "...",
    "favicon": "📦"
  },
  "byteSize": 105,
  "compressedSize": 62,
  "encrypted": false
}`}</pre>
            </div>
          </div>

          {/* Endpoint 3: Capabilities & Formats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bento-card p-6 relative">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="px-2.5 py-1 rounded bg-blue-950 border border-blue-500/40 text-blue-300 font-mono text-xs font-bold">
                  GET
                </span>
                <code className="text-xs font-mono font-bold text-cyan-200">
                  /api/agent/capabilities &bull; /agents.json
                </code>
              </div>
              <p className="text-xs text-purple-200/80">
                Machine-readable JSON discovery handshake containing endpoints, schemas, authentication modes, and token limits.
              </p>
            </div>

            <div className="bento-card p-6 relative">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="px-2.5 py-1 rounded bg-blue-950 border border-blue-500/40 text-blue-300 font-mono text-xs font-bold">
                  GET
                </span>
                <code className="text-xs font-mono font-bold text-cyan-200">
                  /api/bitty/formats
                </code>
              </div>
              <p className="text-xs text-purple-200/80">
                Returns the list of supported render formats (markdown, html, code, canvas, json, svg) and syntax highlighters.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* =========================================================================
          TAB 3: CODE SNIPPETS & SDK
         ========================================================================= */}
      {activeTab === 'code' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="bento-card p-6 sm:p-8 relative">
            <div className="bento-corner-accent top-l" />
            <div className="bento-corner-accent top-r" />
            <div className="bento-corner-accent bot-l" />
            <div className="bento-corner-accent bot-r" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="font-cyber text-lg sm:text-xl font-bold text-cyan-200 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-fuchsia-400" />
                  READY-TO-USE CODE & AGENT PROMPTS
                </h2>
                <p className="text-xs sm:text-sm text-purple-200/70 mt-1">
                  Copy-paste snippets for Python, TypeScript/Node.js, cURL, or LLM System Prompts.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#050212] p-1 rounded-xl border border-purple-500/30 shrink-0">
                {(['python', 'typescript', 'curl', 'prompt'] as SnippetLang[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSnippetLang(lang)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold uppercase transition-colors cursor-pointer ${
                      snippetLang === lang
                        ? 'bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-400/40 shadow-[0_0_8px_rgba(255,0,222,0.3)]'
                        : 'text-purple-300/60 hover:text-cyan-200'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative rounded-xl bg-[#03010a] border border-cyan-500/20 p-4 font-mono text-xs text-cyan-100 overflow-x-auto">
              <button
                onClick={() => handleCopy(`snippet-${snippetLang}`, getCodeSnippet())}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-500/40 text-purple-200 hover:text-cyan-200 hover:border-cyan-400 text-[11px] transition-all cursor-pointer z-10"
              >
                {copiedId === `snippet-${snippetLang}` ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Snippet</span>
                  </>
                )}
              </button>
              <pre className="pr-24">{getCodeSnippet()}</pre>
            </div>
          </div>
        </motion.div>
      )}

      {/* =========================================================================
          TAB 4: LIVE SANDBOX TESTER
         ========================================================================= */}
      {activeTab === 'sandbox' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="bento-card p-6 sm:p-8 relative">
            <div className="bento-corner-accent top-l" />
            <div className="bento-corner-accent top-r" />
            <div className="bento-corner-accent bot-l" />
            <div className="bento-corner-accent bot-r" />

            <h2 className="font-cyber text-lg sm:text-xl font-bold text-cyan-200 flex items-center gap-2 mb-2">
              <Play className="w-5 h-5 text-amber-400" />
              INTERACTIVE AGENT LINK GENERATOR
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/70 mb-6">
              Simulate an AI agent payload request directly against the live Bitty Box engine.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1.5">
                  Document Title
                </label>
                <input
                  type="text"
                  value={sandboxTitle}
                  onChange={(e) => setSandboxTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#03010a] border border-cyan-500/30 text-cyan-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                  placeholder="e.g. Daily Market Summary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1.5">
                  Rendering Format
                </label>
                <select
                  value={sandboxFormat}
                  onChange={(e) => {
                    const newFormat = e.target.value;
                    setSandboxFormat(newFormat);
                    if (FORMAT_PRESETS[newFormat]) {
                      setSandboxContent(FORMAT_PRESETS[newFormat].content);
                      setSandboxTitle(FORMAT_PRESETS[newFormat].title);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#03010a] border border-cyan-500/30 text-cyan-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                >
                  <option value="markdown">markdown (GitHub Flavored Markdown)</option>
                  <option value="html">html (Interactive Sandboxed Web App)</option>
                  <option value="code">code (Syntax Highlighted Viewer)</option>
                  <option value="json">json (Tree Explorer)</option>
                  <option value="auto">auto (Auto-detect format)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1.5">
                  AES-256 Passcode (Optional)
                </label>
                <input
                  type="password"
                  value={sandboxPassword}
                  onChange={(e) => setSandboxPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#03010a] border border-cyan-500/30 text-cyan-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                  placeholder="Leave blank for unencrypted"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider mb-1.5">
                Payload Content
              </label>
              <textarea
                value={sandboxContent}
                onChange={(e) => setSandboxContent(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 rounded-xl bg-[#03010a] border border-cyan-500/30 text-cyan-100 font-mono text-xs focus:outline-none focus:border-cyan-400 resize-y"
                placeholder="Enter markdown, HTML, code, or text..."
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={runSandboxTest}
                disabled={sandboxLoading || !sandboxContent.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 text-black font-cyber font-bold text-xs hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] disabled:opacity-50 transition-all cursor-pointer"
              >
                {sandboxLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    <span>ENCODING BITTY BOX...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black" />
                    <span>GENERATE BITTY BOX</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Display */}
            {sandboxError && (
              <div className="mt-6 p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-mono flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <span>{sandboxError}</span>
              </div>
            )}

            {/* Live Result Display */}
            {sandboxResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-5 rounded-2xl bg-cyan-950/30 border border-cyan-400/40 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="font-cyber font-bold text-sm text-cyan-200">
                      LINK CREATED SUCCESSFULLY!
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-purple-300">
                      Raw: <b className="text-white">{sandboxResult.stats?.byteSize || 0}B</b>
                    </span>
                    <span className="text-cyan-300">
                      Compressed: <b className="text-white">{sandboxResult.stats?.compressedSize || 0}B</b>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold">
                      -{sandboxResult.stats?.savingsPercent || 0}%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#03010a] border border-cyan-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <span className="font-mono text-xs text-cyan-300 truncate max-w-xl">
                    {sandboxResult.url}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCopy('sandbox-url', sandboxResult.url)}
                      className="px-3 py-1.5 rounded-lg bg-purple-950 border border-purple-500/40 text-purple-200 hover:text-cyan-200 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === 'sandbox-url' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>

                    <a
                      href={sandboxResult.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 text-black font-bold text-xs font-mono flex items-center gap-1.5 hover:shadow-[0_0_12px_rgba(0,242,255,0.4)]"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    {onOpenQr && (
                      <button
                        onClick={() => onOpenQr(sandboxResult.url)}
                        className="p-1.5 rounded-lg bg-purple-950 border border-purple-500/40 text-purple-200 hover:text-cyan-200 cursor-pointer"
                        title="Show QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* =========================================================================
          TAB 5: PROTOCOL SPECIFICATIONS & SECURITY
         ========================================================================= */}
      {activeTab === 'protocol' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bento-card p-6 relative">
              <div className="bento-corner-accent top-l" />
              <div className="bento-corner-accent top-r" />
              <div className="bento-corner-accent bot-l" />
              <div className="bento-corner-accent bot-r" />

              <h3 className="font-cyber text-base font-bold text-cyan-200 flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-cyan-400" />
                URL-NATIVE COMPRESSION PIPELINE
              </h3>
              <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed font-mono">
                Bitty Box encodes data into browser URI fragments using Deflate/GZIP Level 9 compression followed by URL-safe Base64 encoding. The hash fragment is never sent to the web server during initial HTTP requests, guaranteeing zero-server persistence.
              </p>
            </div>

            <div className="bento-card p-6 relative">
              <div className="bento-corner-accent top-l" />
              <div className="bento-corner-accent top-r" />
              <div className="bento-corner-accent bot-l" />
              <div className="bento-corner-accent bot-r" />

              <h3 className="font-cyber text-base font-bold text-fuchsia-200 flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-fuchsia-400" />
                CLIENT-SIDE AES-256-GCM
              </h3>
              <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed font-mono">
                When a password is provided, data is encrypted via Web Crypto AES-GCM before compression. Only parties possessing the passphrase can decrypt and unpack the capsule in their browser.
              </p>
            </div>
          </div>

          <div className="bento-card p-6 relative border-amber-500/30 bg-amber-950/10">
            <h3 className="font-cyber text-base font-bold text-amber-300 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              AGENT BEST PRACTICES & URL BUDGETS
            </h3>
            <ul className="space-y-2 text-xs sm:text-sm text-purple-200/80 list-disc list-inside font-mono">
              <li>
                <b>URL Length Budget:</b> Keep URLs under 12,000 characters for optimal compatibility across chat apps, SMS, QR scanners, and redirectors.
              </li>
              <li>
                <b>External Assets:</b> For large images or media, reference hosted URLs or icons rather than massive inline Base64 assets.
              </li>
              <li>
                <b>Sandboxed Execution:</b> HTML capsules execute inside sandboxed iframes. Do not assume access to parent cookies or unauthenticated local storage.
              </li>
              <li>
                <b>Server-Gated Boxes:</b> When you need time windows or max open limits, wrap your URL with <code className="text-cyan-300">POST /api/boxes</code>.
              </li>
            </ul>
          </div>
        </motion.div>
      )}
    </div>
  );
};
