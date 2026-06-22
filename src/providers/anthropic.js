import { BaseProvider } from './base';

/**
 * Anthropic Claude provider via REST API.
 */
export class AnthropicProvider extends BaseProvider {
  get name() { return 'anthropic'; }

  async checkHealth() {
    // Anthropic doesn't have a simple models endpoint, just check if key exists
    return { status: this.config.apiKey ? 'online' : 'offline' };
  }

  async streamChat(messages, { signal, onToken } = {}) {
    const model = this.config.model || 'claude-sonnet-4-20250514';
    const apiKey = this.config.apiKey;

    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs = messages.filter(m => m.role !== 'system');

    const body = {
      model,
      max_tokens: 512,
      stream: true,
      messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
    };

    if (systemMsg) body.system = systemMsg.content;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic error ${res.status}: ${text.slice(0, 200)}`);
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
          if (p.type === 'content_block_delta' && p.delta?.text) {
            full += p.delta.text;
            onToken?.(full);
          }
        } catch { /* skip */ }
      }
    }
    return full;
  }
}
