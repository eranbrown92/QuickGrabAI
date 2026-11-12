chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "captureTab") {
    chrome.tabs
      .captureVisibleTab(null, { format: "png" })
      .then((dataUrl) => {
        sendResponse(dataUrl);
      })
      .catch(() => {
        sendResponse(null);
      });
    return true;
  }

  if (request.action === "analyzeImage") {
    handleImageAnalysis(
      request.image,
      request.apiKey,
      request.role,
      sender.tab.id
    );
    return true;
  }

  if (request.action === "updateBadge") {
    if (request.count > 0) {
      chrome.action.setBadgeText({ text: request.count.toString() });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});

async function handleImageAnalysis(imageData, apiKey, role, tabId) {
  try {
    const tab = await chrome.tabs.create({
      url: "analysis.html",
    });

    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, info) {
      if (info.status === "complete" && updatedTabId === tab.id) {
        chrome.tabs.onUpdated.removeListener(listener);

        chrome.tabs.sendMessage(tab.id, {
          action: "processImage",
          imageData: imageData,
          apiKey: apiKey,
          role: role,
        });
      }
    });
  } catch (error) {
    chrome.tabs.sendMessage(tabId, {
      action: "error",
      message: error.message,
    });
  }
}
