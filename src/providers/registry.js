import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { AnthropicProvider } from './anthropic';

/**
 * Provider Registry — Factory for creating AI provider instances.
 * 
 * Supports:
 * - ollama (local, free)
 * - openai (OpenAI, DeepSeek, Groq, LM Studio, Together, any OpenAI-compatible)
 * - gemini (Google)
 * - anthropic (Claude)
 */

const PROVIDER_MAP = {
  ollama: OllamaProvider,
  openai: OpenAIProvider,
  gemini: GeminiProvider,
  anthropic: AnthropicProvider,
};

/**
 * Create a provider instance.
 * @param {string} type - Provider type (ollama, openai, gemini, anthropic)
 * @param {object} config - Provider configuration { apiKey, baseUrl, model }
 * @returns {BaseProvider}
 */
export function createProvider(type, config = {}) {
  const ProviderClass = PROVIDER_MAP[type];
  if (!ProviderClass) {
    throw new Error(`Unknown provider: ${type}. Available: ${Object.keys(PROVIDER_MAP).join(', ')}`);
  }
  return new ProviderClass(config);
}

/** Get list of available provider types with metadata */
export function getProviderList() {
  return [
    {
      id: 'ollama',
      label: 'Ollama (Local)',
      description: 'Free, runs locally. Requires Ollama installed.',
      requiresApiKey: false,
      defaultBaseUrl: 'http://localhost:11434',
      defaultModel: 'qwen3.5:4b',
      models: ['qwen3.5:4b', 'llama3.2:3b', 'mistral:7b', 'gemma2:9b', 'phi3:mini'],
    },
    {
      id: 'openai',
      label: 'OpenAI / Compatible',
      description: 'GPT-4o, DeepSeek, Groq, LM Studio, any OpenAI-compatible API.',
      requiresApiKey: true,
      defaultBaseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'deepseek-chat', 'llama-3.1-8b-instant'],
    },
    {
      id: 'gemini',
      label: 'Google Gemini',
      description: 'Gemini 2.0 Flash, Pro. Free tier available.',
      requiresApiKey: true,
      defaultBaseUrl: '',
      defaultModel: 'gemini-2.0-flash',
      models: ['gemini-2.0-flash', 'gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06'],
    },
    {
      id: 'anthropic',
      label: 'Anthropic Claude',
      description: 'Claude 3.5 Sonnet, Haiku, Opus.',
      requiresApiKey: true,
      defaultBaseUrl: '',
      defaultModel: 'claude-sonnet-4-20250514',
      models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    },
  ];
}

/**
 * Load saved provider config from localStorage.
 */
export function loadProviderConfig() {
  try {
    const saved = localStorage.getItem('jarvis-ai-provider');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {
    type: 'ollama',
    apiKey: '',
    baseUrl: 'http://localhost:11434',
    model: 'qwen3.5:4b',
  };
}

/**
 * Save provider config to localStorage.
 */
export function saveProviderConfig(config) {
  try {
    localStorage.setItem('jarvis-ai-provider', JSON.stringify(config));
  } catch { /* ignore */ }
}
