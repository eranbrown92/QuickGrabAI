import { isImageDataUrl, PROMPT_VERSION, normalizeSettings } from './config.js';

let database;
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('quickgrabai', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const entries = db.createObjectStore('entries', { keyPath: 'id' });
      entries.createIndex('timestamp', ['timestamp', 'id']);
      entries.createIndex('cacheKey', 'cacheKey');
      db.createObjectStore('images', { keyPath: 'id' });
      db.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { database = undefined; reject(new Error('Close other QuickGrabAI tabs and retry.')); };
  });
  return database;
}
function result(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function committed(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Could not save history.'));
  });
}
export async function saveEntry(entry) {
  const db = await openDatabase();
  const tx = db.transaction(['entries', 'images'], 'readwrite');
  const done = committed(tx);
  const { image, ...metadata } = entry;
  tx.objectStore('entries').put(metadata);
  tx.objectStore('images').put({ id: entry.id, image });
  await done;
}
export async function getEntry(id) {
  const db = await openDatabase();
  const tx = db.transaction(['entries', 'images']);
  const [entry, storedImage] = await Promise.all([
    result(tx.objectStore('entries').get(id)), result(tx.objectStore('images').get(id)),
  ]);
  return entry ? { ...entry, image: storedImage?.image } : null;
}
export async function listEntries(limit = 30, before = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const entries = [];
    const range = before === null ? null : IDBKeyRange.upperBound(before, true);
    const request = db.transaction('entries').objectStore('entries').index('timestamp').openCursor(range, 'prev');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || entries.length >= limit) return resolve(entries);
      entries.push(cursor.value); cursor.continue();
    };
  });
}
export async function findCached(cacheKey) {
  const db = await openDatabase();
  const entry = await result(db.transaction('entries').objectStore('entries').index('cacheKey').get(cacheKey));
  return entry ? getEntry(entry.id) : null;
}
export async function deleteEntry(id) {
  const legacy = id.startsWith('legacy-') ? await getEntry(id) : null;
  const db = await openDatabase();
  const tx = db.transaction(['entries', 'images'], 'readwrite');
  const done = committed(tx);
  tx.objectStore('entries').delete(id); tx.objectStore('images').delete(id);
  await done;
  // Honor deletions in the old rollback copy, too; never resurrect removed screenshots.
  if (legacy) {
    const raw = localStorage.getItem('quickgrabai_entries');
    if (raw) {
      const old = JSON.parse(raw);
      if (Array.isArray(old)) localStorage.setItem('quickgrabai_entries', JSON.stringify(old.filter(entry =>
        !(entry.timestamp === legacy.timestamp && entry.image === legacy.image && entry.analysis === legacy.analysis))));
    }
  }
}
export async function makeCacheKey(image, settings) {
  const s = normalizeSettings(settings);
  const input = JSON.stringify([PROMPT_VERSION, s.selectedModel, s.analysisRole, s.reasoningEffort, s.imageDetail, image]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function makeThumbnail(image) {
  const img = new Image(); img.src = image; await img.decode();
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 320 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

// Runs only in trusted extension pages, where old localStorage is accessible.
// A single atomic transaction and stable IDs make migration safe across tabs/retries.
export async function migrateLegacyHistory() {
  const raw = localStorage.getItem('quickgrabai_entries');
  if (!raw) return;
  const db = await openDatabase();
  if (await result(db.transaction('meta').objectStore('meta').get('legacyMigrated'))) return;
  let entries;
  try { entries = JSON.parse(raw); } catch { throw new Error('Old history could not be read. The original data has been kept.'); }
  if (!Array.isArray(entries)) throw new Error('Old history is invalid. The original data has been kept.');
  const prepared = await Promise.all(entries.map(async (entry, index) => {
    if (!isImageDataUrl(entry.image) || typeof entry.analysis !== 'string' || !Number.isFinite(entry.timestamp)) return null;
    return { ...entry, id: `legacy-${entry.timestamp}-${index}`, thumbnail: await makeThumbnail(entry.image) };
  }));
  const tx = db.transaction(['entries', 'images', 'meta'], 'readwrite');
  const done = committed(tx);
  const marker = tx.objectStore('meta').get('legacyMigrated');
  marker.onsuccess = () => {
    if (marker.result) return;
    for (const entry of prepared) {
      if (!entry) continue;
      const { image, ...metadata } = entry;
      tx.objectStore('entries').put(metadata);
      tx.objectStore('images').put({ id: entry.id, image });
    }
    tx.objectStore('meta').put(true, 'legacyMigrated');
  };
  await done;
  // Keep the old storage as a rollback copy, rather than deleting user data.
}
