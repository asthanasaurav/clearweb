class OllamaProvider {
  constructor({ model = 'qwen2.5:3b', endpoint = 'http://127.0.0.1:11434' } = {}) { this.model = model; this.endpoint = endpoint; }
  info() { return { id: 'ollama-qwen', name: 'Qwen', model: this.model, location: 'Local', available: null }; }
  async ask({ prompt, context = '' }) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(`${this.endpoint}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model: this.model, stream: false, messages: [
        { role: 'system', content: 'You are Clearweb, a concise local browser assistant. Use only the supplied page context when asked about the current page. Say when context is insufficient.' },
        { role: 'user', content: `${context ? `PAGE CONTEXT:\n${context}\n\n` : ''}${prompt}` }
      ] }) });
      if (!response.ok) throw new Error(`Local Qwen returned ${response.status}`); const body = await response.json(); return body.message?.content || 'No response from local Qwen.';
    } catch (error) { if (error.name === 'AbortError') throw new Error('Local Qwen timed out'); throw new Error(`Local Qwen is unavailable (${error.message})`); }
    finally { clearTimeout(timeout); }
  }
}
module.exports = { OllamaProvider };
