import React, { useState, useEffect } from 'react';

const COLOR_THEMES = [
  { id: 'cyan', label: 'Cyan', primary: '#00D4FF', secondary: '#0066FF', dim: 'rgba(0, 212, 255, 0.5)' },
  { id: 'red', label: 'Red', primary: '#FF3B3B', secondary: '#CC0000', dim: 'rgba(255, 59, 59, 0.5)' },
  { id: 'green', label: 'Green', primary: '#39FF14', secondary: '#00CC44', dim: 'rgba(57, 255, 20, 0.5)' },
  { id: 'purple', label: 'Purple', primary: '#BF40FF', secondary: '#7B2FBE', dim: 'rgba(191, 64, 255, 0.5)' },
  { id: 'gold', label: 'Gold', primary: '#FFB800', secondary: '#FF8C00', dim: 'rgba(255, 184, 0, 0.5)' },
  { id: 'pink', label: 'Pink', primary: '#FF6B9D', secondary: '#C44569', dim: 'rgba(255, 107, 157, 0.5)' },
];

const FONT_OPTIONS = [
  { id: 'mono', label: 'Share Tech Mono', value: "'Share Tech Mono', monospace" },
  { id: 'orbitron', label: 'Orbitron', value: "'Orbitron', sans-serif" },
  { id: 'roboto-mono', label: 'Roboto Mono', value: "'Roboto Mono', monospace" },
  { id: 'fira-code', label: 'Fira Code', value: "'Fira Code', monospace" },
  { id: 'jetbrains', label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
];

const POLL_OPTIONS = [
  { label: '3 seconds', value: 3000 },
  { label: '5 seconds (recommended)', value: 5000 },
  { label: '10 seconds (low usage)', value: 10000 },
];

const DEFAULT_SETTINGS = {
  colorTheme: 'cyan',
  bodyFont: 'mono',
  animations: true,
  scanlines: true,
  pollInterval: 5000,
};

function loadSettings() {
  try {
    const saved = localStorage.getItem('jarvis-settings');
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings) {
  try {
    localStorage.setItem('jarvis-settings', JSON.stringify(settings));
  } catch {}
}

function applyTheme(settings) {
  const theme = COLOR_THEMES.find(t => t.id === settings.colorTheme) || COLOR_THEMES[0];
  const font = FONT_OPTIONS.find(f => f.id === settings.bodyFont) || FONT_OPTIONS[0];
  const root = document.documentElement;

  root.style.setProperty('--hud-cyan', theme.primary);
  root.style.setProperty('--hud-blue', theme.secondary);
  root.style.setProperty('--hud-cyan-dim', theme.dim);
  root.style.setProperty('--hud-grid', theme.primary.replace(')', ', 0.08)').replace('rgb', 'rgba').replace('#', ''));
  root.style.setProperty('--hud-border', theme.primary.replace(')', ', 0.2)').replace('rgb', 'rgba'));

  // Convert hex to rgba for border and grid
  const r = parseInt(theme.primary.slice(1, 3), 16);
  const g = parseInt(theme.primary.slice(3, 5), 16);
  const b = parseInt(theme.primary.slice(5, 7), 16);
  root.style.setProperty('--hud-grid', `rgba(${r}, ${g}, ${b}, 0.08)`);
  root.style.setProperty('--hud-border', `rgba(${r}, ${g}, ${b}, 0.2)`);
  root.style.setProperty('--hud-glow', `0 0 15px rgba(${r}, ${g}, ${b}, 0.15)`);
  root.style.setProperty('--hud-glow-strong', `0 0 30px rgba(${r}, ${g}, ${b}, 0.3)`);

  // Font
  document.body.style.fontFamily = font.value;

  // Animations
  if (!settings.animations) {
    document.body.classList.add('no-animations');
  } else {
    document.body.classList.remove('no-animations');
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    applyTheme(settings);
    saveSettings(settings);
  }, [settings]);

  // Load extra Google Fonts on demand
  useEffect(() => {
    const font = FONT_OPTIONS.find(f => f.id === settings.bodyFont);
    if (font && !['mono', 'orbitron'].includes(font.id)) {
      const fontName = font.label.replace(/\s/g, '+');
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  }, [settings.bodyFont]);

  return [settings, setSettings];
}

export default function Settings({ settings, onUpdate, onClose, providerConfig, onSwitchProvider }) {
  const handleColorChange = (themeId) => {
    onUpdate({ ...settings, colorTheme: themeId });
  };

  const handleFontChange = (e) => {
    onUpdate({ ...settings, bodyFont: e.target.value });
  };

  const handlePollChange = (e) => {
    onUpdate({ ...settings, pollInterval: parseInt(e.target.value) });
  };

  const toggleAnimations = () => {
    onUpdate({ ...settings, animations: !settings.animations });
  };

  const toggleScanlines = () => {
    onUpdate({ ...settings, scanlines: !settings.scanlines });
  };

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel">
        <button className="settings-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--hud-border)',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: 'var(--hud-cyan)',
        }}>
          ◈ SETTINGS
        </div>

        {/* Color Theme */}
        <div className="settings-section">
          <div className="settings-section-title">⌐ Color Theme ¬</div>
          <div className="color-swatches">
            {COLOR_THEMES.map(theme => (
              <div
                key={theme.id}
                className={`color-swatch ${settings.colorTheme === theme.id ? 'active' : ''}`}
                style={{ backgroundColor: theme.primary, color: theme.primary }}
                onClick={() => handleColorChange(theme.id)}
                title={theme.label}
              >
                {settings.colorTheme === theme.id ? '✓' : ''}
              </div>
            ))}
          </div>
          <div style={{
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--hud-text-dim)',
            fontFamily: 'Share Tech Mono, monospace',
          }}>
            Active: {COLOR_THEMES.find(t => t.id === settings.colorTheme)?.label || 'Cyan'}
          </div>
        </div>

        {/* Font */}
        <div className="settings-section">
          <div className="settings-section-title">⌐ Body Font ¬</div>
          <select className="settings-select" value={settings.bodyFont} onChange={handleFontChange}>
            {FONT_OPTIONS.map(font => (
              <option key={font.id} value={font.id}>{font.label}</option>
            ))}
          </select>
        </div>

        {/* Poll Interval */}
        <div className="settings-section">
          <div className="settings-section-title">⌐ Stats Refresh Rate ¬</div>
          <select className="settings-select" value={settings.pollInterval} onChange={handlePollChange}>
            {POLL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div style={{
            marginTop: '6px',
            fontSize: '10px',
            color: 'var(--hud-text-dim)',
            fontFamily: 'Share Tech Mono, monospace',
          }}>
            Lower = more responsive, higher = less CPU usage
          </div>
        </div>

        {/* Animations Toggle */}
        <div className="settings-section">
          <div className="settings-section-title">⌐ Performance ¬</div>
          
          <div className="settings-toggle">
            <span style={{ fontSize: '12px', color: 'var(--hud-text)' }}>Animations</span>
            <div
              className={`toggle-switch ${settings.animations ? 'on' : ''}`}
              onClick={toggleAnimations}
            />
          </div>

          <div className="settings-toggle">
            <span style={{ fontSize: '12px', color: 'var(--hud-text)' }}>Scanline Overlay</span>
            <div
              className={`toggle-switch ${settings.scanlines ? 'on' : ''}`}
              onClick={toggleScanlines}
            />
          </div>
        </div>

        {/* AI Provider */}
        {providerConfig && onSwitchProvider && (
          <AIProviderSection config={providerConfig} onSwitch={onSwitchProvider} />
        )}

        {/* Memory */}
        <MemorySection />

        {/* Info */}
        <div style={{
          padding: '12px 16px',
          fontSize: '10px',
          color: 'var(--hud-text-dim)',
          fontFamily: 'Share Tech Mono, monospace',
          lineHeight: 1.6,
        }}>
          JARVIS v2.1 · PC Control Active<br />
          Settings saved automatically to local storage
        </div>
      </div>
    </div>
  );
}

