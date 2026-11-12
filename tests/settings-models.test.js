import test from 'node:test';
import assert from 'node:assert/strict';
import { mockChrome } from './helpers.js';

test('upgrade copies a key before deleting sync, preserving existing model and role', async () => {
  const chrome = mockChrome({ sync: { apiKey: 'fake-old-key', selectedModel: 'user-selected-old-model', analysisRole: 'test_taker' } });
  const { getSettings, saveSettings } = await import('../settings.js?upgrade');
  const originalRemove = chrome.storage.sync.remove;
  chrome.storage.sync.remove = async keys => { assert.equal(chrome.storage.local.values.apiKey, 'fake-old-key'); await originalRemove(keys); };
  const settings = await getSettings();
  assert.equal(settings.apiKey, 'fake-old-key'); assert.equal(settings.selectedModel, 'user-selected-old-model'); assert.equal(settings.analysisRole, 'test_taker');
  assert.equal(chrome.storage.sync.values.apiKey, undefined);
  assert.equal(chrome.storage.local.access, 'TRUSTED_CONTEXTS'); assert.equal(chrome.storage.session.access, 'TRUSTED_CONTEXTS');
  chrome.storage.local.values.modelsCache = { models: ['cached'] };
  await saveSettings({ apiKey: 'new-fake-key' });
  assert.equal(chrome.storage.local.values.modelsCache, undefined);
});
test('failed local migration leaves old synced API key intact', async () => {
  const chrome = mockChrome({ sync: { apiKey: 'fake-key' } });
  chrome.storage.local.set = async () => { throw new Error('Disk full'); };
  const { getSettings } = await import('../settings.js?failed-upgrade');
  await assert.rejects(getSettings(), /Disk full/);
  assert.equal(chrome.storage.sync.values.apiKey, 'fake-key');
});
test('model discovery accepts arbitrary new IDs, sorts, caches, refreshes, and isolates changed keys', async () => {
  const chrome = mockChrome({ local: { settingsVersion: 2, apiKey: 'fake-key', settings: { selectedModel: 'existing-model' } } });
  const realFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/models'); assert.equal(options.headers.Authorization, 'Bearer fake-key');
    return Response.json({ data: [{ id: 'future-model', created: 200 }, { id: 'legacy-model', created: 100 }, { id: 'future-model', created: 200 }, {}] });
  };
  try {
    const { loadModels } = await import('../models.js');
    const first = await loadModels(); assert.deepEqual(first.models.map(model => model.id), ['future-model', 'legacy-model']);
    await loadModels(); assert.equal(calls, 1);
    await loadModels({ refresh: true }); assert.equal(calls, 2);
    globalThis.fetch = async () => { throw new Error('offline'); };
    const fallback = await loadModels({ refresh: true }); assert.equal(fallback.stale, true); assert.match(fallback.error, /offline/);
    chrome.storage.local.values.apiKey = 'different-key';
    await assert.rejects(loadModels({ refresh: true }), /offline/);
  } finally { globalThis.fetch = realFetch; }
});
