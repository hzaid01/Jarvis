import { useState, useRef, useCallback, useEffect } from 'react';

const OLLAMA_BASE = 'http://localhost:11434';
const MODEL_NAME = 'qwen3.5:4b';

// Fallback system prompt if memory service isn't available
const FALLBACK_PROMPT = `You are JARVIS, an Iron Man style personal AI assistant. Be extremely concise — 2-3 sentences max unless user explicitly asks for detail. No markdown headers. No tables unless asked. Direct answers only. Occasionally say Sir.

LANGUAGE RULES:
- If user speaks in Urdu or Roman Urdu, respond in natural conversational Urdu
- Use natural human Urdu — not formal/robotic
- Mix English technical terms naturally like Pakistanis do
- Example: "Sir, abhi CPU 34% par hai aur sab kuch theek chal raha hai"
- Never use stiff/formal Urdu — keep it natural and conversational
- If user speaks English, respond in English
- Match user's language automatically`;

/**
 * Streaming states:
 * - 'idle'       — no active request
 * - 'waiting'    — request sent, waiting for first token
 * - 'streaming'  — tokens actively arriving
 */

export function useOllama({ onLogEvent } = {}) {
  const [messages, setMessages] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamState, setStreamState] = useState('idle'); // 'idle' | 'waiting' | 'streaming'
  const [ollamaStatus, setOllamaStatus] = useState('connecting'); // 'online' | 'offline' | 'connecting' | 'no-model'
  const abortControllerRef = useRef(null);
  const messagesRef = useRef(messages);
  const turnCountRef = useRef(0); // Track turns for session summarization

  // Keep messagesRef in sync so sendMessage callback doesn't go stale
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Health check on startup ──────────────────────────────────────
  const checkOllamaHealth = useCallback(async () => {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        setOllamaStatus('offline');
        onLogEvent?.('ai::offline — connection refused');
        return false;
      }

      const data = await res.json();
      const models = data.models || [];
      const hasModel = models.some(
        (m) => m.name && m.name.startsWith('qwen3.5')
      );

      if (hasModel) {
        setOllamaStatus('online');
        onLogEvent?.(`ai::${MODEL_NAME} online | engine::ollama`);
        return true;
      } else {
        setOllamaStatus('no-model');
        onLogEvent?.(`ai::model not found — run: ollama pull ${MODEL_NAME}`);
        return false;
      }
    } catch (err) {
      setOllamaStatus('offline');
      onLogEvent?.('ai::offline — is ollama running?');
      return false;
    }
  }, [onLogEvent]);

  // Run health check on mount
  useEffect(() => {
    onLogEvent?.('sys::ready | ai::connecting');
    checkOllamaHealth();

    // Re-check every 30 seconds if offline
    const interval = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        (ollamaStatus === 'offline' || ollamaStatus === 'no-model')
      ) {
        checkOllamaHealth();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send message with streaming ──────────────────────────────────
  const sendMessage = useCallback(
    async (userMessage) => {
      if (!userMessage.trim() || streamState !== 'idle') return;

      const newUserMsg = { role: 'user', content: userMessage };

      // Add user message to history
      setMessages((prev) => [...prev, newUserMsg]);
      setStreamState('waiting');
      setStreamingContent('');
      onLogEvent?.('usr::query received');

      // ── Build dynamic system prompt from memory ──
      let systemPrompt = FALLBACK_PROMPT;
      try {
        const memoryPrompt = await window.electronAPI?.memoryBuildPrompt(userMessage);
        if (memoryPrompt) {
          systemPrompt = memoryPrompt;
        }
      } catch (err) {
        // Memory service unavailable, use fallback
        console.warn('Memory prompt unavailable, using fallback');
      }

      // Build conversation history — keep last 10 messages to stay fast
      const recent = messagesRef.current.slice(-10);
      const conversationHistory = [
        { role: 'system', content: systemPrompt },
        ...recent,
        newUserMsg,
      ];

      try {
        window.electronAPI?.aiStarted();
        abortControllerRef.current = new AbortController();

        const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: MODEL_NAME,
            messages: conversationHistory,
            stream: true,
            options: {
              num_ctx: 2048,
              num_predict: 512,
              num_thread: 4,
              num_gpu: 99,
              repeat_penalty: 1.1
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');

          if (response.status === 404 || errorText.includes('not found')) {
            throw new Error('MODEL_NOT_FOUND');
          }
          throw new Error(`Ollama API error: ${response.status}`);
        }

        // Update status to online if it wasn't
        if (ollamaStatus !== 'online') {
          setOllamaStatus('online');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let buffer = ''; // Buffer for incomplete JSON lines

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep last potentially incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed);

              if (parsed.message?.content) {
                // Switch from 'waiting' to 'streaming' on first token
                if (streamState === 'waiting' || fullResponse === '') {
                  setStreamState('streaming');
                }

                fullResponse += parsed.message.content;
                setStreamingContent(fullResponse);
              }

              // Final chunk
              if (parsed.done === true) {
                break;
              }
            } catch (e) {
              // Malformed JSON line — skip
            }
          }
        }

        // Finalize: move streaming content into message history
        if (fullResponse) {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: fullResponse },
          ]);
          onLogEvent?.('ai::response complete');

          // ── Save this turn to memory (fire and forget) ──
          try {
            window.electronAPI?.memorySaveTurn(userMessage, fullResponse);
          } catch (e) {
            // Memory save is best-effort
          }

          // ── Track turn count for session summarization ──
          turnCountRef.current += 1;
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          // User cancelled — keep whatever was streamed
          const partial = streamingContent;
          if (partial) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: partial + '\n\n[Generation stopped]' },
            ]);
          }
          onLogEvent?.('ai::generation stopped by user');
        } else {
          console.error('Ollama error:', error);

          let errorContent;
          if (error.message === 'MODEL_NOT_FOUND') {
            errorContent = `Model not loaded, Sir. Please run:\n\`ollama pull ${MODEL_NAME}\``;
            onLogEvent?.('ai::error — model not found');
          } else if (
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('ERR_CONNECTION_REFUSED')
          ) {
            errorContent = `Connection failed, Sir. Please ensure Ollama is running on localhost:11434.`;
            setOllamaStatus('offline');
            onLogEvent?.('ai::error — is ollama running?');
          } else {
            errorContent = `An error occurred, Sir.\n\n${error.message}`;
            onLogEvent?.(`ai::error — ${error.message}`);
          }

          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: errorContent, isError: true },
          ]);
        }
      } finally {
        setStreamState('idle');
        setStreamingContent('');
        abortControllerRef.current = null;
        window.electronAPI?.aiStopped();
      }
    },
    [streamState, ollamaStatus, onLogEvent, streamingContent]
  );

  // ── Stop generation ──────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ── Clear chat ───────────────────────────────────────────────────
  const clearChat = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
    setStreamState('idle');
    onLogEvent?.('sys::chat history cleared');
  }, [onLogEvent]);

  return {
    messages,
    streamingContent,
    streamState,       // 'idle' | 'waiting' | 'streaming'
    ollamaStatus,      // 'online' | 'offline' | 'connecting' | 'no-model'
    modelName: MODEL_NAME,
    sendMessage,
    stopGeneration,
    clearChat,
    checkOllamaHealth,
  };
}
