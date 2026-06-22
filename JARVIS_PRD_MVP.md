# JARVIS — Product Requirements Document (PRD) + MVP Prompt

---

## 1. PROJECT OVERVIEW

**Project Name:** JARVIS  
**Type:** Desktop Application (Electron)  
**Platform:** Windows 11  
**Purpose:** A fully local, privacy-first AI assistant with Iron Man HUD-style UI — voice commands, web search, laptop control, and system monitoring in one dashboard.

---

## 2. CORE PHILOSOPHY

- Everything runs LOCAL — no cloud, no data leaks
- AI Brain: qwen3.5:4b via Ollama API
- UI must feel like Tony Stark's actual HUD — not a toy, not a chatbot
- User never types unless they want to — voice is primary input
- The app is ALWAYS visible — either fullscreen, side panel, or floating

---

## 3. TARGET USER

Single user (you). CS student + trader + developer. Wants a personal AI that:
- Controls laptop via voice
- Searches the web privately
- Shows system stats live
- Responds intelligently via Gemma4

---

## 4. TECH STACK

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron (Windows) |
| Frontend | React + Tailwind CSS |
| AI Brain | Ollama API → qwen3.5:4b |
| Voice Input (STT) | Whisper.cpp (local) |
| Voice Output (TTS) | Piper TTS (local) |
| Web Search | Brave Search API (free tier) |
| Laptop Control | Python subprocess + pyautogui |
| System Stats | Node.js `systeminformation` package |

---

## 5. UI DESIGN SPECIFICATION

### Visual Theme
- **Style:** Iron Man HUD — Tony Stark's FRIDAY/JARVIS interface
- **Colors:**
  - Background: `#020810` (near black with deep blue tint)
  - Primary Glow: `#00D4FF` (electric cyan)
  - Secondary: `#0066FF` (deep electric blue)
  - Accent: `#FF6B00` (Iron Man gold/orange for warnings)
  - Text: `#E0F4FF` (cold white)
  - Grid lines: `rgba(0, 212, 255, 0.08)`
- **Font:** `Orbitron` for headings/labels, `Share Tech Mono` for data/chat
- **Effects:**
  - Animated HUD grid lines (subtle, slow pan)
  - Neon glow on all borders (`box-shadow: 0 0 15px #00D4FF40`)
  - Scanline overlay (CSS pseudo-element, 3% opacity)
  - Corner bracket decorations on every panel (like targeting reticles)
  - Breathing pulse animation on the AI avatar/orb

### Layout (Dashboard — Single Screen)
```
┌─────────────────────────────────────────────────────┐
│  [JARVIS]              [STATUS: ONLINE]    [⚙] [✕]  │  ← Header Bar
├──────────────┬──────────────────┬───────────────────┤
│              │                  │                   │
│  SYSTEM      │   AI CORE        │   QUICK ACTIONS   │
│  STATS       │   (Chat + Voice) │                   │
│              │                  │  [Open App]       │
│  CPU: ██░░   │  ◉ Listening...  │  [Web Search]     │
│  RAM: ███░   │                  │  [Screenshot]     │
│  GPU: ██░░   │  > User message  │  [File Manager]   │
│  DISK: ████  │  > JARVIS reply  │  [Settings]       │
│              │                  │                   │
│  TEMP: 65°C  │  [────────────]  │                   │
│  NET: ↑↓     │  [🎤 SPEAK]      │                   │
│              │                  │                   │
├──────────────┴──────────────────┴───────────────────┤
│  [ACTIVITY LOG]  sys::ready | ai::online | net::ok  │  ← Status Bar
└─────────────────────────────────────────────────────┘
```

---

## 6. MVP FEATURES (Phase 1 — Build This First)

### Must Have (MVP)
1. **HUD Dashboard UI** — Full design as above, Electron window, frameless
2. **Chat Interface** — Type messages, Gemma4 e2b responds via Ollama
3. **Live System Stats** — CPU, RAM, GPU usage, Temperature, Network
4. **Voice Input Button** — Click mic button → speak → text appears in chat
5. **Activity Log Bar** — Bottom status bar showing system events
6. **Window Modes** — Toggle between Fullscreen / Side Panel / Floating widget

### NOT in MVP (Phase 2+)
- Actual voice STT (Whisper) — Phase 2
- Laptop control commands — Phase 2
- Web search integration — Phase 2
- Trading alerts — Phase 3

---

## 7. FILE STRUCTURE

```
jarvis/
├── electron/
│   ├── main.js          ← Electron entry, window creation
│   └── preload.js       ← Bridge between renderer and Node
├── src/
│   ├── App.jsx          ← Main React component
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── SystemStats.jsx
│   │   ├── ChatCore.jsx
│   │   ├── QuickActions.jsx
│   │   └── StatusBar.jsx
│   ├── hooks/
│   │   └── useOllama.js  ← Ollama API calls
│   └── styles/
│       └── hud.css       ← HUD animations, glow effects
├── package.json
└── vite.config.js
```

---

## 8. OLLAMA INTEGRATION

```javascript
// Call Gemma4 e2b via Ollama local API
const response = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3.5:4b',
    messages: conversationHistory,
    stream: true  // Stream responses token by token
  })
});
```

