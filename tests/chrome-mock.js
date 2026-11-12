// Browser-test fixture only. Never included in the store package.
(() => {
  function area(seed = {}) {
    const values = structuredClone(seed);
    return { values,
      async get(keys) { if (keys === null) return structuredClone(values); return structuredClone(Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in values).map(key => [key, values[key]]))); },
      async set(updates) { Object.assign(values, structuredClone(updates)); },
      async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
      async setAccessLevel() {},
    };
  }
  globalThis.modelFixtures = [{ id: 'vision-current', created: 1000 }, { id: 'vision-new', created: 2000 }, { id: 'another-api-model', created: 500 }];
  globalThis.sentMessages = [];
  globalThis.chrome = {
    permissions: { contains: async () => true, request: async () => true },
    storage: { local: area({ settingsVersion: 2, apiKey: 'browser-test-fake-key', settings: { selectedModel: 'vision-current' } }), sync: area(), session: area() },
    runtime: { id: 'fixture-extension', getURL: path => `${location.origin}/${path}`, openOptionsPage: async () => {}, sendMessage: async message => { sentMessages.push(message); return { ok: true }; } },
    tabs: { create: async () => ({ id: 1 }) },
  };
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.analysisFetchCount = 0;
  globalThis.fetch = async (url, options) => {
    if (url === 'https://api.openai.com/v1/models') return Response.json({ data: structuredClone(modelFixtures) });
    if (url === 'https://api.openai.com/v1/responses') {
      analysisFetchCount++;
      const response = { status: 'completed', model: 'vision-current', output: [{ type: 'message', content: [{ type: 'output_text', text: 'A clear screenshot. π = 3.14.\n<script>unsafe()</script>' }] }], usage: { total_tokens: 45 } };
      const events = [ { type: 'response.output_text.delta', delta: 'A clear screenshot. ' }, { type: 'response.completed', response } ];
      return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
    }
    return nativeFetch(url, options);
  };
})();
