import { BaseProvider } from './base';

/**
 * Google Gemini provider via REST API.
 */
export class GeminiProvider extends BaseProvider {
  get name() { return 'gemini'; }

  async checkHealth() {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      return { status: res.ok ? 'online' : 'offline' };
    } catch {
      return { status: 'offline' };
    }
  }

  async streamChat(messages, { signal, onToken } = {}) {
    const model = this.config.model || 'gemini-2.0-flash';
    const apiKey = this.config.apiKey;

    // Convert chat format to Gemini format
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs = messages.filter(m => m.role !== 'system');

    const contents = chatMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      contents,
      generationConfig: { maxOutputTokens: 512 },
    };

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gemini error ${res.status}: ${text.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const t = line.trim();
        if (!t || !t.startsWith('data:')) continue;
        const data = t.slice(5).trim();
        if (data === '[DONE]') break;
        try {
          const p = JSON.parse(data);
          const text = p.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            full += text;
            onToken?.(full);
          }
        } catch { /* skip */ }
      }
    }
    return full;
  }
}
