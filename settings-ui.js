import { ROLES } from './config.js';
import { getSettings, saveSettings } from './settings.js';
import { loadModels } from './models.js';
import { element, status } from './ui.js';
import { hasApiAccess, requestApiAccess } from './api-access.js';

export async function mountSettings(container) {
  let settings = await getSettings();
  const keyForm = element('form');
  const keyLabel = element('label', 'OpenAI API key');
  keyLabel.htmlFor = 'apiKey';
  const keyStatus = element('p', '', 'muted');
  const keyInput = element('input');
  keyInput.id = 'apiKey'; keyInput.type = 'password'; keyInput.autocomplete = 'off'; keyInput.spellcheck = false;
  keyInput.placeholder = 'Enter or replace your API key';
  const saveKey = element('button', 'Save key'); saveKey.type = 'submit';
  const removeKey = element('button', 'Remove key', 'secondary'); removeKey.type = 'button';
  const actions = element('div', undefined, 'actions'); actions.append(saveKey, removeKey);
  keyForm.append(keyLabel, keyStatus, keyInput, actions);
  function updateKeyStatus() {
    keyStatus.textContent = settings.apiKey ? `Key saved on this device (…${settings.apiKey.slice(-4)})` : 'No API key saved.';
    removeKey.hidden = !settings.apiKey;
  }
  updateKeyStatus();

  const modelLabel = element('label', 'Model'); modelLabel.htmlFor = 'modelSelection';
  const modelSearch = element('input'); modelSearch.type = 'search'; modelSearch.placeholder = 'Filter your API models'; modelSearch.setAttribute('aria-label', 'Filter API models');
  const modelSelect = element('select'); modelSelect.id = 'modelSelection';
  const refresh = element('button', 'Refresh models', 'secondary'); refresh.type = 'button';
  const modelStatus = element('p', '', 'muted'); modelStatus.setAttribute('aria-live', 'polite');
  const modelHelp = element('p', 'Models come from your API account, newest creation date first. OpenAI’s list does not include capability or price information. Choose a model that supports image input and the Responses API.', 'muted');
  let models = [];
  function renderModels() {
    const query = modelSearch.value.trim().toLowerCase();
    const visible = models.filter(model => model.id.toLowerCase().includes(query) || model.id === settings.selectedModel);
    modelSelect.replaceChildren(new Option('Choose a model…', ''));
    if (settings.selectedModel && !models.some(model => model.id === settings.selectedModel)) {
      modelSelect.add(new Option(`${settings.selectedModel} (saved; not in fetched list)`, settings.selectedModel));
    }
    for (const model of visible) modelSelect.add(new Option(model.id, model.id));
    modelSelect.value = settings.selectedModel;
    modelSelect.disabled = !settings.apiKey;
  }
  async function refreshModels(force = false) {
    refresh.disabled = true; modelStatus.textContent = 'Loading models from OpenAI…';
    try {
      const result = await loadModels({ refresh: force }); models = result.models;
      modelStatus.textContent = `${models.length} models · Updated ${new Date(result.fetchedAt).toLocaleString()}${result.stale ? ` · Cached list: ${result.error}` : ''}`;
      modelStatus.classList.toggle('error', result.stale);
    } catch (error) { modelStatus.textContent = error.message; modelStatus.classList.add('error'); }
    finally { renderModels(); refresh.disabled = false; }
  }
  modelSearch.addEventListener('input', renderModels);
  refresh.addEventListener('click', async () => {
    try {
      const granted = await requestApiAccess();
      if (!granted) throw new Error('OpenAI access was not granted. You can try Refresh models again.');
      await refreshModels(true);
    } catch (error) { modelStatus.textContent = error.message; modelStatus.classList.add('error'); }
  });
  modelSelect.addEventListener('change', async () => {
    try {
      if (modelSelect.value && !models.some(model => model.id === modelSelect.value)) throw new Error('Refresh the model list and select an available model.');
      await saveSettings({ selectedModel: modelSelect.value }); settings.selectedModel = modelSelect.value;
      status('Model saved.');
    } catch (error) { status(error.message, true); }
  });
  keyForm.addEventListener('submit', async event => {
    event.preventDefault(); const apiKey = keyInput.value.trim();
    if (!apiKey || /\s/.test(apiKey)) return status('Enter your API key without spaces.', true);
    const permission = requestApiAccess();
    saveKey.disabled = true;
    try {
      await saveSettings({ apiKey }); settings.apiKey = apiKey; keyInput.value = ''; models = [];
      updateKeyStatus(); status('API key saved on this device.');
      if (await permission) await refreshModels(true);
      else modelStatus.textContent = 'Click Refresh models to allow OpenAI API access.';
    } catch (error) { status(error.message, true); }
    finally { saveKey.disabled = false; }
  });
  removeKey.addEventListener('click', async () => {
    try {
      await saveSettings({ apiKey: '' }); settings.apiKey = ''; models = []; renderModels(); updateKeyStatus();
      modelStatus.textContent = 'Save an API key to load models.'; status('API key removed from this extension.');
    } catch (error) { status(error.message, true); }
  });

  container.append(keyForm, modelLabel, modelSearch, modelSelect, refresh, modelStatus, modelHelp,
    element('p', 'Chrome may ask to allow access to api.openai.com when you save a key or refresh models. This connects the extension to OpenAI.', 'muted'));
  function addSelect(name, label, choices, help) {
    const title = element('label', label); title.htmlFor = name;
    const select = element('select'); select.id = name;
    for (const [value, text] of Object.entries(choices)) select.add(new Option(text, value));
    select.value = settings[name];
    select.addEventListener('change', async () => {
      try { await saveSettings({ [name]: select.value }); status('Settings saved.'); }
      catch (error) { status(error.message, true); }
    });
    container.append(title, select);
    if (help) container.append(element('p', help, 'muted'));
  }
  addSelect('analysisRole', 'Analysis mode', ROLES);
  addSelect('imageQuality', 'Screenshot quality', { balanced: 'Balanced · WebP, up to 2048 px', original: 'Original · Lossless PNG, native pixels' }, 'Use Original when small text needs more detail. Larger images can cost more to analyze.');
  addSelect('imageDetail', 'Image detail sent to the model', { auto: 'Automatic', low: 'Low', high: 'High' }, 'Automatic is the most compatible setting. Detail support and token cost depend on the model.');
  addSelect('reasoningEffort', 'Reasoning effort', { auto: 'Model default', none: 'None · When supported', low: 'Low', medium: 'Medium' }, 'Optional. If a model rejects this setting, choose Model default. More reasoning may take longer and use more tokens.');
  for (const [name, label] of [['keepHistory', 'Save new analyses on this device'], ['reuseResults', 'Reuse identical saved results to avoid another API call']]) {
    const wrapper = element('label', undefined, 'checkbox-label');
    const input = element('input'); input.type = 'checkbox'; input.id = name; input.checked = settings[name];
    input.addEventListener('change', async () => {
      try { await saveSettings({ [name]: input.checked }); status('Settings saved.'); }
      catch (error) { status(error.message, true); }
    });
    wrapper.append(input, document.createTextNode(label)); container.append(wrapper);
  }
  container.append(element('p', 'Your selected screenshot region is sent directly to OpenAI for analysis, billed to your API account. Keys stay in this extension’s local storage and are not synced by this version. Local storage is not a password vault.', 'muted'));
  renderModels();
  if (!settings.apiKey) modelStatus.textContent = 'Save an API key to load models.';
  else if (await hasApiAccess()) await refreshModels();
  else modelStatus.textContent = 'Click Refresh models to allow OpenAI API access and load your models.';
}
