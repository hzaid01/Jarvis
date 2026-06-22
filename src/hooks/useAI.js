import { useState, useRef, useCallback, useEffect } from 'react';
import { parseToolCalls, getToolSystemPrompt } from '../utils/toolParser';
import { createProvider, loadProviderConfig, saveProviderConfig } from '../providers/registry';

// Fallback system prompt if memory service isn't available
const FALLBACK_PROMPT = `You are JARVIS — Just A Rather Very Intelligent System.
You are the personal AI of your user running locally on their machine.
Be concise — max 3 sentences unless asked for detail.
Address user as "Sir" occasionally.`;

/**
 * useAI — Main AI hook with tool execution pipeline.
 * 
 * Flow:
 * 1. User message → build system prompt (memory + tool schemas)
 * 2. Send to AI provider (Ollama streaming)
 * 3. Get full response
 * 4. Parse for tool calls → execute via IPC
 * 5. If tool returns data → feed back to AI for summary
 * 6. Display clean text to user
 */
export function useAI({ onLogEvent } = {}) {
  const [messages, setMessages] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamState, setStreamState] = useState('idle');
  const [ollamaStatus, setOllamaStatus] = useState('connecting');
  const [toolExecuting, setToolExecuting] = useState(null);
  const [providerConfig, setProviderConfig] = useState(loadProviderConfig);
  const abortControllerRef = useRef(null);
  const messagesRef = useRef(messages);
  const turnCountRef = useRef(0);
  const providerRef = useRef(null);

  // Create/recreate provider when config changes
  useEffect(() => {
    try {
      providerRef.current = createProvider(providerConfig.type, providerConfig);
      onLogEvent?.(`ai::provider set to ${providerConfig.type}`);
    } catch (e) {
      console.error('Failed to create provider:', e);
      providerRef.current = createProvider('ollama', { model: 'qwen3.5:4b' });
    }
  }, [providerConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Health check (works with any provider) ────────────────────────
  const checkOllamaHealth = useCallback(async () => {
    if (!providerRef.current) return false;
    try {
      const health = await providerRef.current.checkHealth();
      setOllamaStatus(health.status);
      if (health.status === 'online') {
        onLogEvent?.(`ai::${providerConfig.model} online | engine::${providerConfig.type}`);
        return true;
      } else {
        onLogEvent?.(`ai::${health.status} — check ${providerConfig.type} config`);
        return false;
      }
    } catch {
      setOllamaStatus('offline');
      onLogEvent?.(`ai::offline — ${providerConfig.type} unreachable`);
      return false;
    }
  }, [onLogEvent, providerConfig]);

  useEffect(() => {
    onLogEvent?.('sys::ready | ai::connecting');
    checkOllamaHealth();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' &&
        (ollamaStatus === 'offline' || ollamaStatus === 'no-model')) {
        checkOllamaHealth();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load saved chat log on startup ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await window.electronAPI?.loadChatLog();
        if (saved && saved.length > 0) {
          setMessages(saved);
          onLogEvent?.(`mem::loaded ${saved.length} saved messages`);
        }
      } catch {
        console.warn('Failed to load chat log');
      }
    })();
    // Pre-fetch location on startup (warms the cache)
    window.electronAPI?.getLocation?.().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Execute tool calls from AI response ───────────────────────────
  const executeTools = useCallback(async (tools) => {
    const results = [];
    for (const tool of tools) {
      try {
        setToolExecuting(tool.name);
        onLogEvent?.(`tool::${tool.name} executing`);
        const result = await window.electronAPI.executeTool(tool.name, tool.params);
        results.push({ tool: tool.name, ...result });
        onLogEvent?.(`tool::${tool.name} → ${result.success ? 'OK' : 'FAIL'}`);
      } catch (e) {
        results.push({ tool: tool.name, success: false, error: e.message });
        onLogEvent?.(`tool::${tool.name} → ERROR: ${e.message}`);
      }
    }
    setToolExecuting(null);
    return results;
  }, [onLogEvent]);

  // ── Stream from current provider ──────────────────────────────────
  const streamFromProvider = useCallback(async (conversationHistory, signal) => {
    if (!providerRef.current) throw new Error('No AI provider configured');

    setOllamaStatus('online');

    const fullResponse = await providerRef.current.streamChat(conversationHistory, {
      signal,
      onToken: (text) => {
        if (text.length === text.length) setStreamState('streaming');
        setStreamingContent(text);
      },
    });

    return fullResponse;
  }, []);

  // ── Send message (main pipeline) ─────────────────────────────────
  const sendMessage = useCallback(async (userMessage) => {
    if (!userMessage.trim() || streamState !== 'idle') return;

    const newUserMsg = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMsg]);
    setStreamState('waiting');
    setStreamingContent('');
    onLogEvent?.('usr::query received');

    // Build dynamic system prompt (memory + tool schemas)
    let systemPrompt = FALLBACK_PROMPT;
    try {
      const memoryPrompt = await window.electronAPI?.memoryBuildPrompt(userMessage);
      if (memoryPrompt) {
        systemPrompt = memoryPrompt;
      }
    } catch {
      console.warn('Memory prompt unavailable, using fallback');
    }

    // Append tool schema to system prompt
    // Inject real-time context
    let contextLines = '';
    try {
      const [timeData, locData] = await Promise.all([
        window.electronAPI?.getSystemTime?.(),
        window.electronAPI?.getLocation?.(),
      ]);
      if (timeData) {
        contextLines += `\nCurrent Date/Time: ${timeData.date} at ${timeData.time} (${timeData.timezone})\n`;
      }
      if (locData && locData.city !== 'Unknown') {
        contextLines += `User Location: ${locData.city}, ${locData.country}\n`;
      }
    } catch { /* best-effort context injection */ }

    const fullSystemPrompt = systemPrompt + contextLines + '\n' + getToolSystemPrompt();

    const recent = messagesRef.current.slice(-10);
    const conversationHistory = [
      { role: 'system', content: fullSystemPrompt },
      ...recent,
      newUserMsg,
    ];

    try {
      window.electronAPI?.aiStarted?.();
      abortControllerRef.current = new AbortController();

      // Step 1: Get AI response with streaming
      const fullResponse = await streamFromProvider(conversationHistory, abortControllerRef.current.signal);

      if (!fullResponse) {
        setStreamState('idle');
        setStreamingContent('');
        return;
      }

      // Step 2: Parse for tool calls
      const { displayText, tools } = parseToolCalls(fullResponse);

      if (tools.length > 0) {
        // Show clean text first
        const aiTextMsg = { role: 'assistant', content: displayText || 'Executing...' };
        setMessages(prev => [...prev, aiTextMsg]);
        setStreamingContent('');

        // Step 3: Execute tools
        const toolResults = await executeTools(tools);

        // Step 4: Build tool results summary
        const resultSummaries = toolResults.map(r => {
          if (r.success) {
            return `[Tool: ${r.tool}] SUCCESS:\n${r.output}`;
          }
          return `[Tool: ${r.tool}] FAILED: ${r.error || r.output}`;
        }).join('\n\n');

        // Check if any tool returned data worth summarizing
        const hasData = toolResults.some(r =>
          r.success && r.output && r.output.length > 50
        );

        if (hasData) {
          // Step 5: Feed results back to AI for a natural summary
          setStreamState('waiting');
          setStreamingContent('');

          const followUpHistory = [
            { role: 'system', content: systemPrompt + '\n\nBe extremely concise. Summarize the tool output below in 1-3 sentences. No markdown headers.' },
            ...messagesRef.current.slice(-4),
            { role: 'user', content: `Here are the results:\n${resultSummaries}\n\nSummarize this for me briefly.` },
          ];


          const summaryResponse = await streamFromProvider(followUpHistory, abortControllerRef.current.signal);
          if (summaryResponse) {
            const cleanSummary = parseToolCalls(summaryResponse).displayText || summaryResponse;
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: cleanSummary,
              isToolResult: true,
            }]);
          }
        } else {
          // Simple success — just add a status message
          const statusMsg = toolResults.every(r => r.success)
            ? null // AI text already covers it
            : toolResults.filter(r => !r.success).map(r => `❌ ${r.tool}: ${r.error || r.output}`).join('\n');

          if (statusMsg) {
            setMessages(prev => [...prev, {
              role: 'assistant', content: statusMsg, isError: true
            }]);
          }
        }
      } else {
        // No tools — regular response
        setMessages(prev => [...prev, {
          role: 'assistant', content: fullResponse
        }]);
      }

      onLogEvent?.('ai::response complete');

      // Save turn to memory
      try {
        window.electronAPI?.memorySaveTurn(userMessage, displayText || fullResponse);
      } catch { /* best-effort */ }

      // Save chat log to disk
      try {
        const updatedMessages = messagesRef.current;
        window.electronAPI?.saveChatLog(updatedMessages);
      } catch { /* best-effort */ }

      turnCountRef.current += 1;

    } catch (error) {
      if (error.name === 'AbortError') {
        const partial = streamingContent;
        if (partial) {
          setMessages(prev => [...prev, {
            role: 'assistant', content: partial + '\n\n[Generation stopped]'
          }]);
        }
        onLogEvent?.('ai::generation stopped by user');
      } else {
        console.error('AI error:', error);
        let errorContent;
        if (error.message === 'MODEL_NOT_FOUND') {
          errorContent = `Model not loaded, Sir. Please run:\n\`ollama pull ${providerConfig.model}\``;
          onLogEvent?.('ai::error — model not found');
        } else if (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('ERR_CONNECTION_REFUSED')) {
          errorContent = `Connection failed, Sir. Please ensure Ollama is running on localhost:11434.`;
          setOllamaStatus('offline');
          onLogEvent?.('ai::error — is ollama running?');
        } else {
          errorContent = `An error occurred, Sir.\n\n${error.message}`;
          onLogEvent?.(`ai::error — ${error.message}`);
        }
        setMessages(prev => [...prev, {
          role: 'assistant', content: errorContent, isError: true
        }]);
      }
    } finally {
      setStreamState('idle');
      setStreamingContent('');
      abortControllerRef.current = null;
      window.electronAPI?.aiStopped?.();
    }
  }, [streamState, ollamaStatus, onLogEvent, streamingContent, streamFromProvider, executeTools, providerConfig]);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
    setStreamState('idle');
    onLogEvent?.('sys::chat history cleared');
  }, [onLogEvent]);

  // ── Switch provider ───────────────────────────────────────────────
  const switchProvider = useCallback((newConfig) => {
    saveProviderConfig(newConfig);
    setProviderConfig(newConfig);
    setOllamaStatus('connecting');
    onLogEvent?.(`ai::switching to ${newConfig.type} / ${newConfig.model}`);
    // Re-check health after a tick
    setTimeout(() => checkOllamaHealth(), 500);
  }, [onLogEvent, checkOllamaHealth]);

  return {
    messages,
    streamingContent,
    streamState,
    ollamaStatus,
    modelName: providerConfig.model,
    providerType: providerConfig.type,
    providerConfig,
    toolExecuting,
    sendMessage,
    stopGeneration,
    clearChat,
    checkOllamaHealth,
    switchProvider,
  };
}
