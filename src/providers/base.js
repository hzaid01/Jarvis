/**
 * Base provider interface — all AI providers must implement this.
 */
export class BaseProvider {
  constructor(config = {}) {
    this.config = config;
  }

  /** Provider display name */
  get name() { return 'base'; }

  /** Check if provider is available/configured */
  async checkHealth() { return false; }

  /**
   * Stream a chat completion.
   * @param {Array} messages - Conversation history [{ role, content }]
   * @param {object} options - { signal, onToken }
   * @returns {Promise<string>} Full response text
   */
  async streamChat(messages, { signal, onToken } = {}) {
    throw new Error('streamChat not implemented');
  }
}
