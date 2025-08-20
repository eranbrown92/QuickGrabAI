chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processImage") {
    showLoading();
    analyzeImage(request.imageData, request.apiKey, request.role);
  }
});

function showLoading() {
  document.getElementById("result").innerHTML = `
    <div class="loading">
      <p>Analyzing image...</p>
      <div class="spinner"></div>
    </div>
  `;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function displayAnalysis(imageData, analysis, timestamp) {
  document.getElementById("result").innerHTML = `
    <div class="analysis">
      ${
        timestamp
          ? `<div class="timestamp">Analyzed on ${formatDate(timestamp)}</div>`
          : ""
      }
      <img src="${imageData}" alt="Analyzed image">
      <div class="analysis-text">
        <h3>Analysis:</h3>
        <p>${analysis}</p>
      </div>
    </div>
  `;
}

function showDeleteModal(timestamp) {
  const modal = document.getElementById("deleteModal");
  modal.classList.add("show");
  modal.dataset.timestamp = timestamp;
}

function hideDeleteModal() {
  const modal = document.getElementById("deleteModal");
  modal.classList.remove("show");
  delete modal.dataset.timestamp;
}

function deleteAnalysis(timestamp) {
  const entries = JSON.parse(
    localStorage.getItem("quickgrabai_entries") || "[]"
  );
  const updatedEntries = entries.filter(
    (entry) => entry.timestamp !== timestamp
  );
  localStorage.setItem("quickgrabai_entries", JSON.stringify(updatedEntries));

  const currentDisplay = document.querySelector("#result img");
  if (currentDisplay) {
    const currentSrc = currentDisplay.src;
    const deletedEntry = entries.find((entry) => entry.timestamp === timestamp);
    if (deletedEntry && deletedEntry.image === currentSrc) {
      if (updatedEntries.length > 0) {
        displayAnalysis(
          updatedEntries[0].image,
          updatedEntries[0].analysis,
          updatedEntries[0].timestamp
        );
      } else {
        document.getElementById("result").innerHTML =
          "<p>No analyses available</p>";
      }
    }
  }

  loadGallery();
  hideDeleteModal();
}

function loadGallery() {
  const entries = JSON.parse(
    localStorage.getItem("quickgrabai_entries") || "[]"
  );
  const galleryDiv = document.getElementById("gallery");

  if (entries.length === 0) {
    galleryDiv.innerHTML =
      '<p style="text-align: center; color: #666;">No analyses available</p>';
    return;
  }

  galleryDiv.innerHTML = entries
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(
      (entry) => `
      <div class="gallery-item" data-timestamp="${entry.timestamp}">
        <button class="delete-btn" data-timestamp="${
          entry.timestamp
        }">Delete</button>
        <div class="timestamp">${formatDate(entry.timestamp)}</div>
        <img src="${entry.image}" alt="Analyzed image">
        <div class="analysis">${entry.analysis.replace(
          /[^\x20-\x7E]/g,
          ""
        )}</div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll(".gallery-item").forEach((item) => {
    const timestamp = parseInt(item.dataset.timestamp);
    const entry = entries.find((e) => e.timestamp === timestamp);

    item.addEventListener("click", (e) => {
      if (!e.target.classList.contains("delete-btn")) {
        displayAnalysis(
          entry.image,
          entry.analysis.replace(/[^\x20-\x7E]/g, ""),
          entry.timestamp
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    const deleteBtn = item.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showDeleteModal(timestamp);
    });
  });
}

function getPromptForRole(role) {
  switch (role) {
    case "test_taker":
      return "You are an expert test-taking assistant for all academic subjects including math, science, history, literature, language arts, social studies, chemistry, physics, biology, economics, psychology, and more. If the image contains a test question, exam question, homework problem, or academic exercise: 1) Carefully analyze the question and any provided information, 2) Show your step-by-step reasoning when appropriate (especially for math/science), 3) Provide the correct answer clearly marked, 4) For multiple choice questions, state the correct letter/option. If it's not a test question, please indicate that it's not a test question.";
    case "image_analysis":
    default:
      return "For images that are not test questions, provide a brief 1-2 sentence concise description of what you see. If this appears to be a test question, please indicate that it should be analyzed using test taker mode.";
  }
}

async function analyzeImage(imageData, apiKey, role = "image_analysis") {
  try {
    const base64Image = imageData.includes("base64,")
      ? imageData.split("base64,")[1]
      : imageData;

    const prompt = getPromptForRole(role);

    // Get selected model from storage
    const result = await chrome.storage.sync.get("selectedModel");
    const selectedModel = result.selectedModel || "gpt-5-2025-08-07";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Failed to analyze image");
    }

    const analysis = data.choices[0].message.content.replace(
      /[^\x20-\x7E]/g,
      ""
    );

    const entries = JSON.parse(
      localStorage.getItem("quickgrabai_entries") || "[]"
    );
    const newEntry = {
      timestamp: Date.now(),
      image: imageData,
      analysis: analysis,
      role: role,
    };
    entries.push(newEntry);
    localStorage.setItem("quickgrabai_entries", JSON.stringify(entries));

    displayAnalysis(imageData, analysis, newEntry.timestamp);
    loadGallery();
  } catch (error) {
    document.getElementById("result").innerHTML = `
      <div class="analysis" style="color: #dc3545;">
        Error: ${error.message}
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("confirmDelete").addEventListener("click", () => {
    const timestamp = parseInt(
      document.getElementById("deleteModal").dataset.timestamp
    );
    if (timestamp) {
      deleteAnalysis(timestamp);
    }
  });

  document
    .getElementById("cancelDelete")
    .addEventListener("click", hideDeleteModal);

  const selectedAnalysis = localStorage.getItem("quickgrabai_selected");
  if (selectedAnalysis) {
    const analysis = JSON.parse(selectedAnalysis);
    displayAnalysis(
      analysis.image,
      analysis.analysis.replace(/[^\x20-\x7E]/g, ""),
      analysis.timestamp
    );
    localStorage.removeItem("quickgrabai_selected");
  }

  loadGallery();
});
