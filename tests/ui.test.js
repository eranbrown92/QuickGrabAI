import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mockChrome, IMAGE } from './helpers.js';

async function until(condition) {
  for (let n = 0; n < 100; n++) { if (condition()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error('UI update timed out');
}
test('settings picker displays refreshed API models, persists selection, masks and removes the key', async () => {
  const dom = new JSDOM('<div id="status"></div><div id="form"></div>', { url: 'https://extension.test' });
  globalThis.document = dom.window.document; globalThis.Option = dom.window.Option;
  const chrome = mockChrome({ local: { settingsVersion: 2, apiKey: 'fake-private-test-key-1234', settings: { selectedModel: 'existing-api-model' } } });
  const realFetch = globalThis.fetch; let newModel = false;
  globalThis.fetch = async url => {
    assert.equal(url, 'https://api.openai.com/v1/models');
    return Response.json({ data: [{ id: 'existing-api-model', created: 10 }, ...(newModel ? [{ id: 'newly-launched-api-model', created: 20 }] : [])] });
  };
  try {
    const { mountSettings } = await import('../settings-ui.js');
    await mountSettings(document.getElementById('form'));
    const select = document.getElementById('modelSelection');
    assert.deepEqual([...select.options].map(option => option.value), ['', 'existing-api-model']);
    assert.equal(document.getElementById('apiKey').type, 'password');
    assert.equal(document.body.textContent.includes('fake-private-test-key-1234'), false);
    newModel = true;
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Refresh models').click();
    await until(() => [...select.options].some(option => option.value === 'newly-launched-api-model'));
    select.value = 'newly-launched-api-model'; select.dispatchEvent(new dom.window.Event('change'));
    await until(() => chrome.storage.local.values.settings.selectedModel === 'newly-launched-api-model');
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Remove key').click();
    await until(() => !chrome.storage.local.values.apiKey);
    await until(() => select.disabled);
    assert.equal(chrome.storage.local.values.modelsCache, undefined);
  } finally { globalThis.fetch = realFetch; dom.window.close(); }
});
test('gallery uses plain text for model output and preserves mathematical and non-Latin text', async () => {
  const dom = new JSDOM('<main></main>'); globalThis.document = dom.window.document;
  const { galleryCard } = await import('../ui.js');
  const text = '<img src=x onerror="stolen()"> 日本語 π ∑';
  const card = galleryCard({ id: 'example', timestamp: 1, thumbnail: IMAGE, analysis: text }, () => {});
  document.querySelector('main').append(card);
  assert.equal(card.querySelectorAll('img').length, 1); assert.equal(card.querySelector('script'), null);
  assert.ok(card.textContent.includes(text)); dom.window.close();
});
