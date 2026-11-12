import test from 'node:test';
import assert from 'node:assert/strict';
import { mockChrome, IMAGE } from './helpers.js';

test('capture handoff checks sender and one-use token, and never injects or stores a job key', async () => {
  const chrome = mockChrome({ local: { settingsVersion: 2, apiKey: 'secret-test-key', settings: { selectedModel: 'api-model' } } });
  const scripts = [], opened = [];
  chrome.tabs = {
    query: async () => [{ id: 10, windowId: 2, url: 'https://example.com' }],
    captureVisibleTab: async windowId => { assert.equal(windowId, 2); return IMAGE; },
    create: async options => { opened.push(options); return { id: 11 }; },
  };
  chrome.scripting = { executeScript: async options => { scripts.push(options); } };
  const { handleMessage } = await import('../background.js');
  const pageSender = { id: chrome.runtime.id, url: chrome.runtime.getURL('popup.html') };
  const contentSender = { id: chrome.runtime.id, url: 'https://example.com', tab: { id: 10 }, frameId: 0 };
  await assert.rejects(handleMessage({ action: 'startCapture' }, contentSender), /must come from/);
  await handleMessage({ action: 'startCapture' }, pageSender);
  const args = scripts[1].args; const token = args[1];
  assert.equal(args.includes('secret-test-key'), false);
  await assert.rejects(handleMessage({ action: 'analyzeImage', token, image: IMAGE }, { ...contentSender, tab: { id: 99 } }), /expired/);
  await assert.rejects(handleMessage({ action: 'analyzeImage', token, image: IMAGE }, { ...contentSender, frameId: 1 }), /expired/);
  await handleMessage({ action: 'analyzeImage', token, image: IMAGE, apiKey: 'untrusted-input' }, contentSender);
  assert.equal(opened.length, 1); assert.match(opened[0].url, /analysis.html\?job=/);
  const job = Object.entries(chrome.storage.session.values).find(([key]) => key.startsWith('job:'))[1];
  assert.equal(job.settings.selectedModel, 'api-model'); assert.equal(JSON.stringify(job).includes('secret-test-key'), false); assert.equal(JSON.stringify(job).includes('untrusted-input'), false);
  await assert.rejects(handleMessage({ action: 'analyzeImage', token, image: IMAGE }, contentSender), /expired/);
});
