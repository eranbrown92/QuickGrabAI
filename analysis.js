import { getSettings } from './settings.js';
import { analyzeImage } from './api.js';
import { getEntry, saveEntry, listEntries, deleteEntry, findCached, makeCacheKey, makeThumbnail, migrateLegacyHistory } from './history.js';
import { element, status, galleryCard, dateLabel } from './ui.js';

const params = new URLSearchParams(location.search);
const jobId = params.get('job');
const output = document.getElementById('result');
const imageNode = document.getElementById('screenshot');
const copyButton = document.getElementById('copyBtn');
const cancelButton = document.getElementById('cancelBtn');
const retryButton = document.getElementById('retryBtn');
let controller, currentId, oldestTimestamp = null;

function showEntry(entry, cached = false) {
  currentId = entry.id; imageNode.src = entry.image; imageNode.hidden = false;
  output.textContent = entry.analysis; copyButton.hidden = false;
  document.getElementById('metadata').textContent = `${dateLabel(entry.timestamp)}${entry.model ? ` · ${entry.model}` : ''}${cached ? ' · Reused saved result (no API call)' : ''}`;
}
async function refreshGallery(append = false) {
  const gallery = document.getElementById('gallery');
  const entries = await listEntries(24, append ? oldestTimestamp : null);
  if (!append) gallery.replaceChildren();
  for (const entry of entries) gallery.append(galleryCard(entry, async id => {
    if (controller) return status('Cancel or finish the current analysis first.', true);
    try { const full = await getEntry(id); if (full) { showEntry(full); window.scrollTo({ top: 0, behavior: 'smooth' }); } }
    catch (error) { status(error.message, true); }
  }, async id => {
    if (!confirm('Delete this saved analysis?')) return;
    try {
      await deleteEntry(id);
      if (currentId === id) { output.textContent = 'Analysis deleted.'; imageNode.hidden = true; copyButton.hidden = true; currentId = null; }
      await refreshGallery();
    } catch (error) { status(error.message, true); }
  }));
  if (entries.length) oldestTimestamp = [entries.at(-1).timestamp, entries.at(-1).id];
  if (!gallery.children.length) gallery.append(element('p', 'No saved analyses yet.', 'muted'));
  document.getElementById('loadMore').hidden = entries.length < 24;
}

async function runJob(signal) {
  signal.throwIfAborted();
  const key = `job:${jobId}`;
  const job = (await chrome.storage.session.get(key))[key];
  const completed = await getEntry(jobId).catch(() => null);
  if (completed) {
    showEntry(completed);
    await chrome.storage.session.remove(key).catch(() => {});
    status('Loaded the completed analysis.');
    return;
  }
  if (!job) {
    throw new Error('This capture has expired or was already completed without saving. Capture another screenshot.');
  }
  imageNode.src = job.image; imageNode.hidden = false;
  // Preferences belong to this capture; use the latest key so it can be fixed after an error.
  const settings = { ...job.settings, apiKey: (await getSettings()).apiKey };
  const cacheKey = await makeCacheKey(job.image, settings);
  let cacheWarning = '';
  if (settings.keepHistory && settings.reuseResults) {
    try {
      const cached = await findCached(cacheKey);
      if (cached) { showEntry(cached, true); await chrome.storage.session.remove(key); status('Reused your saved analysis.'); return; }
    } catch { cacheWarning = ' History is temporarily unavailable.'; }
  }
  if (signal.aborted) throw signal.reason;
  output.textContent = 'Analyzing…';
  document.getElementById('metadata').textContent = settings.selectedModel;
  const started = performance.now();
  const response = await analyzeImage(job.image, settings, { signal, onText: text => { output.textContent = text; } });
  const entry = { id: job.id, timestamp: Date.now(), image: job.image, analysis: response.text, role: settings.analysisRole, model: response.model, usage: response.usage, cacheKey };
  let warning = cacheWarning;
  if (settings.keepHistory) {
    try { entry.thumbnail = await makeThumbnail(job.image); await saveEntry(entry); }
    catch { warning = ' The result could not be saved to history. Copy it before closing this tab.'; }
  }
  showEntry(entry);
  await chrome.storage.session.remove(key).catch(() => {});
  const usage = response.usage?.total_tokens ? ` · ${response.usage.total_tokens.toLocaleString()} tokens` : '';
  status(`Done in ${((performance.now() - started) / 1000).toFixed(1)}s${usage}.${warning}`, !!warning);
}

async function processJob() {
  if (controller) return;
  const activeController = new AbortController(); controller = activeController;
  const timeout = setTimeout(() => activeController.abort(new DOMException('Analysis timed out after two minutes.', 'TimeoutError')), 120_000);
  cancelButton.hidden = false; retryButton.hidden = true; copyButton.hidden = true;
  status('Analyzing screenshot…');
  try {
    // Prevent duplicate API charges if the same pending job is opened in two tabs.
    await navigator.locks.request(`analysis:${jobId}`, { signal: activeController.signal }, () => runJob(activeController.signal));
  } catch (error) {
    const reason = activeController.signal.aborted ? activeController.signal.reason : error;
    status(reason?.name === 'AbortError' ? 'Analysis canceled. You can retry.' : reason?.message || 'Analysis failed. You can retry.', true);
    retryButton.hidden = false;
    if (output.textContent && output.textContent !== 'Analyzing…') copyButton.hidden = false;
  } finally {
    clearTimeout(timeout); controller = null; cancelButton.hidden = true;
    await refreshGallery().catch(error => status(`History: ${error.message}`, true));
  }
}
cancelButton.addEventListener('click', () => controller?.abort());
retryButton.addEventListener('click', processJob);
copyButton.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(output.textContent); status('Copied analysis.'); }
  catch { status('Copy failed. Select the text and copy it manually.', true); }
});
document.getElementById('loadMore').addEventListener('click', () => refreshGallery(true).catch(error => status(error.message, true)));

async function init() {
  await getSettings();
  try { await migrateLegacyHistory(); } catch (error) { status(`History: ${error.message}`, true); }
  if (jobId) await processJob();
  else if (params.get('entry')) {
    const entry = await getEntry(params.get('entry'));
    if (entry) showEntry(entry); else status('That saved analysis was not found.', true);
  } else {
    // Preserve the selected-entry handoff from versions 1.0/1.1 during an upgrade.
    const selected = localStorage.getItem('quickgrabai_selected');
    if (selected) {
      try { const entry = JSON.parse(selected); if (entry.image && typeof entry.analysis === 'string') showEntry(entry); }
      catch { status('The previous selection could not be loaded.', true); }
      localStorage.removeItem('quickgrabai_selected');
    }
  }
  if (!jobId) await refreshGallery();
}
init().catch(error => status(error.message, true));
