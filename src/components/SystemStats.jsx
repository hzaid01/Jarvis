import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Default props for backward compatibility
const DEFAULT_OLLAMA_STATUS = 'connecting';
const DEFAULT_MODEL = 'qwen3.5:4b';

import CircularGauge from './CircularGauge';
const areEqual = (prevProps, nextProps) => {
  return prevProps.pollInterval === nextProps.pollInterval &&
         prevProps.ollamaStatus === nextProps.ollamaStatus &&
         prevProps.modelName === nextProps.modelName;
};

const SystemStats = React.memo(({ pollInterval = 5000, ollamaStatus = DEFAULT_OLLAMA_STATUS, modelName = DEFAULT_MODEL }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);
  const visibleRef = useRef(true);

  const fetchStats = useCallback(async () => {
    // Skip fetch if window is hidden/minimized
    if (!visibleRef.current) return;

    try {
      if (window.electronAPI?.getSystemStats) {
        const data = await window.electronAPI.getSystemStats();
        if (data) {
          setStats(prev => {
            if (!prev) return data;
            const unchanged = 
              prev.cpu.usage === data.cpu.usage &&
              prev.cpu.cores === data.cpu.cores &&
              prev.memory.usage === data.memory.usage &&
              prev.memory.used === data.memory.used &&
              prev.memory.total === data.memory.total &&
              prev.gpu.usage === data.gpu.usage &&
              prev.gpu.temp === data.gpu.temp &&
              prev.gpu.name === data.gpu.name &&
              prev.gpu.memUsed === data.gpu.memUsed &&
              prev.gpu.memTotal === data.gpu.memTotal &&
              prev.disk.usage === data.disk.usage &&
              prev.disk.used === data.disk.used &&
              prev.disk.total === data.disk.total &&
              prev.network.download === data.network.download &&
              prev.network.upload === data.network.upload;
            return unchanged ? prev : data;
          });
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Stats fetch error:', error);
    }
  }, []);

  useEffect(() => {
    // Listen for visibility changes — pause polling when minimized
    const handleVisibility = () => {
      visibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Initial fetch
    fetchStats();

    // Set up polling
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchStats, pollInterval);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollInterval, fetchStats]);

  const gpuTemp = useMemo(() => {
    return stats?.temperature?.gpu || stats?.gpu?.temp || 0;
  }, [stats]);

  if (loading || !stats) {
    return (
      <div className="left-panel hud-panel" style={{ borderTop: 'none', borderBottom: 'none' }}>
        <div className="panel-title">System Monitor</div>
        <div style={{ 
          padding: '40px 16px', 
          textAlign: 'center', 
          color: 'var(--hud-text-dim)',
          fontSize: '12px',
        }}>
          <div style={{ 
            fontFamily: 'Orbitron, sans-serif', 
            fontSize: '10px', 
            letterSpacing: '0.15em',
            color: 'var(--hud-cyan)',
            marginBottom: '8px',
          }}>
            SCANNING HARDWARE...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="left-panel hud-panel" style={{ borderTop: 'none', borderBottom: 'none' }}>
      <div className="panel-title">System Monitor</div>
      
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '16px' }}>
          <CircularGauge label="CPU" value={stats.cpu.usage} size={95} />
          <CircularGauge 
            label="RAM" 
            value={stats.memory.usage} 
            size={95} 
            subLabel={`${stats.memory.used}/${stats.memory.total} GB`} 
          />
          <CircularGauge label="GPU" value={stats.gpu.usage} size={95} />
          <CircularGauge label="DISK" value={stats.disk.usage} size={95} />
        </div>
        
        <div className="stat-row">
          <div className="stat-label">
            <span>GPU TEMP</span>
            <span className={`stat-value ${gpuTemp > 80 ? 'warning' : ''}`}>
              {gpuTemp}°C
            </span>
          </div>
        </div>

        {stats.gpu.memUsed > 0 && (
          <div className="stat-row">
            <div className="stat-label">
              <span>VRAM</span>
              <span className="stat-value">
                {(stats.gpu.memUsed / 1024).toFixed(1)}/{(stats.gpu.memTotal / 1024).toFixed(1)} GB
              </span>
            </div>
          </div>
        )}

        <div style={{ padding: '4px 16px 8px' }}>
          <div className="stat-label" style={{ marginBottom: '8px' }}>
            <span>NETWORK</span>
          </div>
          <div className="net-stats" style={{ padding: 0 }}>
            <div className="net-stat">
              <span className="arrow">↓</span>
              <span className="value">{stats.network.download}</span>
              <span className="unit">KB/s</span>
            </div>
            <div className="net-stat">
              <span className="arrow" style={{ color: 'var(--hud-blue)' }}>↑</span>
              <span className="value">{stats.network.upload}</span>
              <span className="unit">KB/s</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '4px 16px', borderTop: '1px solid var(--hud-border)' }}>
          <div style={{ 
            fontFamily: 'Share Tech Mono, monospace', 
            fontSize: '10px', 
            color: 'var(--hud-text-dim)',
            letterSpacing: '0.05em'
          }}>
            GPU: {stats.gpu.name}
          </div>
        </div>

        {/* AI Engine Info */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--hud-border)' }}>
          <div style={{ 
            fontFamily: 'Orbitron, sans-serif', 
            fontSize: '9px', 
            letterSpacing: '0.15em',
            color: 'var(--hud-cyan)',
            marginBottom: '6px',
          }}>
            AI ENGINE
          </div>
          <div style={{
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '10px',
            color: 'var(--hud-text-dim)',
            letterSpacing: '0.05em',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}>
            <div>MODEL: <span style={{ color: 'var(--hud-cyan)' }}>{modelName}</span></div>
            <div>ENGINE: <span style={{ color: 'var(--hud-cyan)' }}>Ollama</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              STATUS:
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: ollamaStatus === 'online' ? '#00ff88' : 
                                 ollamaStatus === 'connecting' ? '#ffaa00' : '#ff4444',
                boxShadow: ollamaStatus === 'online' ? '0 0 6px #00ff88' :
                           ollamaStatus === 'connecting' ? '0 0 6px #ffaa00' : '0 0 6px #ff4444',
              }} />
              <span style={{
                color: ollamaStatus === 'online' ? '#00ff88' : 
                       ollamaStatus === 'connecting' ? '#ffaa00' : '#ff4444',
                textTransform: 'uppercase',
              }}>
                {ollamaStatus === 'no-model' ? 'NO MODEL' : ollamaStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}, areEqual);

export default SystemStats;
