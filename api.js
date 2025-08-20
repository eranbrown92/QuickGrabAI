async function analyzeWithOpenAI(imageData) {
  try {
    const result = await chrome.storage.sync.get(["apiKey", "analysisRole"]);
    const apiKey = result.apiKey;
    const role = result.analysisRole || "image_analysis";

    if (!apiKey) {
      throw new Error(
        "No API key found. Please add your API key in the extension settings."
      );
    }

    chrome.runtime.sendMessage({
      action: "analyzeImage",
      image: imageData,
      apiKey: apiKey,
      role: role,
    });
  } catch (error) {
    alert("Error: " + error.message);
  }
}
