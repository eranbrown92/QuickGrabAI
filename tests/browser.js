const results = [];
function assert(value, message) { if (!value) throw new Error(message); }
async function check(name, fn) {
  try { await fn(); results.push({ name, pass: true }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); }
  document.getElementById('results').textContent = JSON.stringify(results, null, 2);
}
async function waitFor(condition, timeout = 5000) {
  const end = performance.now() + timeout;
  while (!condition()) { if (performance.now() > end) throw new Error('Timed out waiting for browser UI'); await new Promise(resolve => setTimeout(resolve, 25)); }
}
const history = await import('../history.js');
const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200;
const ctx = canvas.getContext('2d'); ctx.fillStyle = '#1167b1'; ctx.fillRect(0, 0, 400, 200); ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif'; ctx.fillText('QuickGrabAI π 中文', 20, 70);
const image = canvas.toDataURL('image/png');

await check('IndexedDB stores image separately, paginates tied timestamps, and deletes both stores', async () => {
  for (const id of ['a', 'b', 'c']) await history.saveEntry({ id, timestamp: 10, image, analysis: `Unicode π ${id}`, thumbnail: await history.makeThumbnail(image) });
  const first = await history.listEntries(2); assert(first.map(entry => entry.id).join() === 'c,b', 'Wrong sort order'); assert(!first[0].image, 'Gallery loaded a full image');
  const next = await history.listEntries(2, [first.at(-1).timestamp, first.at(-1).id]); assert(next[0].id === 'a', 'Pagination skipped a timestamp tie');
  assert((await history.getEntry('a')).image === image, 'Full image missing');
  await history.deleteEntry('a'); assert(await history.getEntry('a') === null, 'Delete failed');
});
await check('legacy migration is idempotent and does not resurrect deleted entries', async () => {
  localStorage.setItem('quickgrabai_entries', JSON.stringify([{ timestamp: 100, image, analysis: '日本語 π legacy' }]));
  await history.migrateLegacyHistory(); const entries = await history.listEntries();
  const legacy = entries.find(entry => entry.id.startsWith('legacy-')); assert(legacy?.analysis === '日本語 π legacy', 'Legacy Unicode lost');
  await history.deleteEntry(legacy.id); await history.migrateLegacyHistory();
  assert(await history.getEntry(legacy.id) === null, 'Migration resurrected a deletion');
  assert(!!localStorage.getItem('quickgrabai_entries'), 'Rollback history removed');
});
await check('result cache varies with image, model, role, reasoning, and detail', async () => {
  const settings = { selectedModel: 'vision-current' }; const baseline = await history.makeCacheKey(image, settings);
  assert(baseline === await history.makeCacheKey(image, settings), 'Identical request has unstable key');
  for (const changes of [{ selectedModel: 'new-model' }, { analysisRole: 'extract_text' }, { reasoningEffort: 'low' }, { imageDetail: 'high' }]) assert(baseline !== await history.makeCacheKey(image, { ...settings, ...changes }), 'Different settings shared a key');
});
await check('gallery renders untrusted model text literally', async () => {
  const { galleryCard } = await import('../ui.js');
  const text = '<img src=x onerror="window.injected=true"> π 中文';
  const card = galleryCard({ id: 'safe', timestamp: 100, thumbnail: image, analysis: text }, () => {});
  document.getElementById('fixture').append(card);
  assert(card.querySelectorAll('img').length === 1, 'HTML was interpreted'); assert(card.textContent.includes(text), 'Unicode or markup text lost');
});
await check('model picker loads API data and accepts a newly returned model without a code update', async () => {
  const { mountSettings } = await import('../settings-ui.js');
  const root = document.createElement('div'); document.getElementById('fixture').append(root); await mountSettings(root);
  const select = root.querySelector('#modelSelection'); assert([...select.options].some(option => option.value === 'vision-new'), 'API models missing');
  modelFixtures.push({ id: 'just-released-model', created: 9000 });
  [...root.querySelectorAll('button')].find(button => button.textContent === 'Refresh models').click();
  await waitFor(() => [...select.options].some(option => option.value === 'just-released-model'));
  select.value = 'just-released-model'; select.dispatchEvent(new Event('change'));
  await waitFor(() => chrome.storage.local.values.settings.selectedModel === 'just-released-model');
});
await check('real canvas cropping uploads only the selected region at native pixel scale', async () => {
  await import('../selection.js');
  const attach = Element.prototype.attachShadow; let shadow;
  Element.prototype.attachShadow = function (options) { shadow = attach.call(this, options); return shadow; };
  globalThis.initializeSelection(image, 'fake-one-use-token', 'original');
  Element.prototype.attachShadow = attach;
  const overlay = shadow.querySelector('.overlay');
  const viewport = { width: innerWidth, height: innerHeight };
  // Synthetic events cannot acquire native pointer capture, so stub those methods in this fixture only.
  overlay.setPointerCapture = overlay.releasePointerCapture = () => {};
  overlay.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 20, pointerId: 1, button: 0 }));
  overlay.dispatchEvent(new PointerEvent('pointermove', { clientX: 210, clientY: 120, pointerId: 1 }));
  overlay.dispatchEvent(new PointerEvent('pointerup', { clientX: 210, clientY: 120, pointerId: 1 }));
  await waitFor(() => sentMessages.some(message => message.action === 'analyzeImage'));
  const message = sentMessages.find(message => message.action === 'analyzeImage');
  assert(!('apiKey' in message), 'Capture message leaked key');
  const crop = new Image(); crop.src = message.image; await crop.decode();
  assert(crop.naturalWidth === Math.round(200 * 400 / viewport.width), 'Wrong crop width');
  assert(crop.naturalHeight === Math.round(100 * 200 / viewport.height), 'Wrong crop height');
  assert(crop.naturalWidth < 400 && crop.naturalHeight < 200, 'Whole screenshot was uploaded');
});
globalThis.browserResults = results;
globalThis.browserDone = true;
