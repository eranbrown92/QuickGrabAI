export function storageArea(seed = {}) {
  const values = structuredClone(seed);
  return {
    values, access: null,
    async get(keys) {
      if (keys === null) return structuredClone(values);
      if (typeof keys === 'string') keys = [keys];
      return structuredClone(Object.fromEntries(keys.filter(key => Object.hasOwn(values, key)).map(key => [key, values[key]])));
    },
    async set(updates) { Object.assign(values, structuredClone(updates)); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
    async setAccessLevel({ accessLevel }) { this.access = accessLevel; },
  };
}
export function mockChrome({ local = {}, sync = {}, session = {} } = {}) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (_name, callback) => callback() } } });
  globalThis.chrome = {
    permissions: { contains: async () => true, request: async () => true },
    storage: { local: storageArea(local), sync: storageArea(sync), session: storageArea(session) },
    runtime: { id: 'extension-id', getURL: path => `chrome-extension://extension-id/${path}`,
      onMessage: { addListener(fn) { this.listener = fn; } }, onInstalled: { addListener() {} }, onStartup: { addListener() {} } },
  };
  return chrome;
}
export const IMAGE = 'data:image/png;base64,AAAA';
