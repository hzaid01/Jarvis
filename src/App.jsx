import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import SystemStats from './components/SystemStats';
import ChatCore from './components/ChatCore';
import QuickActions from './components/QuickActions';
import StatusBar from './components/StatusBar';
import Settings, { useSettings } from './components/Settings';
import MemoryPanel from './components/MemoryPanel';
import { useAI } from './hooks/useAI';

export default function App() {
  const [settings, setSettings] = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // Theme state
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('jarvis-theme');
      return saved ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  // Voice state
  const [isMuted, setIsMuted] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const lastMessageCount = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem('jarvis-theme', isDarkTheme ? 'dark' : 'light');
    } catch {}
    
    if (isDarkTheme) {
      document.documentElement.classList.add('theme-dark');
      document.documentElement.classList.remove('theme-light');
    } else {
      document.documentElement.classList.add('theme-light');
      document.documentElement.classList.remove('theme-dark');
    }
  }, [isDarkTheme]);

  const toggleTheme = () => setIsDarkTheme(prev => !prev);
  const toggleMute = () => {
    setIsMuted(prev => !prev);
    if (!isMuted) {
      stopTTS();
    }
  };

  const addLogEvent = useCallback((event) => {
    const parts = event.split('::');
    const type = parts[0] || 'sys';
    const message = parts.slice(1).join('::') || event;
    
    setLogs(prev => {
      const updated = [...prev, { type, message }];
      if (updated.length > 30) return updated.slice(-30);
      return updated;
    });
  }, []);

  const ollamaHook = useAI({ onLogEvent: addLogEvent });

  const stopTTS = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    window.electronAPI.stopSpeaking();
    setTtsSpeaking(false);
  }, []);

  const playTTS = useCallback(async (text) => {
    try {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
        sourceNodeRef.current = null;
      }
      setTtsSpeaking(true);
      const arrayBuffer = await window.electronAPI.speakText(text);
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        if (!audioContextRef.current) {
          audioContextRef.current = new window.AudioContext();
        }
        let bufferForAudio = arrayBuffer;
        if (arrayBuffer instanceof Uint8Array) {
          bufferForAudio = arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
        }
        const audioBuffer = await audioContextRef.current.decodeAudioData(bufferForAudio);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        sourceNodeRef.current = source;
        source.onended = () => {
          setTtsSpeaking(false);
        };
        source.start();
      } else {
        setTtsSpeaking(false);
      }
    } catch (e) {
      console.error('TTS playback error:', e);
      setTtsSpeaking(false);
    }
  }, [stopTTS]);

  // Watch for new AI messages and speak them
  useEffect(() => {
    const currentLen = ollamaHook.messages.length;
    if (ollamaHook.streamState === 'idle' && currentLen > lastMessageCount.current) {
      const lastMsg = ollamaHook.messages[currentLen - 1];
      if (lastMsg.role === 'assistant' && !isMuted) {
         playTTS(lastMsg.content);
      }
      lastMessageCount.current = currentLen;
    } else if (ollamaHook.streamState === 'streaming' && ttsSpeaking) {
       // Stop speaking if a new stream starts
       stopTTS();
    } else if (ollamaHook.streamState === 'idle' && currentLen === lastMessageCount.current) {
       // Initialize on first render
       lastMessageCount.current = currentLen;
    }
  }, [ollamaHook.messages, ollamaHook.streamState, isMuted, playTTS, ttsSpeaking, stopTTS]);

  // Pause animations when window is not focused
  useEffect(() => {
    const onBlur = () => document.body.classList.add('window-blurred');
    const onFocus = () => document.body.classList.remove('window-blurred');

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <div className="dashboard">
      <div className="global-scanline-sweep" />
      <div className="hud-grid-bg" />
      {settings.scanlines && <div className="scanline-overlay" />}

      <Header
        onOpenSettings={() => setShowSettings(true)}
        onOpenMemory={() => setShowMemory(true)}
        ollamaStatus={ollamaHook.ollamaStatus}
        isDarkTheme={isDarkTheme}
        onToggleTheme={toggleTheme}
        isMuted={isMuted}
        onToggleMute={toggleMute}
      />

      <div className="dashboard-content">
        <SystemStats
          pollInterval={settings.pollInterval}
          ollamaStatus={ollamaHook.ollamaStatus}
          modelName={ollamaHook.modelName}
        />
        <ChatCore
          ollamaHook={ollamaHook}
          onLogEvent={addLogEvent}
          ttsSpeaking={ttsSpeaking}
          stopTTS={stopTTS}
        />
        <QuickActions onLogEvent={addLogEvent} />
      </div>

      <StatusBar logs={logs} />

      {showSettings && (
        <Settings
          settings={settings}
          onUpdate={setSettings}
          onClose={() => setShowSettings(false)}
          providerConfig={ollamaHook.providerConfig}
          onSwitchProvider={ollamaHook.switchProvider}
        />
      )}

      {showMemory && (
        <MemoryPanel onClose={() => setShowMemory(false)} />
      )}
    </div>
  );
}