// ── AI Provider Settings Sub-component ──────────────────────────────
function AIProviderSection({ config, onSwitch }) {
  const providerList = React.useMemo(() => {
    // Inline provider list to avoid circular dependency issues
    return [
      { id: 'ollama', label: 'Ollama (Local)', requiresApiKey: false, defaultBaseUrl: 'http://localhost:11434', defaultModel: 'qwen3.5:4b', models: ['qwen3.5:4b', 'llama3.2:3b', 'mistral:7b', 'gemma2:9b', 'phi3:mini'] },
      { id: 'openai', label: 'OpenAI / Compatible', requiresApiKey: true, defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'llama-3.1-8b-instant'] },
      { id: 'gemini', label: 'Google Gemini', requiresApiKey: true, defaultBaseUrl: '', defaultModel: 'gemini-2.0-flash', models: ['gemini-2.0-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06'] },
      { id: 'anthropic', label: 'Anthropic Claude', requiresApiKey: true, defaultBaseUrl: '', defaultModel: 'claude-sonnet-4-20250514', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'] },
    ];
  }, []);

  const current = providerList.find(p => p.id === config.type) || providerList[0];

  const handleProviderChange = (e) => {
    const prov = providerList.find(p => p.id === e.target.value);
    if (prov) {
      onSwitch({
        type: prov.id,
        apiKey: config.type === prov.id ? config.apiKey : '',
        baseUrl: prov.defaultBaseUrl,
        model: prov.defaultModel,
      });
    }
  };

  const handleModelChange = (e) => {
    onSwitch({ ...config, model: e.target.value });
  };

  const handleApiKeyChange = (e) => {
    onSwitch({ ...config, apiKey: e.target.value });
  };

  const handleBaseUrlChange = (e) => {
    onSwitch({ ...config, baseUrl: e.target.value });
  };

  return (
    <div className="settings-section">
      <div className="settings-section-title">⌐ AI Provider ¬</div>

      {/* Provider Dropdown */}
      <select className="settings-select" value={config.type} onChange={handleProviderChange}>
        {providerList.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      {/* Model Dropdown */}
      <div style={{ marginTop: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--hud-text-dim)', marginBottom: '4px', fontFamily: 'Share Tech Mono, monospace' }}>Model</div>
        <select className="settings-select" value={config.model} onChange={handleModelChange}>
          {current.models.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <div style={{ marginTop: '4px' }}>
          <input
            type="text"
            className="settings-select"
            placeholder="Or type custom model name..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px' }}
            value={!current.models.includes(config.model) ? config.model : ''}
            onChange={(e) => { if (e.target.value) handleModelChange(e); }}
            onBlur={(e) => { if (e.target.value) handleModelChange(e); }}
          />
        </div>
      </div>

      {/* API Key (if needed) */}
      {current.requiresApiKey && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--hud-text-dim)', marginBottom: '4px', fontFamily: 'Share Tech Mono, monospace' }}>API Key</div>
          <input
            type="password"
            className="settings-select"
            placeholder="Enter API key..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px' }}
            value={config.apiKey || ''}
            onChange={handleApiKeyChange}
          />
        </div>
      )}

      {/* Custom Base URL (for OpenAI-compatible) */}
      {config.type === 'openai' && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--hud-text-dim)', marginBottom: '4px', fontFamily: 'Share Tech Mono, monospace' }}>Base URL (for custom endpoints)</div>
          <input
            type="text"
            className="settings-select"
            placeholder="https://api.openai.com/v1"
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px' }}
            value={config.baseUrl || ''}
            onChange={handleBaseUrlChange}
          />
          <div style={{ marginTop: '4px', fontSize: '9px', color: 'var(--hud-text-dim)', fontFamily: 'Share Tech Mono, monospace' }}>
            Works with: LM Studio, DeepSeek, Groq, Together AI
          </div>
        </div>
      )}
    </div>
  );
}

