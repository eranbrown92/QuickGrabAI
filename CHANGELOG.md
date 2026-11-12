# 1.2.0 · November 11, 2026

- Load model IDs from the authenticated OpenAI Models API; refresh on demand and cache per API key. Remove static model and pricing tables.
- Use the Responses API with streaming, cancellation, timeouts, and actionable errors.
- Add text extraction and question-answering modes alongside image description.
- Improve high-DPI/zoom cropping and add Balanced WebP / Original PNG quality controls.
- Move API keys from synced storage to trusted local extension storage. Stop passing keys to injected scripts.
- Replace the tab-load message race with UUID-based pending jobs. Prevent concurrent duplicate processing of the same job.
- Move history to IndexedDB with thumbnails, pagination, optional saving, and exact-input local result reuse.
- Preserve Unicode and render all API text safely with textContent.
- Update privacy documentation; request API host access on user interaction as an optional permission for smoother store upgrades.
