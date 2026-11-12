function initializeSelection(fullPageImage, apiKey) {
  let isSelecting = false;
  let startX, startY;
  let overlay, selection;

  function createOverlay() {
    overlay = document.createElement("div");
    overlay.className = "quickgrabai-overlay";

    selection = document.createElement("div");
    selection.className = "quickgrabai-selection";
    selection.style.display = "none";

    document.body.appendChild(overlay);
    document.body.appendChild(selection);

    overlay.addEventListener("mousedown", startSelection);
    overlay.addEventListener("mousemove", updateSelection);
    overlay.addEventListener("mouseup", endSelection);
    document.addEventListener("keydown", handleKeyPress);
  }

  function handleKeyPress(e) {
    if (e.key === "Escape") {
      cleanup();
    }
  }

  function startSelection(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selection.style.display = "block";
    selection.style.left = startX + "px";
    selection.style.top = startY + "px";
    selection.style.width = "0";
    selection.style.height = "0";
  }

  function updateSelection(e) {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selection.style.left = (currentX > startX ? startX : currentX) + "px";
    selection.style.top = (currentY > startY ? startY : currentY) + "px";
    selection.style.width = width + "px";
    selection.style.height = height + "px";
  }

  function endSelection(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const endX = e.clientX;
    const endY = e.clientY;

    cleanup();

    // Ensure minimum selection size
    if (Math.abs(endX - startX) < 10 || Math.abs(endY - startY) < 10) {
      return;
    }

    const rect = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY),
    };

    cropAndAnalyze(fullPageImage, rect);
  }

  function cleanup() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (selection && selection.parentNode)
      selection.parentNode.removeChild(selection);
    document.removeEventListener("keydown", handleKeyPress);
  }

  function cropAndAnalyze(imageUrl, rect) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      const dpr = window.devicePixelRatio;
      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
        rect.x * dpr,
        rect.y * dpr,
        rect.width * dpr,
        rect.height * dpr,
        0,
        0,
        rect.width,
        rect.height
      );

      const croppedImageData = canvas.toDataURL("image/png");
      analyzeWithOpenAI(croppedImageData, apiKey);
    };
    img.src = imageUrl;
  }

  createOverlay();
}
