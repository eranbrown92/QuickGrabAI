# QuickGrabAI 1.2.0

Capture a webpage region and describe it, answer a visible question, or extract its text using OpenAI.

## Setup

1. Load this directory unpacked in `chrome://extensions` with Developer mode enabled, or install the published update.
2. Open Settings and save your OpenAI API key. Keys are stored locally in the extension, not synced. Allow Chrome's optional access request for `api.openai.com`. Existing users can grant access with Refresh models or Capture; optional host access avoids adding an install-time host warning to the update.
3. The extension fetches `/v1/models` using that key. Choose an image-input model that supports the Responses API. There are no bundled model IDs, capability guesses, prices, or default model names.
4. Open a regular webpage, click the toolbar icon, and choose Capture screenshot. Drag a region; press Esc to cancel.

The model list is cached for 24 hours and refreshed automatically when Settings opens after expiration. Use Refresh models to fetch it immediately. A failed refresh can display the last cached list for the same key, clearly marked as cached. Replacing/removing the API key clears the model cache. The list is ordered by API creation time; that is not a quality or price ranking. OpenAI’s model-list endpoint does not expose vision capabilities or prices. Unsupported selections produce an actionable error without silently switching models.

## Efficiency and quality

- Balanced capture: crop locally, preserve native capture pixels up to a 2048-pixel longest edge, then encode WebP at quality 0.9. Only the crop is uploaded.
- Original capture: native-pixel, lossless PNG for small text and dense diagrams. Large selections may need to be reduced.
- Screenshot coordinates use actual screenshot-to-viewport scale, including browser zoom and high-DPI displays.
- Stream results as they arrive; cancel requests or retry failures. Requests time out after two minutes. Cancellation stops the local request and is not a guarantee that OpenAI billing stops immediately.
- Default reasoning is omitted from the API request to preserve model compatibility. Optional effort settings are passed only when chosen. No temperature or model-specific verbosity parameters are sent.
- The output budget includes reasoning tokens: 8,192 tokens by default, or 1,200/4,096 when reasoning is explicitly None. Longer text extraction may need smaller regions.
- Optional duplicate-result reuse uses a local SHA-256 digest of image bytes, selected model, role, detail, reasoning effort, and prompt version. It avoids an API call only for completed, saved, identical inputs. Different image encodings may miss the cache. Users can disable reuse.
- History lives in IndexedDB, with images separate from gallery metadata and small thumbnails. Gallery pages load in batches rather than rewriting/reloading a single growing localStorage blob.

## Upgrade behavior

Version 1.2.0 migrates the existing `apiKey`/`openaiApiKey`, analysis role, and selected model from Chrome sync storage into local storage. Existing model IDs are preserved as user settings; a first-time user must explicitly choose an API-listed model. API keys are removed from sync only after the local write succeeds. History is migrated from `quickgrabai_entries` once per extension origin. An original local rollback copy is retained. Unicode, mathematical symbols, and line breaks are preserved; model text is never inserted as HTML.

An unpacked extension with a different ID has separate storage from the Web Store installation. Upgrade the existing store listing to migrate installed users in place. This package has no embedded store key or update URL; the Web Store handles signing and update distribution for the existing listing.

## Development

No build step or production dependencies. JavaScript modules run directly in Manifest V3. The service worker performs capture authorization and job handoff; the trusted analysis tab owns the fetch stream so a long request is not tied to service-worker lifetime. Transient jobs are scoped by UUID, stored in trusted session storage, and deduplicated with Web Locks across analysis tabs.

Run `npm ci` then `npm test` for the tests (requires Node 22.12+). Development-only dependencies emulate IndexedDB and the DOM; none are shipped in the extension. Browser integration checks live under `tests/`; exclude tests, `package.json`, and development files from the store ZIP. See the accompanying release notes for packaging and manual verification.

## Data handling

Selected screenshots and prompts go directly to OpenAI, billed to the user’s API account. `store: false` disables response storage for API retrieval, not all service-side retention. API keys in local extension storage are not encrypted by this application. See `privacy-policy.html` and `privacy_practices.md`.
