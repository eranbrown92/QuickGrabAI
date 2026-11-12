# QuickGrabAI privacy and permission disclosures · 1.2.0

Single purpose: Let a user select a webpage screenshot region and analyze it with OpenAI, with optional local history.

- `activeTab`: Capture the active tab only after the user clicks Capture.
- `scripting`: Inject the bundled region-selection script in the clicked tab, in an isolated world. No API keys are passed into the page.
- `storage`: Keep the API key and preferences locally, cache the API model list, and hold pending cropped images in trusted session storage. IndexedDB stores optional local history.
- Optional `https://api.openai.com/*`: Requested on a user click (Save key, Refresh models, or Capture) to make authenticated HTTPS requests to `/v1/models` and `/v1/responses`. The extension does not request access to other hosts. Making this optional avoids a new required host permission during an existing-user update.

Remote code: **No**. Calling an API and displaying its response as plain text is data processing. All executable JavaScript is bundled with the extension. Model IDs are data returned by the API; they do not execute code.

Data handling to reflect accurately in the Web Store Privacy practices form:

- Website content: the selected screenshot region is sent to OpenAI for the requested analysis; screenshot/result history can be stored locally.
- Authentication information: a user-provided API key is stored locally and used only to authenticate with OpenAI.
- Other personal information may be incidentally present in screenshots selected by the user; the extension does not independently extract browsing history or send page URLs.
- No developer analytics, ads, sale of user data, or developer-operated processing server.
- API requests use `store: false`; OpenAI’s service-side retention policies still apply.

These notes describe the implementation, not a guarantee of Web Store approval. Keep the hosted privacy policy and dashboard disclosures consistent with the packaged privacy policy.
