import { getSettings } from './settings.js';
import { ROLES } from './config.js';
import { listEntries, migrateLegacyHistory } from './history.js';
import { mountSettings } from './settings-ui.js';
import { status, galleryCard, analysisUrl, element } from './ui.js';
import { requestApiAccess } from './api-access.js';

async function loadGallery() {
  const gallery = document.getElementById('galleryItems');
  try {
    await migrateLegacyHistory();
    const entries = await listEntries(8);
    gallery.replaceChildren(...entries.map(entry => galleryCard(entry, id => chrome.tabs.create({ url: analysisUrl(id) }))));
    if (!entries.length) gallery.append(element('p', 'No saved analyses yet.', 'muted'));
  } catch (error) { status(`History: ${error.message}`, true); }
}
async function updateSummary() {
  const settings = await getSettings();
  document.getElementById('captureSummary').textContent = `${ROLES[settings.analysisRole]} · ${settings.selectedModel || 'Choose a model in Settings'}`;
}
let settingsMounted = false;
async function selectTab(name) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === name);
    tab.setAttribute('aria-pressed', String(tab.dataset.tab === name));
  });
  document.querySelectorAll('.tab-content').forEach(section => { section.hidden = section.id !== name; });
  if (name === 'gallery') await loadGallery();
  if (name === 'capture') await updateSummary();
  if (name === 'settings' && !settingsMounted) {
    settingsMounted = true;
    try { await mountSettings(document.getElementById('settingsForm')); }
    catch (error) { settingsMounted = false; status(error.message, true); }
  }
}
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => selectTab(tab.dataset.tab).catch(error => status(error.message, true))));
document.getElementById('captureBtn').addEventListener('click', async event => {
  const permission = requestApiAccess();
  event.target.disabled = true; status('Preparing capture…');
  try {
    const settings = await getSettings();
    if (!settings.apiKey || !settings.selectedModel) { await selectTab('settings'); throw new Error('Save your API key and select a model first.'); }
    if (!await permission) throw new Error('Allow OpenAI access to analyze screenshots. Try Capture again or use Refresh models in Settings.');
    const response = await chrome.runtime.sendMessage({ action: 'startCapture' });
    if (!response?.ok) throw new Error(response?.error || 'Could not start capture.');
    window.close();
  } catch (error) { status(error.message, true); }
  finally { event.target.disabled = false; }
});
document.getElementById('openGallery').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('analysis.html') }));
document.getElementById('openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
updateSummary().catch(error => status(error.message, true));
