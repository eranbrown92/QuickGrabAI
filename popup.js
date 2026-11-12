document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      document
        .querySelectorAll(".tab-content")
        .forEach((content) => content.classList.remove("active"));
      document.getElementById(tab.dataset.tab).classList.add("active");

      if (tab.dataset.tab === "gallery") {
        loadGallery();
      }
    });
  });

  document
    .getElementById("captureBtn")
    .addEventListener("click", async function () {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("edge://")
        ) {
          const imageUrl = await chrome.tabs.captureVisibleTab(null, {
            format: "png",
          });

          await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            css: `
            .quickgrabai-overlay {
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100% !important;
              height: 100% !important;
              background: rgba(0, 0, 0, 0.3) !important;
              z-index: 2147483647 !important;
              cursor: crosshair !important;
            }
            .quickgrabai-selection {
              position: fixed !important;
              border: 2px solid #2196F3 !important;
              background: rgba(33, 150, 243, 0.1) !important;
              z-index: 2147483647 !important;
              pointer-events: none !important;
            }
          `,
          });

          const data = await chrome.storage.sync.get("apiKey");
          if (!data.apiKey) {
            alert("Please add your OpenAI API key in the Settings tab first.");
            return;
          }

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["api.js", "selection.js"],
          });

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (imageUrl, apiKey) => {
              window.initializeSelection(imageUrl, apiKey);
            },
            args: [imageUrl, data.apiKey],
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
    });

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  function openInAnalysisPage(entry) {
    localStorage.setItem("quickgrabai_selected", JSON.stringify(entry));
    chrome.tabs.create({ url: "analysis.html" });
  }

  function loadGallery() {
    const entries = JSON.parse(
      localStorage.getItem("quickgrabai_entries") || "[]"
    );
    const galleryDiv = document.getElementById("galleryItems");

    if (entries.length === 0) {
      galleryDiv.innerHTML =
        '<p style="text-align: center; color: #666;">No analyses yet</p>';
      return;
    }

    galleryDiv.innerHTML = entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(
        (entry) => `
        <div class="gallery-item" data-timestamp="${entry.timestamp}">
          <div class="timestamp">${formatDate(entry.timestamp)}</div>
          <img src="${entry.image}" alt="Analyzed image">
          <div class="analysis">${entry.analysis}</div>
          <span class="view-more">Click to view full analysis</span>
        </div>
      `
      )
      .join("");

    document.querySelectorAll(".gallery-item").forEach((item) => {
      item.addEventListener("click", () => {
        const timestamp = parseInt(item.dataset.timestamp);
        const entry = entries.find((e) => e.timestamp === timestamp);
        if (entry) {
          openInAnalysisPage(entry);
        }
      });
    });
  }

  function maskApiKey(key) {
    if (!key) return "";
    return key.substring(0, 3) + "..." + key.substring(key.length - 4);
  }

  function showApiKeyInput() {
    const section = document.getElementById("apiKeySection");
    section.innerHTML = `
      <input type="text" class="api-key-input" placeholder="Enter OpenAI API Key (sk-...)">
      <button class="save-key">Save API Key</button>
    `;

    const saveBtn = section.querySelector(".save-key");
    saveBtn.addEventListener("click", () => {
      const input = section.querySelector(".api-key-input");
      const key = input.value.trim();
      if (key && key.startsWith("sk-")) {
        chrome.storage.sync.set({ apiKey: key }, () => {
          showApiKeyDisplay(key);
        });
      } else {
        alert('Please enter a valid OpenAI API key starting with "sk-"');
      }
    });
  }

  function showApiKeyDisplay(key) {
    const section = document.getElementById("apiKeySection");
    section.innerHTML = `
      <div class="api-key-display">
        <span class="api-key-mask">${maskApiKey(key)}</span>
        <button class="remove-key">Remove</button>
      </div>
    `;

    const removeBtn = section.querySelector(".remove-key");
    removeBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to remove the API key?")) {
        chrome.storage.sync.remove("apiKey", () => {
          showApiKeyInput();
        });
      }
    });
  }

  function loadSettings() {
    chrome.storage.sync.get(["analysisRole"], (result) => {
      const role = result.analysisRole || "image_analysis";
      document.getElementById("analysisRole").value = role;
    });

    chrome.storage.sync.get(["apiKey"], (result) => {
      if (result.apiKey) {
        showApiKeyDisplay(result.apiKey);
      } else {
        showApiKeyInput();
      }
    });
  }

  document.getElementById("analysisRole").addEventListener("change", (e) => {
    chrome.storage.sync.set({ analysisRole: e.target.value });
  });

  loadSettings();
  loadGallery();
});
