import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ArcReactor from './ArcReactor';

const MemoizedMessage = memo(({ msg, isResponded }) => (
  <div className={`chat-message ${msg.role === 'user' ? 'user' : 'jarvis'} ${msg.isError ? 'error' : ''}`}>
    <div className="sender">
      {msg.role === 'user' ? '> USER' : '> JARVIS'}
    </div>
    {msg.role === 'user' ? (
      <div style={{ position: 'relative', paddingBottom: '12px' }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
        <div style={{ position: 'absolute', bottom: '-4px', right: '0', fontSize: '10px', color: isResponded ? 'var(--hud-cyan)' : 'var(--hud-text-dim)', letterSpacing: '2px', fontWeight: 'bold' }}>
          {isResponded ? '✓✓' : '✓'}
        </div>
      </div>
    ) : (
      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
      </div>
    )}
  </div>
));

export default function ChatCore({ ollamaHook, onLogEvent, ttsSpeaking, stopTTS }) {
  const {
    messages,
    streamingContent,
    streamState,
    sendMessage,
    stopGeneration,
    toolExecuting,
  } = ollamaHook;

  const [input, setInput] = useState('');
  const [isMicActive, setIsMicActive] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState('initializing');
  const [visibleCount, setVisibleCount] = useState(50);
  
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const filteredMessages = useMemo(() => {
    return messages.filter(m => m.role !== 'system');
  }, [messages]);

  const slicedMessages = useMemo(() => {
    return filteredMessages.slice(-visibleCount);
  }, [filteredMessages, visibleCount]);

  useEffect(() => {
    // Listen for transcription from RealtimeSTT
    const removeVoiceText = window.electronAPI.onVoiceText((text) => {
      if (text) {
        onLogEvent?.(`voice::heard — ${text}`);
        if (ttsSpeaking) stopTTS();
        sendMessage(text);
      }
    });

    // Listen for status updates
    const removeVoiceStatus = window.electronAPI.onVoiceStatus((status) => {
      if (status.startsWith('using_device_')) {
        setVoiceStatusText('waiting for wake word');
        setIsMicActive(true);
        onLogEvent?.(`sys::${status}`);
      } else if (status === 'listening') {
        setIsMicActive(true);
        setIsTranscribing(false);
        setVoiceStatusText('listening');
        onLogEvent?.('sys::mic listening');
      } else if (status === 'processing') {
        setIsTranscribing(true);
        setVoiceStatusText('processing');
        onLogEvent?.('sys::processing audio');
      } else if (status === 'ready') {
        setIsMicActive(true);
        setIsTranscribing(false);
        setVoiceStatusText('waiting for wake word');
      }
    });

    return () => {
      // Cleanup
      if (typeof removeVoiceText === 'function') removeVoiceText();
      if (typeof removeVoiceStatus === 'function') removeVoiceStatus();
    };
  }, [onLogEvent, sendMessage, ttsSpeaking, stopTTS]);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    onLogEvent?.(`usr::query → "${input.slice(0, 30)}${input.length > 30 ? '...' : ''}"`);
    if (ttsSpeaking) stopTTS();
    sendMessage(input);
    setInput('');
    inputRef.current?.focus();
  }, [input, onLogEvent, ttsSpeaking, stopTTS, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const isActive = streamState !== 'idle';
  const isOrbActive = streamState === 'streaming' || ttsSpeaking;

  return (
    <div className="center-panel hud-panel" style={{ display: 'flex', flexDirection: 'column', borderTop: 'none', borderBottom: 'none' }}>
      <div className="chat-internal-scanline" />
      {/* AI Orb / Arc Reactor */}
      <div className="ai-orb-container">
        <ArcReactor streaming={isOrbActive} />
      </div>
      <div style={{
        textAlign: 'center',
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '10px',
        letterSpacing: '0.2em',
        color: 'var(--hud-cyan)',
        paddingBottom: '8px',
        textShadow: '0 0 8px var(--hud-cyan-dim)',
      }}>
        {streamState === 'waiting' && '◉ PROCESSING...'}
        {streamState === 'streaming' && !toolExecuting && '◉ STREAMING RESPONSE...'}
        {toolExecuting && `⚡ EXECUTING: ${toolExecuting.toUpperCase()}...`}
        {streamState === 'idle' && ttsSpeaking && '◉ AUDIO PLAYBACK...'}
        {streamState === 'idle' && !ttsSpeaking && !toolExecuting && '◉ AI CORE ACTIVE'}
      </div>

      {/* Chat Messages */}
      <div className="chat-container">
        {slicedMessages.length === 0 && streamState === 'idle' && (
          <div style={{
            textAlign: 'center',
            color: 'var(--hud-text-dim)',
            fontSize: '12px',
            padding: '40px 20px',
            fontStyle: 'italic',
          }}>
            <div style={{ 
              fontFamily: 'Orbitron, sans-serif', 
              fontSize: '11px', 
              letterSpacing: '0.15em',
              color: 'var(--hud-cyan)',
              marginBottom: '8px',
            }}>
              JARVIS INITIALIZED
            </div>
            <div>Systems online. Awaiting input, Sir.</div>
          </div>
        )}

        {filteredMessages.length > visibleCount && (
          <button 
            onClick={() => setVisibleCount(prev => prev + 50)} 
            className="load-more-button"
            style={{
              display: 'block',
              margin: '10px auto',
              padding: '6px 12px',
              backgroundColor: 'transparent',
              border: '1px solid var(--hud-border)',
              color: 'var(--hud-cyan)',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: '10px',
              cursor: 'pointer',
              borderRadius: '3px',
              letterSpacing: '0.1em',
              transition: 'all 0.2s ease',
            }}
          >
            ▲ LOAD MORE MESSAGES
          </button>
        )}

        {/* Render finalized messages from history */}
        {slicedMessages.map((msg, i) => {
          const originalIndex = filteredMessages.indexOf(msg);
          const isResponded = msg.role === 'user' && (originalIndex < filteredMessages.length - 1 || streamState !== 'idle');
          return <MemoizedMessage key={originalIndex} msg={msg} isResponded={isResponded} />;
        })}

        {/* Streaming: "waiting for first token" state */}
        {streamState === 'waiting' && (
          <div className="chat-message jarvis">
            <div className="sender">&gt; JARVIS</div>
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        {/* Streaming: live tokens arriving */}
        {streamState === 'streaming' && streamingContent && (
          <div className="chat-message jarvis streaming">
            <div className="sender">&gt; JARVIS</div>
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
              <span className="streaming-cursor">▋</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <style>{`
        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(0, 255, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0); }
        }
        .mic-pulse {
          animation: pulseGreen 2s infinite;
          border-color: #00ff00 !important;
          color: #00ff00 !important;
        }
      `}</style>
      <div style={{ padding: '0 20px', fontSize: '10px', color: 'var(--hud-cyan)', marginBottom: '4px', textTransform: 'uppercase' }}>
        {voiceStatusText === 'waiting for wake word' && '🎤 WAITING FOR WAKE WORD...'}
        {voiceStatusText === 'listening' && '🎤 LISTENING...'}
        {voiceStatusText === 'processing' && '⚙ PROCESSING...'}
      </div>
      <div className="chat-input-area">
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Enter command or query..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isActive}
        />
        <button
          className={`mic-button ${isMicActive ? 'active' : ''} ${isTranscribing ? 'transcribing' : ''} ${isMicActive && voiceStatusText === 'waiting for wake word' ? 'mic-pulse' : ''}`}
          style={{ cursor: 'default' }}
          title={`Realtime Voice Active: ${voiceStatusText}`}
        >
          {isTranscribing ? '⌛' : '🎤'}
        </button>
        {isActive ? (
          <button className="send-button" onClick={stopGeneration} title="Stop">
            ■
          </button>
        ) : (
          <button className="send-button" onClick={handleSend} title="Send">
            ▶
          </button>
        )}
      </div>
    </div>
  );
}
