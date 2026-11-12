import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeImage, readEvents, extractText } from '../api.js';
import { IMAGE, mockChrome } from './helpers.js';
mockChrome();

const settings = { apiKey: 'fake-test-key', selectedModel: 'api-model', reasoningEffort: 'auto' };
function streamResponse(events, chunkSize = 1) {
  const bytes = new TextEncoder().encode(events.map(event => `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  return new Response(new ReadableStream({ start(controller) {
    for (let index = 0; index < bytes.length; index += chunkSize) controller.enqueue(bytes.slice(index, index + chunkSize));
    controller.close();
  } }), { headers: { 'Content-Type': 'text/event-stream' } });
}
test('stream parser preserves split UTF-8 and CRLF across byte-size chunks', async () => {
  const expected = [{ type: 'response.output_text.delta', delta: '日本語 ∑ café 😀\nline' }];
  const output = [];
  for await (const event of readEvents(streamResponse(expected).body)) output.push(event);
  assert.deepEqual(output, expected);
});
test('Responses stream sends one authenticated request and collects completed Unicode text', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0, partial = '';
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer fake-test-key');
    assert.equal(JSON.parse(options.body).apiKey, undefined);
    return streamResponse([
      { type: 'response.output_text.delta', delta: 'Answer: ' },
      { type: 'response.output_text.delta', delta: 'π ≈ 3.14' },
      { type: 'response.completed', response: { status: 'completed', model: 'api-model', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Answer: π ≈ 3.14' }] }], usage: { total_tokens: 22 } } },
    ]);
  };
  try {
    const result = await analyzeImage(IMAGE, settings, { onText: text => { partial = text; } });
    assert.equal(calls, 1); assert.equal(result.text, 'Answer: π ≈ 3.14'); assert.equal(partial, result.text); assert.equal(result.usage.total_tokens, 22);
  } finally { globalThis.fetch = realFetch; }
});
test('incomplete or broken streams are not accepted as completed analyses', async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => streamResponse([{ type: 'response.output_text.delta', delta: 'partial' }]);
    await assert.rejects(analyzeImage(IMAGE, settings), /connection ended/);
    globalThis.fetch = async () => streamResponse([{ type: 'response.incomplete', response: { status: 'incomplete' } }]);
    await assert.rejects(analyzeImage(IMAGE, settings), /output limit/);
  } finally { globalThis.fetch = realFetch; }
});
test('unsupported models and quota errors are actionable and never retried automatically', async () => {
  const realFetch = globalThis.fetch;
  try {
    for (const [code, pattern] of [[401, /key was rejected/], [403, /unavailable/], [429, /quota/], [400, /image-capable Responses model/]]) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'Unsupported option' } }, { status: code }); };
      await assert.rejects(analyzeImage(IMAGE, settings), pattern); assert.equal(calls, 1);
    }
  } finally { globalThis.fetch = realFetch; }
});
test('cancellation passes through to fetch; refusal is safe text', async () => {
  const realFetch = globalThis.fetch; const controller = new AbortController(); controller.abort();
  globalThis.fetch = async (_url, { signal }) => { signal.throwIfAborted(); };
  try { await assert.rejects(analyzeImage(IMAGE, settings, { signal: controller.signal }), { name: 'AbortError' }); }
  finally { globalThis.fetch = realFetch; }
  assert.equal(extractText({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot analyze this.' }] }] }), 'Cannot analyze this.');
});
test('revoked optional host access prevents API requests before they can send a key or image', async () => {
  const realFetch = globalThis.fetch; let calls = 0;
  const originalContains = chrome.permissions.contains;
  chrome.permissions.contains = async () => false;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected request'); };
  try {
    await assert.rejects(analyzeImage(IMAGE, settings), /Allow OpenAI API access/);
    assert.equal(calls, 0);
  } finally { chrome.permissions.contains = originalContains; globalThis.fetch = realFetch; }
});
