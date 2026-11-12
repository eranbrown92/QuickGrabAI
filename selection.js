// This is the only script injected into the page (in Chrome's isolated world).
// It receives screenshot pixels and a one-use token, never an API key.
function getCropBounds(rect, viewport, image) {
  const scaleX = image.width / viewport.width, scaleY = image.height / viewport.height;
  const x = Math.max(0, Math.min(image.width - 1, Math.round(rect.x * scaleX)));
  const y = Math.max(0, Math.min(image.height - 1, Math.round(rect.y * scaleY)));
  return { x, y,
    width: Math.max(1, Math.min(image.width - x, Math.round(rect.width * scaleX))),
    height: Math.max(1, Math.min(image.height - y, Math.round(rect.height * scaleY))),
  };
}

globalThis.initializeSelection = function (imageData, token, quality = 'balanced') {
  globalThis.quickGrabCleanup?.();
  const viewport = { width: innerWidth, height: innerHeight };
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `:host{all:initial}*{box-sizing:border-box}.overlay{position:fixed;inset:0;cursor:crosshair;touch-action:none;user-select:none;background:#000}.snapshot{position:absolute;width:100%;height:100%;pointer-events:none}.shade{position:absolute;inset:0;background:#0005;pointer-events:none}.selection{position:absolute;border:2px solid #4e9cff;background:#4e9cff20;pointer-events:none}.hint{position:absolute;top:18px;left:50%;transform:translateX(-50%);font:14px system-ui;color:white;background:#132238;padding:10px 18px;border-radius:8px;pointer-events:none;white-space:nowrap}`;
  const overlay = document.createElement('div'); overlay.className = 'overlay';
  const snapshot = document.createElement('img'); snapshot.className = 'snapshot'; snapshot.src = imageData;
  const shade = document.createElement('div'); shade.className = 'shade';
  const selection = document.createElement('div'); selection.className = 'selection'; selection.hidden = true;
  const hint = document.createElement('div'); hint.className = 'hint'; hint.textContent = 'Drag to select · Esc to cancel';
  overlay.append(snapshot, shade, selection, hint); shadow.append(style, overlay); document.documentElement.append(host);
  let start, pointerId, busy = false;
  function cleanup() {
    host.remove(); document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', cleanup); window.removeEventListener('blur', cleanup);
    if (globalThis.quickGrabCleanup === cleanup) delete globalThis.quickGrabCleanup;
  }
  function onKey(event) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cleanup(); } }
  globalThis.quickGrabCleanup = cleanup;
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', cleanup); window.addEventListener('blur', cleanup);
  function point(event) { return { x: Math.max(0, Math.min(viewport.width, event.clientX)), y: Math.max(0, Math.min(viewport.height, event.clientY)) }; }
  function rectangle(end) { return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }; }
  overlay.addEventListener('pointerdown', event => {
    if (event.button !== 0 || busy) return;
    event.preventDefault(); pointerId = event.pointerId; start = point(event);
    overlay.setPointerCapture(pointerId); selection.hidden = false;
    Object.assign(selection.style, { left: `${start.x}px`, top: `${start.y}px`, width: '0px', height: '0px' });
  });
  overlay.addEventListener('pointermove', event => {
    if (!start || busy || event.pointerId !== pointerId) return;
    const rect = rectangle(point(event));
    Object.assign(selection.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  });
  overlay.addEventListener('pointercancel', cleanup);
  overlay.addEventListener('pointerup', async event => {
    if (!start || busy || event.pointerId !== pointerId) return;
    const rect = rectangle(point(event));
    overlay.releasePointerCapture(pointerId);
    if (rect.width < 10 || rect.height < 10) { start = null; selection.hidden = true; return; }
    busy = true; hint.textContent = 'Preparing screenshot…';
    try {
      await snapshot.decode();
      const crop = getCropBounds(rect, viewport, { width: snapshot.naturalWidth, height: snapshot.naturalHeight });
      const canvas = document.createElement('canvas');
      const scale = quality === 'original' ? 1 : Math.min(1, 2048 / Math.max(crop.width, crop.height));
      canvas.width = Math.max(1, Math.round(crop.width * scale)); canvas.height = Math.max(1, Math.round(crop.height * scale));
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(snapshot, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      const image = quality === 'original' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/webp', 0.9);
      const response = await chrome.runtime.sendMessage({ action: 'analyzeImage', image, token });
      if (!response?.ok) throw new Error(response?.error || 'Could not open the analysis.');
      cleanup();
    } catch (error) { cleanup(); alert(`QuickGrabAI: ${error.message}`); }
  });
};