---

## 9. SYSTEM PROMPT FOR JARVIS PERSONALITY

```
You are JARVIS — Just A Rather Very Intelligent System.
You are the personal AI assistant of your user. You are sharp, concise, and intelligent.
You do not ramble. You do not add unnecessary caveats.
You address the user as "Sir" occasionally, like the real JARVIS.
You are running locally on the user's machine — all data stays private.
When executing commands, confirm before acting on anything destructive.
Keep responses short unless user asks for detail.
Current capabilities: conversation, system info, web search (when enabled).
```

---

## 10. ANTIGRAVITY PROMPT (Copy-Paste This)

---

### FULL PROMPT FOR ANTIGRAVITY:

```
Build a desktop application called JARVIS using Electron + React + Tailwind CSS.

DESIGN REQUIREMENTS:
- Iron Man HUD aesthetic — dark background (#020810), electric cyan (#00D4FF) glow, deep blue (#0066FF) accents, Iron Man orange (#FF6B00) for alerts
- Font: Orbitron for headings/labels, Share Tech Mono for chat/data text (import from Google Fonts)
- Animated HUD grid lines in background (subtle CSS animation, slow horizontal pan)
- Scanline overlay effect on entire app (CSS pseudo-element, very subtle)
- Corner bracket decorations (⌐ ¬ style) on every panel/card — like targeting reticles
- Neon glow borders on all panels: box-shadow cyan glow
- Breathing pulse animation on the AI status orb (center panel)
- Frameless Electron window with custom drag region in header

LAYOUT — Single Dashboard Screen:
┌─────────────────────────────────────────────────────┐
│  [◈ JARVIS v1.0]        [● ONLINE]    [⚙] [-] [✕]  │  Header (draggable)
├──────────────┬──────────────────┬───────────────────┤
│  SYSTEM      │   AI CORE        │   QUICK ACTIONS   │
│  STATS       │                  │                   │
│              │  Glowing orb     │  4 action buttons │
│  CPU bar     │  in center       │  (Open App,       │
│  RAM bar     │                  │  Web Search,      │
│  GPU bar     │  Chat messages   │  Screenshot,      │
│  DISK bar    │  scroll area     │  File Manager)    │
│  TEMP        │                  │                   │
│  NET ↑↓      │  [🎤 SPEAK] btn  │                   │
├──────────────┴──────────────────┴───────────────────┤
│  ACTIVITY LOG: sys::ready | ai::online | time       │  Status Bar
└─────────────────────────────────────────────────────┘

FUNCTIONAL REQUIREMENTS:

1. SYSTEM STATS PANEL (left):
   - Real-time CPU, RAM, GPU usage using 'systeminformation' npm package
   - Animated progress bars with cyan glow
   - CPU temperature, Network upload/download speed
   - Update every 2 seconds

2. AI CORE PANEL (center):
   - Glowing animated orb at top (CSS pulse animation, cyan)
   - Chat message area below orb — scrollable
   - User messages: right-aligned, cyan border
   - JARVIS replies: left-aligned, blue border, "JARVIS >" prefix
   - Text input at bottom + microphone button
   - Connect to Ollama API at http://localhost:11434/api/chat
   - Model: qwen3.5:4b
   - Streaming responses (token by token display)
   - System prompt: "You are JARVIS, a sharp personal AI assistant. Address user as Sir occasionally. Be concise. Running locally, all data private."

3. QUICK ACTIONS PANEL (right):
   - 4 buttons with HUD styling
   - Open App: opens Windows run dialog (placeholder for now)
   - Web Search: opens browser with query
   - Screenshot: captures screen
   - File Manager: opens Windows Explorer
   - Each button has cyan icon + label + subtle hover glow animation

4. STATUS BAR (bottom):
   - Scrolling activity log
   - Shows: timestamp, AI status, system events
   - Auto-appends new events

5. WINDOW CONTROLS (header):
   - Custom minimize, maximize, close buttons (no default OS chrome)
   - Settings gear icon (placeholder)

ELECTRON SETUP:
- Frameless window: true
- Transparent: false
- Width: 1200px, Height: 750px
- Background: #020810
- Always on top: false (toggleable)
- Node integration via contextBridge/preload.js

ANIMATIONS:
- HUD grid background: slow CSS keyframe pan
- Orb: breathing scale + opacity pulse (2s loop)
- Panel load: staggered fade-in from bottom (animation-delay per panel)
- Button hover: glow intensifies + slight scale up
- New chat message: slide in from side

Make this look like something from a Marvel movie — not a demo app. Every pixel should feel intentional. Use CSS variables for all colors. No placeholder gray boxes — everything must be styled.

Start with: package.json → main.js → preload.js → App.jsx → all components → hud.css
```

---

## 11. PHASES ROADMAP

| Phase | What | When |
|-------|------|------|
| **MVP (Now)** | HUD UI + Chat + System Stats | Build now in Antigravity |
| **Phase 2** | Voice STT (Whisper) + TTS (Piper) | After MVP done |
| **Phase 3** | Laptop control (open apps, files, commands) | After voice |
| **Phase 4** | Web search (Brave API / SearXNG) | After control |
| **Phase 5** | Trading alerts from ClawBot | After search |
