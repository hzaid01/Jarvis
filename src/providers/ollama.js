import { BaseProvider } from './base';

export class OllamaProvider extends BaseProvider {
  get name() { return 'ollama'; }

  async checkHealth() {
    try {
      const base = this.config.baseUrl || 'http://localhost:11434';
      const model = this.config.model || 'qwen3.5:4b';
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { status: 'offline' };
      const data = await res.json();
      const models = data.models || [];
      const prefix = model.split(':')[0];
      const found = models.some(m => m.name && m.name.startsWith(prefix));
      return { status: found ? 'online' : 'no-model', models };
    } catch {
      return { status: 'offline' };
    }
  }

  async streamChat(messages, { signal, onToken } = {}) {
    const base = this.config.baseUrl || 'http://localhost:11434';
    const model = this.config.model || 'qwen3.5:4b';

    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        think: false,
        options: {
          num_ctx: 2048,
          num_predict: 512,
          num_thread: 4,
          num_gpu: 99,
          repeat_penalty: 1.1
        },
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 404 || text.includes('not found')) throw new Error('MODEL_NOT_FOUND');
      throw new Error(`Ollama error: ${res.status}`);
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
        if (!t) continue;
        try {
          const p = JSON.parse(t);
          if (p.message?.content) {
            full += p.message.content;
            onToken?.(full);
          }
          if (p.done) break;
        } catch { /* skip */ }
      }
    }
    return full;
  }
}
