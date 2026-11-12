import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { buildRequest, normalizeSettings, isImageDataUrl } from '../config.js';
import { IMAGE } from './helpers.js';

test('accepts new API model IDs without a registry and omits optional reasoning', () => {
  const request = buildRequest(IMAGE, { selectedModel: 'brand-new-api-model' });
  assert.equal(request.model, 'brand-new-api-model');
  assert.equal(request.input[0].content[1].image_url, IMAGE);
  assert.equal(request.store, false); assert.equal(request.stream, true);
  for (const name of ['reasoning', 'temperature', 'top_p', 'text', 'max_tokens']) assert.equal(Object.hasOwn(request, name), false);
});
test('requires deliberate model selection; normalizes UI options', () => {
  assert.throws(() => buildRequest(IMAGE, {}), /Choose a model/);
  const value = normalizeSettings({ selectedModel: 'model-from-api', imageDetail: 'bad', reasoningEffort: 'bad', analysisRole: 'bad' });
  assert.equal(value.selectedModel, 'model-from-api');
  assert.equal(value.imageDetail, 'auto'); assert.equal(value.reasoningEffort, 'auto');
  const request = buildRequest(IMAGE, { selectedModel: 'api-model', reasoningEffort: 'low', imageDetail: 'high' });
  assert.equal(request.reasoning.effort, 'low'); assert.equal(request.input[0].content[1].detail, 'high');
  assert.equal(request.max_output_tokens, 8192);
});
test('rejects URLs and malformed payloads, accepts supported cropped data URLs', () => {
  assert.equal(isImageDataUrl(IMAGE), true);
  assert.equal(isImageDataUrl('data:image/webp;base64,YWJj'), true);
  for (const image of ['https://example.com/picture.png', 'data:image/svg+xml;base64,AAAA', 'data:image/png;base64,<>', null]) assert.equal(isImageDataUrl(image), false);
});
test('crop uses actual capture scale independently on each axis and clamps bounds', async () => {
  const context = vm.createContext({});
  vm.runInContext(await fs.readFile(new URL('../selection.js', import.meta.url), 'utf8'), context);
  const crop = context.getCropBounds({ x: 10, y: 20, width: 100, height: 50 }, { width: 1000, height: 500 }, { width: 2500, height: 1000 });
  assert.deepEqual(JSON.parse(JSON.stringify(crop)), { x: 25, y: 40, width: 250, height: 100 });
  const edge = context.getCropBounds({ x: 999, y: 499, width: 100, height: 100 }, { width: 1000, height: 500 }, { width: 2000, height: 1000 });
  assert.equal(edge.x + edge.width, 2000); assert.equal(edge.y + edge.height, 1000);
});
