import { BaseProvider } from './base';

/**
 * OpenAI-compatible provider.
 * Works with: OpenAI, DeepSeek, Groq, LM Studio, Together AI, any OpenAI-compatible API.
 */
export class OpenAIProvider extends BaseProvider {
  get name() { return 'openai'; }

  async checkHealth() {
    try {
      const base = this.config.baseUrl || 'https://api.openai.com/v1';
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey || ''}` },
        signal: AbortSignal.timeout(5000),
      });
      return { status: res.ok ? 'online' : 'offline' };
    } catch {
      return { status: 'offline' };
    }
  }

  async streamChat(messages, { signal, onToken } = {}) {
    const base = this.config.baseUrl || 'https://api.openai.com/v1';
    const model = this.config.model || 'gpt-4o-mini';

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`);
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
          const delta = p.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onToken?.(full);
          }
        } catch { /* skip */ }
      }
    }
    return full;
  }
}
