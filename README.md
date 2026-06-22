# JARVIS — AI Assistant with Iron Man HUD UI

<div align="center">

![JARVIS](https://img.shields.io/badge/Status-Active-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![Platform](https://img.shields.io/badge/Platform-Windows%2011-informational)
![Build](https://img.shields.io/badge/Build-Electron%2B%20React-orange)

**A fully local, privacy-first AI assistant with Tony Stark's HUD-style interface — voice commands, web search, laptop control, and system monitoring in one beautiful dashboard.**

[Features](#features) • [Quick Start](#quick-start) • [Installation](#installation) • [Architecture](#architecture) • [Usage](#usage)

</div>

---

## 📋 Overview

**JARVIS** is a desktop AI assistant that brings the iconic Iron Man interface to life. Everything runs **locally** — no cloud dependencies, no data leaks, complete privacy.

### Core Philosophy
- ✅ **100% Local** — All processing on your machine using Ollama
- ✅ **Privacy-First** — No data leaves your computer
- ✅ **Voice Native** — Talk to JARVIS, don't type
- ✅ **Always Accessible** — Fullscreen, side panel, or floating widget modes
- ✅ **Beautiful UI** — Authentic Iron Man HUD aesthetic with neon glows and animations

---

## ✨ Features

### 🤖 AI Intelligence
- **Local LLM Integration** — Powered by Ollama API running qwen3.5:4b
- **Multi-Provider Support** — Anthropic, OpenAI, Gemini, Ollama providers
- **Context Aware** — Understands system state and user intent

### 🎙️ Voice & Communication
- **Speech-to-Text (STT)** — Whisper.cpp for accurate local voice recognition
- **Text-to-Speech (TTS)** — Piper TTS with multiple voice models
- **Real-time Transcription** — See what JARVIS hears as you speak

### 📊 System Monitoring
- **Live CPU/RAM/GPU Usage** — Real-time hardware metrics
- **Temperature Monitoring** — CPU and system thermal data
- **Network Stats** — Upload/Download speeds and connection status
- **Disk Usage** — Storage capacity visualization

### 🌐 Web & Control
- **Brave Search Integration** — Private web search via API
- **System Control** — Launch apps, manage files, control media via voice
- **Laptop Automation** — Python subprocess execution for advanced tasks

### 🎨 UI/UX
- **Iron Man HUD Design** — Cyan glows, grid lines, corner brackets, scanlines
- **Animated Interface** — Breathing pulse animations, smooth transitions
- **Multiple Window Modes** — Fullscreen, side panel, floating widget
- **Activity Log** — Real-time system status at a glance

### ⚙️ Technical Features
- **Frameless Window** — Custom Electron window styling
- **Responsive Chat** — Markdown rendering with GFM support
- **Fast Development** — Hot reload with Vite
- **Build Optimization** — Production builds with code splitting

---

## 🚀 Quick Start

### Prerequisites
- **Windows 11** (primary target)
- **Node.js 16+** and npm
- **Python 3.9+**
- **Ollama** — [Download here](https://ollama.ai)
- **Git** (for version control)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/jarvis.git
cd jarvis
```

2. **Install Node dependencies**
```bash
npm install
```

3. **Set up Python environment** (optional, for advanced voice features)
```bash
# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate

# Install Python packages
pip install -r requirements.txt
```

4. **Configure Ollama**
   - Download and install [Ollama](https://ollama.ai)
   - Pull the qwen3.5:4b model: `ollama pull qwen3.5:4b`
   - Ensure Ollama is running (default: http://localhost:11434)

5. **Start development server**
```bash
npm run dev
```

This will launch:
- Vite dev server on `http://localhost:5173`
- Electron app with hot reload

---

## 🏗️ Architecture

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Desktop Shell** | Electron 33.3.1 |
| **Frontend Framework** | React 18.3.1 + React DOM |
| **Styling** | Tailwind CSS 3.4.17 |
| **Build Tool** | Vite 6.0.11 |
| **AI Engine** | Ollama API (qwen3.5:4b) |
| **Speech-to-Text** | Whisper.cpp (local) |
| **Text-to-Speech** | Piper TTS (local) |
| **Web Search** | Brave Search API |
| **System Monitoring** | systeminformation 5.22.0 |
| **Database** | SQLite (better-sqlite3 12.9.0) |
| **System Control** | Python subprocess + pyautogui |

### Project Structure

```
jarvis/
├── electron/
│   ├── main.js                 # Electron main process
│   ├── preload.js              # IPC preload bridge
│   ├── memoryService.js        # Memory/history management
│   ├── memorySearch.js         # Memory search engine
│   └── workers/
│       └── statsWorker.js      # System stats background worker
├── src/
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Main app component
│   ├── components/
│   │   ├── ChatCore.jsx        # Chat interface
│   │   ├── SystemStats.jsx     # Hardware monitoring
│   │   ├── ArcReactor.jsx      # AI avatar animation
│   │   ├── Header.jsx          # Top navigation
│   │   ├── StatusBar.jsx       # Bottom status bar
│   │   ├── MemoryPanel.jsx     # Memory/history view
│   │   ├── QuickActions.jsx    # Action buttons
│   │   └── Settings.jsx        # Configuration panel
│   ├── hooks/
│   │   ├── useAI.js            # AI/LLM hook
│   │   └── useOllama.js        # Ollama-specific hook
│   ├── providers/
│   │   ├── ollama.js           # Ollama provider
│   │   ├── openai.js           # OpenAI provider
│   │   ├── anthropic.js        # Anthropic provider
│   │   ├── gemini.js           # Google Gemini provider
│   │   ├── base.js             # Base provider class
│   │   └── registry.js         # Provider registry
│   ├── styles/
│   │   └── hud.css             # HUD-specific styles
│   └── utils/
│       └── toolParser.js       # AI tool/function parsing
├── piper_windows_amd64/        # Piper TTS binaries
├── voice_server.py             # Python voice processing server
├── whisper_bridge.py           # Whisper STT bridge
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind CSS config
├── postcss.config.js           # PostCSS config
├── package.json
├── pyrefly.toml                # Python config
└── index.html

```

### Data Flow

```
User Voice Input
    ↓
Whisper.cpp (whisper_bridge.py)
    ↓
Voice → Text
    ↓
React Chat Component
    ↓
AI Hook (useAI.js)
    ↓
Provider (Ollama/OpenAI/etc)
    ↓
LLM Response
    ↓
Piper TTS (voice_server.py)
    ↓
Audio Output
    ↓
System Control / Web Search / etc
```

---

## 🎮 Usage

### Running the App

**Development Mode** (with hot reload):
```bash
npm run dev
```

**Production Build**:
```bash
npm run build
npm run electron
```

**Dev Server Only** (no Electron):
```bash
npm run dev:vite
```

**Electron Only** (assumes dev server is running):
```bash
npm run dev:electron
```

### Voice Commands

Once the app is running, click the **🎤 SPEAK** button and try:

- "What's the system temperature?"
- "Search for JavaScript tutorials"
- "Open the file manager"
- "What's my RAM usage?"
- "Tell me a joke"

### Configuration

1. Click the **⚙️** icon in the top-right
2. Configure:
   - **AI Provider** (Ollama, OpenAI, Anthropic, Gemini)
   - **Model Selection**
   - **API Keys** (for cloud providers)
   - **Ollama Endpoint** (if not default)
   - **Voice Settings** (voice model, speed)

---

## 🔧 Development

### Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server + Electron with hot reload |
| `npm run dev:vite` | Vite dev server only |
| `npm run dev:electron` | Electron only (requires running dev server) |
| `npm run electron` | Run Electron against `dist/` folder |
| `npm run build` | Build with Vite for production |

### Building Voice Assets

The `piper_windows_amd64/` folder contains pre-built Piper TTS binaries for Windows. To use different voice models:

```bash
# Download additional voices from Piper releases
# Place .onnx and .onnx.json files in piper_windows_amd64/piper/
```

### Python Dependencies

For advanced voice features, ensure Python requirements are installed:

```bash
pip install -r requirements.txt
```

---

## 📝 Environment Variables

Create a `.env` file in the root directory:

```env
# AI Provider Configuration
VITE_AI_PROVIDER=ollama          # or: openai, anthropic, gemini
VITE_OLLAMA_API_URL=http://localhost:11434
VITE_OPENAI_API_KEY=sk-...
VITE_ANTHROPIC_API_KEY=sk-...
VITE_GEMINI_API_KEY=...

# Web Search
VITE_BRAVE_SEARCH_API_KEY=...

# Optional
VITE_DEBUG=false
```

---

## 🛠️ Troubleshooting

### Ollama Connection Failed
- Ensure Ollama is running: `ollama serve`
- Check URL matches VITE_OLLAMA_API_URL
- Default should be `http://localhost:11434`

### Voice Not Working
- Ensure `piper_windows_amd64/piper.exe` exists
- Check audio permissions in Windows Settings
- Verify microphone input is working

### Electron Window Won't Load
- Check terminal for errors
- Ensure Vite dev server is running on port 5173
- Clear `dist/` and rebuild: `npm run build`

### High CPU Usage
- Disable system stats update frequency in Settings
- Close other applications
- Check if Ollama process is consuming resources

---

## 📚 Documentation

- **[PRD (Product Requirements Document)](./JARVIS_PRD_MVP.md)** — Full feature specifications and design
- **[Component Guide](./docs/COMPONENTS.md)** — Detailed component documentation (TODO)
- **[API Reference](./docs/API.md)** — Provider API documentation (TODO)

---

## 🤝 Contributing

This is a personal project, but contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE) file for details.

---

## ⚠️ Disclaimer

JARVIS is a personal AI assistant project inspired by the Iron Man movies. It's designed for local use on Windows 11. All AI processing happens locally — your data never leaves your machine.

---

## 📞 Support

For issues, questions, or feature requests, please open an **Issue** on GitHub.

---

<div align="center">

**Made with ❤️ by a CS student who loves Iron Man and AI**

![JARVIS Status](https://img.shields.io/badge/Status-Production%20Ready-success)

</div>