// ── Memory Settings Sub-component ───────────────────────────────
function MemorySection() {
  const [chatLogSize, setChatLogSize] = React.useState('0');
  const [clearing, setClearing] = React.useState(false);

  React.useEffect(() => {
    window.electronAPI?.getChatLogSize?.().then(size => setChatLogSize(size || '0')).catch(() => {});
  }, []);

  const handleClear = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await window.electronAPI?.clearChatLog?.();
      setChatLogSize('0');
    } catch {}
    setTimeout(() => setClearing(false), 1000);
  };

  return (
    <div className="settings-section">
      <div className="settings-section-title">⌐ Memory ¬</div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--hud-text)' }}>
          Chat Log: {chatLogSize} KB
        </span>
        <button
          onClick={handleClear}
          style={{
            background: clearing ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 59, 59, 0.1)',
            border: `1px solid ${clearing ? 'rgba(57, 255, 20, 0.3)' : 'rgba(255, 59, 59, 0.3)'}`,
            color: clearing ? '#39FF14' : '#FF3B3B',
            padding: '4px 12px',
            fontSize: '10px',
            fontFamily: 'Share Tech Mono, monospace',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            transition: 'all 0.2s',
          }}
        >
          {clearing ? '✓ CLEARED' : '⊘ CLEAR CHAT HISTORY'}
        </button>
      </div>

      <div style={{
        fontSize: '9px',
        color: 'var(--hud-text-dim)',
        fontFamily: 'Share Tech Mono, monospace',
      }}>
        Last 50 messages are persisted between sessions.
        Memory DB (facts, profile) is stored separately.
      </div>
    </div>
  );
}
