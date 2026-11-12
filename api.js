import { buildRequest, isImageDataUrl } from './config.js';
import { requireApiAccess } from './api-access.js';

export function extractText(response) {
  return (response.output || []).filter(item => item.type === 'message')
    .flatMap(item => item.content || [])
    .map(part => part.type === 'output_text' ? part.text : part.type === 'refusal' ? part.refusal : '')
    .join('\n').trim();
}

// Parse SSE across arbitrary TCP chunks, including split UTF-8 and CRLF boundaries.
export async function* readEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', lines = [];
  function parseLine(line) {
    if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
    if (line === '' && lines.length) {
      const data = lines.join('\n'); lines = [];
      return data === '[DONE]' ? null : JSON.parse(data);
    }
    return null;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary;
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        const event = parseLine(buffer.slice(0, boundary).replace(/\r$/, ''));
        buffer = buffer.slice(boundary + 1);
        if (event) yield event;
      }
      if (done) break;
      if (buffer.length > 2_000_000) throw new Error('The API sent an invalid stream.');
    }
    if (buffer) parseLine(buffer.replace(/\r$/, ''));
    const last = parseLine('');
    if (last) yield last;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function analyzeImage(image, settings, { signal, onText = () => {} } = {}) {
  if (!isImageDataUrl(image)) throw new Error('The screenshot is invalid or too large. Try a smaller selection.');
  if (!settings.apiKey) throw new Error('Add your OpenAI API key in Settings first.');
  await requireApiAccess();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify(buildRequest(image, settings)),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Your API key was rejected. Update it in Settings.');
    if (response.status === 429) throw new Error('OpenAI rate limit or quota reached. Check your API billing, then try again later.');
    if (response.status === 403 || response.status === 404) throw new Error('This model is unavailable for your API account. Choose another model in Settings.');
    if (response.status === 400) throw new Error(`${data.error?.message || 'The selected model or options are incompatible with image analysis.'} Choose an image-capable Responses model, and use Model default reasoning for compatibility.`);
    throw new Error(data.error?.message || `OpenAI returned HTTP ${response.status}.`);
  }
  let final, streamed = '';
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    final = await response.json();
  } else {
    if (!response.body) throw new Error('The API response was empty.');
    for await (const event of readEvents(response.body)) {
      if (event.type === 'response.output_text.delta' || event.type === 'response.refusal.delta') {
        streamed += event.delta || '';
        onText(streamed);
      }
      if (event.type === 'response.completed') final = event.response;
      if (event.type === 'response.incomplete') throw new Error('The response reached its output limit. Try a smaller selection or lower reasoning effort.');
      if (event.type === 'response.failed' || event.type === 'error') throw new Error(event.response?.error?.message || event.message || 'OpenAI could not complete the analysis.');
    }
  }
  if (!final) throw new Error('The connection ended before analysis completed. You can retry.');
  if (final.status === 'incomplete') throw new Error('The response reached its output limit. Try a smaller selection or lower reasoning effort.');
  if (final.error || final.status === 'failed') throw new Error(final.error?.message || 'Analysis failed.');
  const text = extractText(final) || streamed.trim();
  if (!text) throw new Error('The model returned no text. Try a smaller selection or another model.');
  onText(text);
  return { text, usage: final.usage || null, model: final.model || settings.selectedModel };
}
