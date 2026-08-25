class OllamaProvider {
  constructor({ model = 'qwen2.5:3b', endpoint = 'http://127.0.0.1:11434' } = {}) { this.model = model; this.endpoint = endpoint; }
  info() { return { id: 'ollama-qwen', name: 'Qwen', model: this.model, location: 'Local', available: null }; }
  async ask({ prompt, context = '', options }) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 90_000);
    try {
      const response = await fetch(`${this.endpoint}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ model: this.model, stream: false, ...(options ? { options } : {}), messages: [
        { role: 'system', content: 'You are Clearweb, a concise and capable general-purpose local assistant. Answer general questions directly. When PAGE CONTEXT is supplied and the user asks about the current page, ground the answer only in that context and say when it is insufficient. Never pretend to have live data such as current weather unless it is present in supplied context.' },
        { role: 'user', content: `${context ? `PAGE CONTEXT:\n${context}\n\n` : ''}${prompt}` }
      ] }) });
      if (!response.ok) throw new Error(`Local Qwen returned ${response.status}`); const body = await response.json(); return body.message?.content || 'No response from local Qwen.';
    } catch (error) { if (error.name === 'AbortError') throw new Error('Local Qwen timed out'); throw new Error(`Local Qwen is unavailable (${error.message})`); }
    finally { clearTimeout(timeout); }
  }
}
module.exports = { OllamaProvider };
