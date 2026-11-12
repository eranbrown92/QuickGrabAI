import { DEFAULTS, normalizeSettings } from './config.js';

let initialization;
export function initializeSettings() {
  if (!initialization) initialization = navigator.locks.request('quickgrab-settings-migration', migrate)
    .catch(error => { initialization = undefined; throw error; });
  return initialization;
}

async function migrate() {
  // Content scripts have no access to the API key or transient capture jobs.
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const local = await chrome.storage.local.get(['settingsVersion', 'settings', 'apiKey']);
  if (local.settingsVersion !== 2) {
    const old = await chrome.storage.sync.get(['apiKey', 'openaiApiKey', ...Object.keys(DEFAULTS)]);
    await chrome.storage.local.set({
      settings: normalizeSettings({ ...old, ...local.settings }),
      apiKey: local.apiKey || old.apiKey || old.openaiApiKey || '',
      settingsVersion: 2,
    });
  }
  // Do this after the local write succeeds, including after interrupted migrations.
  await chrome.storage.sync.remove(['apiKey', 'openaiApiKey']);
}

export async function getSettings() {
  await initializeSettings();
  const { settings, apiKey } = await chrome.storage.local.get(['settings', 'apiKey']);
  return { ...normalizeSettings(settings), apiKey: apiKey || '' };
}

export async function saveSettings(changes) {
  return navigator.locks.request('quickgrab-settings-write', async () => {
    const current = await getSettings();
    const settings = normalizeSettings({ ...current, ...changes });
    const values = { settings };
    if (Object.hasOwn(changes, 'apiKey')) values.apiKey = String(changes.apiKey).trim();
    await chrome.storage.local.set(values);
    if (Object.hasOwn(changes, 'apiKey') && values.apiKey !== current.apiKey) await chrome.storage.local.remove('modelsCache');
    return settings;
  });
}
