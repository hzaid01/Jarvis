import React from 'react';

const Header = React.memo(({ onOpenSettings, onOpenMemory, ollamaStatus = 'connecting', isDarkTheme, onToggleTheme, isMuted, onToggleMute }) => {
  const handleMinimize = () => window.electronAPI?.minimize();
  const handleMaximize = () => window.electronAPI?.maximize();
  const handleClose = () => window.electronAPI?.close();

  const statusLabel = {
    online: 'ONLINE',
    offline: 'OFFLINE',
    connecting: 'CONNECTING',
    'no-model': 'NO MODEL',
  }[ollamaStatus] || 'UNKNOWN';

  const statusClass = ollamaStatus === 'online' ? 'online' : 
                      ollamaStatus === 'offline' ? 'offline' : 
                      ollamaStatus === 'no-model' ? 'offline' : 'connecting';

  return (
    <header className="hud-header">
      {/* Logo */}
      <div className="header-logo">
        <span className="diamond">◈</span>
        <span>JARVIS</span>
        <span style={{ fontSize: '9px', opacity: 0.5, fontWeight: 400 }}>v1.0</span>
      </div>

      {/* Status */}
      <div className="header-status">
        <span className={`status-dot ${statusClass}`}></span>
        <span>{statusLabel}</span>
      </div>

      {/* Window Controls */}
      <div className="header-controls">
        <button className="header-btn" title={isMuted ? "Unmute Voice" : "Mute Voice"} onClick={onToggleMute}>
          {isMuted ? '🔇' : '🔊'}
        </button>
        <button className="header-btn memory-btn" title="Memory Core" onClick={onOpenMemory}>
          🧠
        </button>
        <button className="header-btn" title="Toggle Theme" onClick={onToggleTheme}>
          {isDarkTheme ? '☾' : '☀'}
        </button>
        <button className="header-btn" title="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
        <button className="header-btn" title="Minimize" onClick={handleMinimize}>
          ─
        </button>
        <button className="header-btn" title="Maximize" onClick={handleMaximize}>
          □
        </button>
        <button className="header-btn close" title="Close" onClick={handleClose}>
          ✕
        </button>
      </div>
    </header>
  );
});

export default Header;
