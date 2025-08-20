// Function to create API key input field
function createKeyInput() {
  const container = document.createElement("div");

  const message = document.createElement("p");
  message.className = "no-key-message";
  message.textContent = "No API key set. Enter your OpenAI API key below:";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "api-key-input";
  input.placeholder = "Enter OpenAI API Key (sk-...)";

  const saveBtn = document.createElement("button");
  saveBtn.className = "save-key";
  saveBtn.textContent = "Save API Key";
  saveBtn.onclick = () => {
    if (input.value.trim()) {
      saveSettings(input.value.trim());
    }
  };

  container.appendChild(message);
  container.appendChild(input);
  container.appendChild(saveBtn);
  return container;
}

// Function to create masked API key display
function createKeyDisplay(key) {
  const display = document.createElement("div");
  display.className = "api-key-display";

  const keyMask = document.createElement("div");
  keyMask.className = "api-key-mask";
  keyMask.textContent = `API Key: ${key.substring(0, 3)}...${key.substring(
    key.length - 4
  )}`;

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-key";
  removeBtn.textContent = "Remove";
  removeBtn.onclick = () => {
    saveSettings(""); // Clear the API key
  };

  display.appendChild(keyMask);
  display.appendChild(removeBtn);
  return display;
}

// Function to save settings
function saveSettings(apiKey = null) {
  chrome.storage.sync.get(["apiKey", "analysisRole"], (result) => {
    const role = document.getElementById("analysisRole").value;
    const settings = {
      analysisRole: role,
    };

    // Only update apiKey if it's provided
    if (apiKey !== null) {
      settings.apiKey = apiKey;
    } else {
      settings.apiKey = result.apiKey || "";
    }

    chrome.storage.sync.set(settings, () => {
      showStatus("Settings saved successfully!", "success");
      loadSettings(); // Reload the display
    });
  });
}

// Function to show status message
function showStatus(message, type) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = "block";

  setTimeout(() => {
    status.style.display = "none";
  }, 3000);
}

// Function to load saved settings
function loadSettings() {
  chrome.storage.sync.get(["apiKey", "analysisRole"], (result) => {
    // Load API key
    const container = document.getElementById("apiKeySection");
    container.innerHTML = "";

    if (result.apiKey) {
      container.appendChild(createKeyDisplay(result.apiKey));
    } else {
      container.appendChild(createKeyInput());
    }

    // Load analysis role
    const role = result.analysisRole || "image_analysis";
    document.getElementById("analysisRole").value = role;
  });
}

// Add event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Load saved settings
  loadSettings();

  // Save when role changes
  document.getElementById("analysisRole").addEventListener("change", () => {
    saveSettings();
  });
});
