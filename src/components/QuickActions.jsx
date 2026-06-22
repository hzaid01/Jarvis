import React from 'react';

const actions = [
  {
    id: 'open-app',
    icon: '⊞',
    label: 'Open App',
    description: 'Launch application',
    action: async (onLogEvent) => {
      const name = prompt('App name to open:');
      if (name) {
        onLogEvent?.(`tool::open_app → ${name}`);
        const result = await window.electronAPI.executeTool('open_app', { app_name: name });
        if (!result.success) alert(`Failed: ${result.error}`);
      }
    },
  },
  {
    id: 'web-search',
    icon: '⊕',
    label: 'Web Search',
    description: 'Search the internet',
    action: async (onLogEvent) => {
      const query = prompt('Search query:');
      if (query) {
        onLogEvent?.(`tool::web_search → ${query}`);
        const result = await window.electronAPI.executeTool('web_search', { query });
        if (result.success) {
          console.log('Search results:', result.output);
        }
      }
    },
  },
  {
    id: 'screenshot',
    icon: '⊡',
    label: 'Screenshot',
    description: 'Capture screen',
    action: async (onLogEvent) => {
      onLogEvent?.('tool::take_screenshot');
      const result = await window.electronAPI.executeTool('take_screenshot', {});
      if (result.success) {
        onLogEvent?.(`tool::screenshot saved`);
      } else {
        alert(`Failed: ${result.error}`);
      }
    },
  },
  {
    id: 'file-manager',
    icon: '⊟',
    label: 'File Manager',
    description: 'Open explorer',
    action: async (onLogEvent) => {
      onLogEvent?.('tool::open_folder');
      await window.electronAPI.executeTool('open_folder', {});
    },
  },
];

const QuickActions = React.memo(({ onLogEvent }) => {
  const handleAction = (action) => {
    onLogEvent?.(`cmd::${action.label.toLowerCase().replace(/\s/g, '_')}`);
    action.action(onLogEvent);
  };

  return (
    <div className="right-panel hud-panel" style={{ borderTop: 'none', borderBottom: 'none' }}>
      <div className="panel-title">Quick Actions</div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {actions.map((action, i) => (
          <button
            key={action.id}
            className="hud-button"
            onClick={() => handleAction(action)}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <span className="icon">{action.icon}</span>
            <div>
              <div>{action.label}</div>
              <div style={{ 
                fontSize: '9px', 
                color: 'var(--hud-text-dim)', 
                fontFamily: 'Share Tech Mono, monospace',
                letterSpacing: '0.05em',
                textTransform: 'none',
              }}>
                {action.description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* System Info Section */}
      <div style={{ 
        marginTop: 'auto', 
        padding: '12px 16px',
        borderTop: '1px solid var(--hud-border)',
      }}>
        <div style={{
          fontFamily: 'Orbitron, sans-serif',
          fontSize: '9px',
          letterSpacing: '0.12em',
          color: 'var(--hud-text-dim)',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}>
          System Info
        </div>
        <div style={{
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: '10px',
          color: 'var(--hud-text-dim)',
          lineHeight: '1.8',
        }}>
          <div>OS: Windows 11</div>
          <div>AI: qwen3.5:4b (local)</div>
          <div>Engine: Ollama</div>
          <div>PC Control: <span style={{ color: '#4ADE80' }}>● Active</span></div>
        </div>
      </div>
    </div>
  );
});

export default QuickActions;
