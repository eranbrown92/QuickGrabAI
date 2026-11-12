async function initializeCapture() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.startsWith("chrome://") && !tab.url.startsWith("edge://")) {
      const imageUrl = await chrome.tabs.captureVisibleTab(null, {
        format: "png",
      });

      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        css: `
          .snapalyze-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.3) !important;
            z-index: 2147483647 !important;
            cursor: crosshair !important;
          }
          .snapalyze-selection {
            position: fixed !important;
            border: 2px solid #4CAF50 !important;
            background: rgba(76, 175, 80, 0.1) !important;
            z-index: 2147483647 !important;
            pointer-events: none !important;
          }
        `,
      });

      const data = await chrome.storage.sync.get("openaiApiKey");
      if (!data.openaiApiKey) {
        alert("Please set your OpenAI API key in the extension options first.");
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["api.js", "selection.js"],
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: initializeSelection,
        args: [imageUrl, data.openaiApiKey],
      });

      window.close();
    } else {
      alert(
        "Cannot capture screenshots on browser system pages. Please try on a regular website."
      );
    }
  } catch (error) {
    alert("Error capturing screenshot. Please try on a different page.");
  }
}
