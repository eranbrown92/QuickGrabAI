import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { storageArea, IMAGE } from './helpers.js';
import { saveEntry, getEntry, listEntries, deleteEntry, findCached, makeCacheKey, migrateLegacyHistory } from '../history.js';

const local = storageArea();
globalThis.localStorage = { getItem: key => local.values[key] ?? null, setItem: (key, value) => { local.values[key] = value; } };
// Thumbnail drawing is tested manually in Chrome. This fixture only unblocks migration's image decode.
globalThis.Image = class { naturalWidth = 400; naturalHeight = 200; async decode() {} };
globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => IMAGE }) };

test('history stores full images separately from gallery metadata; pagination handles timestamp ties', async () => {
  for (const id of ['a', 'b', 'c']) await saveEntry({ id, timestamp: 1, image: IMAGE, thumbnail: IMAGE, analysis: `π 中文 ${id}`, cacheKey: `cache-${id}` });
  const first = await listEntries(2);
  assert.deepEqual(first.map(entry => entry.id), ['c', 'b']); assert.equal(first[0].image, undefined);
  const second = await listEntries(2, [first.at(-1).timestamp, first.at(-1).id]);
  assert.equal(second[0].id, 'a');
  assert.equal((await getEntry('a')).image, IMAGE);
  assert.equal((await findCached('cache-a')).analysis, 'π 中文 a');
  await deleteEntry('a'); assert.equal(await getEntry('a'), null); assert.equal(await findCached('cache-a'), null);
});
test('history migration preserves Unicode, is idempotent, and respects deletions in rollback storage', async () => {
  localStorage.setItem('quickgrabai_entries', JSON.stringify([{ timestamp: 200, image: IMAGE, analysis: '日本語 π legacy' }]));
  await migrateLegacyHistory(); await migrateLegacyHistory();
  const migrated = (await listEntries()).filter(entry => entry.id.startsWith('legacy-'));
  assert.equal(migrated.length, 1); assert.equal(migrated[0].analysis, '日本語 π legacy');
  await deleteEntry(migrated[0].id);
  assert.deepEqual(JSON.parse(localStorage.getItem('quickgrabai_entries')), []);
  await migrateLegacyHistory(); assert.equal(await getEntry(migrated[0].id), null);
});
test('request cache key distinguishes model, image, mode, detail, and effort', async () => {
  const settings = { selectedModel: 'api-model' };
  const baseline = await makeCacheKey(IMAGE, settings);
  assert.equal(await makeCacheKey(IMAGE, settings), baseline);
  assert.notEqual(await makeCacheKey('data:image/png;base64,BBBB', settings), baseline);
  for (const changes of [{ selectedModel: 'another-api-model' }, { analysisRole: 'extract_text' }, { imageDetail: 'high' }, { reasoningEffort: 'low' }]) {
    assert.notEqual(await makeCacheKey(IMAGE, { ...settings, ...changes }), baseline);
  }
});
