import { getSettings, initializeSettings } from './settings.js';
import { isImageDataUrl, normalizeSettings } from './config.js';
import { requireApiAccess } from './api-access.js';

const CAPTURE_TTL = 5 * 60_000;
function trustedPage(sender) {
  return sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''));
}
async function cleanTransientData() {
  const all = await chrome.storage.session.get(null);
  const expired = Object.entries(all).filter(([key, value]) =>
    (key.startsWith('capture:') && Date.now() - value.created > CAPTURE_TTL) ||
    (key.startsWith('job:') && Date.now() - value.created > 86_400_000));
  if (expired.length) await chrome.storage.session.remove(expired.map(([key]) => key));
}

async function startCapture() {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error('Add your OpenAI API key in Settings first.');
  if (!settings.selectedModel) throw new Error('Choose an image-capable model in Settings first.');
  await requireApiAccess();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !/^(https?:|file:)/.test(tab.url) || /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/.test(tab.url)) {
    throw new Error('Open a regular webpage to capture. Chrome system pages and the Web Store cannot be captured.');
  }
  await cleanTransientData();
  // Capture before drawing an overlay. Use the tab's window, not whichever is focused later.
  const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const [activeTab] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (activeTab?.id !== tab.id) throw new Error('The active tab changed. Please try again.');
  const token = crypto.randomUUID();
  const key = `capture:${token}`;
  await chrome.storage.session.set({ [key]: { tabId: tab.id, created: Date.now(), settings: normalizeSettings(settings) } });
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['selection.js'] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (data, id, quality) => globalThis.initializeSelection(data, id, quality),
      args: [image, token, settings.imageQuality],
    });
  } catch (error) {
    await chrome.storage.session.remove(key);
    throw new Error(`Could not start capture on this page: ${error.message}`);
  }
  return {};
}

async function acceptImage(message, sender) {
  const key = `capture:${message.token}`;
  const capture = (await chrome.storage.session.get(key))[key];
  if (sender.id !== chrome.runtime.id || !sender.tab || sender.frameId !== 0 || !capture || capture.tabId !== sender.tab.id || Date.now() - capture.created > CAPTURE_TTL) {
    throw new Error('This capture expired. Start a new screenshot.');
  }
  if (!isImageDataUrl(message.image)) throw new Error('Screenshot is too large. Try a smaller selection.');
  // Mark consumed before opening a tab; no API keys are accepted from content scripts.
  await chrome.storage.session.remove(key);
  const id = crypto.randomUUID();
  const jobKey = `job:${id}`;
  await chrome.storage.session.set({ [jobKey]: { id, image: message.image, settings: capture.settings, created: Date.now() } });
  try { await chrome.tabs.create({ url: chrome.runtime.getURL(`analysis.html?job=${id}`) }); }
  catch (error) { await chrome.storage.session.remove(jobKey); throw error; }
  return {};
}

export async function handleMessage(message, sender) {
  await initializeSettings();
  if (!message || typeof message !== 'object') throw new Error('Invalid request.');
  if (message.action === 'analyzeImage') return acceptImage(message, sender);
  if (!trustedPage(sender)) throw new Error('This request must come from QuickGrabAI.');
  if (message.action === 'startCapture') return startCapture();
  throw new Error('Unknown request.');
}

// Serialize capture messages so duplicate deliveries cannot consume a token twice.
let messageQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const task = messageQueue.then(() => handleMessage(message, sender));
  messageQueue = task.catch(() => {});
  task.then(data => sendResponse({ ok: true, ...data }), error => sendResponse({ ok: false, error: error.message }));
  return true;
});
chrome.runtime.onInstalled.addListener(() => initializeSettings().catch(console.error));
chrome.runtime.onStartup.addListener(() => initializeSettings().then(cleanTransientData).catch(console.error));
