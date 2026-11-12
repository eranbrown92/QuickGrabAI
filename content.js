// This file is kept minimal as the screenshot logic is now injected directly
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showAnalysis') {
    document.getElementById('analysisResult').textContent = request.analysis;
  }
});