import { getSettings } from './settings.js';
import { requireApiAccess } from './api-access.js';

const MAX_CACHE_AGE = 24 * 60 * 60_000;
let inFlight;
export function sortModels(data) {
  if (!Array.isArray(data)) throw new Error('OpenAI returned an invalid model list.');
  return Array.from(new Map(data.filter(model => typeof model.id === 'string' && model.id.length > 0)
    .map(model => [model.id, { id: model.id, created: Number(model.created) || 0, ownedBy: String(model.owned_by || '') }])).values())
    .sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
}
async function fingerprint(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function loadModels({ refresh = false } = {}) {
  // One request per settings page even if refresh and key-save happen together.
  if (inFlight) return inFlight;
  inFlight = fetchModels(refresh).finally(() => { inFlight = undefined; });
  return inFlight;
}
async function fetchModels(refresh) {
  await requireApiAccess();
  const { apiKey } = await getSettings();
  if (!apiKey) throw new Error('Save an OpenAI API key to load your models.');
  const keyFingerprint = await fingerprint(apiKey);
  const { modelsCache } = await chrome.storage.local.get('modelsCache');
  const cache = modelsCache?.keyFingerprint === keyFingerprint && Array.isArray(modelsCache.models) ? modelsCache : null;
  if (!refresh && cache?.models.length && Date.now() - cache.fetchedAt < MAX_CACHE_AGE) return { ...cache, stale: false };
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('OpenAI rejected this API key.');
      if (response.status === 403) throw new Error('This API key cannot list models. Enable model-list access for the key.');
      throw new Error(`Could not load models (HTTP ${response.status}).`);
    }
    const models = sortModels((await response.json()).data);
    if (!models.length) throw new Error('OpenAI returned no models for this key.');
    const value = { models, fetchedAt: Date.now(), keyFingerprint };
    // Do not write a response for a key that was replaced while fetching.
    if ((await getSettings()).apiKey !== apiKey) throw new Error('The API key changed. Refresh models again.');
    await chrome.storage.local.set({ modelsCache: value });
    return { ...value, stale: false };
  } catch (error) {
    if ((await getSettings()).apiKey !== apiKey) throw new Error('The API key changed. Refresh models again.');
    if (cache?.models.length) return { ...cache, stale: true, error: error.message };
    throw error;
  }
}
